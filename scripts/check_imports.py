"""Dependency-free undefined-name checker (catches NameError before deploy).

py_compile only checks syntax — a missing import like `List` without
`from typing import List` passes compile and explodes at import time on
Render. This script parses every Python file with `ast` and reports names
that are loaded but never imported, defined, or builtin. stdlib only.

Usage:
    python scripts/check_imports.py [paths...]
Exit code 1 when problems are found (CI gate).
"""

from __future__ import annotations

import ast
import builtins
import os
import sys

BUILTINS = set(dir(builtins)) | {"__name__", "__doc__", "__package__", "__loader__",
                                 "__spec__", "__file__", "__cached__", "__annotations__"}


class Scope:
    def __init__(self, parent=None):
        self.names = set()
        self.parent = parent

    def has(self, name):
        scope = self
        while scope is not None:
            if name in scope.names:
                return True
            scope = scope.parent
        return False


def _bind_target(target, scope):
    if isinstance(target, ast.Name):
        scope.names.add(target.id)
    elif isinstance(target, (ast.Tuple, ast.List)):
        for elt in target.elts:
            _bind_target(elt, scope)
    elif isinstance(target, ast.Starred):
        _bind_target(target.value, scope)


class Checker(ast.NodeVisitor):
    def __init__(self):
        self.scope = Scope()
        self.problems = []
        self.in_annotation = 0

    # -- definitions -----------------------------------------------------
    def visit_Import(self, node):
        for alias in node.names:
            self.scope.names.add((alias.asname or alias.name).split(".")[0])
        self.generic_visit(node)

    def visit_ImportFrom(self, node):
        if any(a.name == "*" for a in node.names):
            self.scope.names.add("*STAR*")  # star import: give up on this file
            return
        for alias in node.names:
            self.scope.names.add(alias.asname or alias.name)
        self.generic_visit(node)

    def _function(self, node):
        self.scope.names.add(node.name)
        if node.args:
            outer, self.scope = self.scope, Scope(self.scope)
            for arg in list(node.args.args) + list(node.args.kwonlyargs):
                self.scope.names.add(arg.arg)
            if node.args.vararg:
                self.scope.names.add(node.args.vararg.arg)
            if node.args.kwarg:
                self.scope.names.add(node.args.kwarg.arg)
            for stmt in node.body:
                self.visit(stmt)
            self.scope = outer
        for dec in node.decorator_list:
            self.visit(dec)
        if node.returns:
            self.visit(node.returns)

    visit_FunctionDef = _function
    visit_AsyncFunctionDef = _function

    def visit_ClassDef(self, node):
        self.scope.names.add(node.name)
        outer, self.scope = self.scope, Scope(self.scope)
        for stmt in node.body:
            self.visit(stmt)
        self.scope = outer
        for dec in node.decorator_list:
            self.visit(dec)
        for base in node.bases:
            self.visit(base)

    def _comprehension(self, node):
        outer, self.scope = self.scope, Scope(self.scope)
        for gen in node.generators:
            self.visit(gen.iter)
            _bind_target(gen.target, self.scope)
            for cond in gen.ifs:
                self.visit(cond)
        if isinstance(node, ast.DictComp):
            self.visit(node.key)
            self.visit(node.value)
        else:
            self.visit(node.elt)
        self.scope = outer

    visit_ListComp = _comprehension
    visit_SetComp = _comprehension
    visit_DictComp = _comprehension
    visit_GeneratorExp = _comprehension

    def visit_Lambda(self, node):
        outer, self.scope = self.scope, Scope(self.scope)
        for arg in list(node.args.args) + list(node.args.kwonlyargs):
            self.scope.names.add(arg.arg)
        self.visit(node.body)
        self.scope = outer

    def visit_NamedExpr(self, node):
        self.scope.names.add(node.target.id)
        self.visit(node.value)

    # -- statements that bind --------------------------------------------
    def visit_Assign(self, node):
        self.visit(node.value)
        for target in node.targets:
            _bind_target(target, self.scope)

    def visit_AnnAssign(self, node):
        if node.value:
            self.visit(node.value)
        _bind_target(node.target, self.scope)
        self.visit(node.annotation)

    def visit_For(self, node):
        self.visit(node.iter)
        _bind_target(node.target, self.scope)
        for stmt in node.body + node.orelse:
            self.visit(stmt)

    visit_AsyncFor = visit_For

    def visit_With(self, node):
        for item in node.items:
            self.visit(item.context_expr)
            if item.optional_vars:
                _bind_target(item.optional_vars, self.scope)
        for stmt in node.body:
            self.visit(stmt)

    visit_AsyncWith = visit_With

    def visit_ExceptHandler(self, node):
        if node.type:
            self.visit(node.type)
        outer, self.scope = self.scope, Scope(self.scope)
        if node.name:
            self.scope.names.add(node.name)
        for stmt in node.body:
            self.visit(stmt)
        self.scope = outer

    # -- loads -------------------------------------------------------------
    def visit_Name(self, node):
        if isinstance(node.ctx, ast.Load):
            if "*STAR*" in self.scope.names or node.id in BUILTINS:
                return
            if not self.scope.has(node.id):
                self.problems.append((node.lineno, node.id))


def check_file(path):
    try:
        tree = ast.parse(open(path, encoding="utf-8").read())
    except SyntaxError as e:
        return [(e.lineno or 0, f"SyntaxError: {e.msg}")]
    checker = Checker()
    checker.visit(tree)
    return [(lineno, f"undefined name '{name}'") for lineno, name in checker.problems]


def main(paths):
    roots = paths or ["backend/app", "backend/tests", "agents", "ml", "scripts"]
    failures = 0
    for root in roots:
        if os.path.isfile(root):
            files = [root]
        else:
            files = sorted(str(p) for p in __import__("pathlib").Path(root).rglob("*.py"))
        for path in files:
            if "__pycache__" in path:
                continue
            for lineno, msg in check_file(path):
                print(f"{path}:{lineno}: {msg}")
                failures += 1
    if failures:
        print(f"\n{failures} undefined-name problem(s) found.")
        return 1
    print("check_imports: all names resolve.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv[1:]))
