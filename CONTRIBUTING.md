# Contributing Guidelines

Thank you for contributing to AegisAI. As an AI Governance Operating System for banking environments, security, robustness, correctness, and transparency are paramount.


## Code Quality Standards

### General Principles
- **No Placeholders**: Do not check in partial implementations, `TODO` statements, or mock code. All contributions must be fully functional.
- **Strict Typing**:
  - **Python**: All function signatures must be fully typed (arguments and return types).
  - **TypeScript**: Use strict mode (`tsconfig.json`). Avoid using `any` under any circumstances.
- **SOLID Principles**: Adhere to SOLID design patterns and Clean Architecture boundaries.

### Python Backend
- Code formatting follows **PEP 8**. Use `ruff` or `black` to format.
- Document all classes and functions with comprehensive Google-style docstrings.
- Write asynchronous endpoint handlers where operations are non-blocking.
- Validate request/response structures using **Pydantic v2** schemas.

### TypeScript Frontend
- All Next.js pages, layouts, and components must utilize strict type definitions.
- Write modular React components utilizing custom hooks for state management.
- Avoid utility styling shortcuts; maintain standard Vanilla CSS/CSS Modules for layout predictability.

---

## Git Workflow & Branching

1. Fork the repository and create a descriptive branch:
   ```bash
   git checkout -b feature/aml-agent-verification
   ```
2. Write clean commits following Conventional Commits format:
   ```bash
   feat(aml): add transactional clustering verification pattern
   fix(gateway): resolve CORS error on dashboard websocket connection
   ```
3. Run tests locally prior to committing:
   ```bash
   pytest tests/
   npm run test
   ```
4. Open a Pull Request detailing the changes, dependencies, and testing verification results.
