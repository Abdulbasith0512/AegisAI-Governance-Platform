"""Development seed for the Neo4j AML graph.

SYNTHETIC TEST DATA ONLY. Every node created here carries
``synthetic: true`` and this script refuses to run unless explicitly
confirmed. It MERGEs (never wipes):

- a 3-account circular loop  (dev-acc-1 -> dev-acc-2 -> dev-acc-3 -> dev-acc-1)
- a normal linear chain      (dev-acc-4 -> dev-acc-5)

Usage:
    python scripts/seed_neo4j_dev.py --confirm
"""

from __future__ import annotations

import argparse
import os
import sys

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))
sys.path.insert(0, os.path.join(os.path.abspath(os.path.join(os.path.dirname(__file__), "..")), "backend"))

STATEMENTS = [
    "MERGE (c:Customer {id: 'dev-cust-synth'}) SET c.synthetic = true, c.name = 'Synthetic Customer'",
    "MERGE (a1:Account {id: 'dev-acc-1'}) SET a1.synthetic = true",
    "MERGE (a2:Account {id: 'dev-acc-2'}) SET a2.synthetic = true",
    "MERGE (a3:Account {id: 'dev-acc-3'}) SET a3.synthetic = true",
    "MERGE (a4:Account {id: 'dev-acc-4'}) SET a4.synthetic = true",
    "MERGE (a5:Account {id: 'dev-acc-5'}) SET a5.synthetic = true",
    "MERGE (c:Customer {id: 'dev-cust-synth'}) MERGE (a:Account {id: 'dev-acc-1'}) MERGE (c)-[:OWNS]->(a)",
    "MERGE (a:Account {id: 'dev-acc-1'}) MERGE (b:Account {id: 'dev-acc-2'}) MERGE (a)-[:TRANSFERRED_TO {amount: 4900.0}]->(b)",
    "MERGE (a:Account {id: 'dev-acc-2'}) MERGE (b:Account {id: 'dev-acc-3'}) MERGE (a)-[:TRANSFERRED_TO {amount: 4950.0}]->(b)",
    "MERGE (a:Account {id: 'dev-acc-3'}) MERGE (b:Account {id: 'dev-acc-1'}) MERGE (a)-[:TRANSFERRED_TO {amount: 4800.0}]->(b)",
    "MERGE (a:Account {id: 'dev-acc-4'}) MERGE (b:Account {id: 'dev-acc-5'}) MERGE (a)-[:TRANSFERRED_TO {amount: 120.0}]->(b)",
]


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--confirm", action="store_true", help="Required flag to run the seed.")
    args = parser.parse_args()
    if not args.confirm:
        print("Refusing to seed without --confirm. All data is labeled synthetic: true.")
        return 2

    from app.database.neo4j_db import Neo4jDatabaseManager

    db = Neo4jDatabaseManager()
    if db.use_mock:
        print("Neo4j unreachable: nothing seeded.")
        return 1
    with db.get_session() as session:
        for stmt in STATEMENTS:
            session.run(stmt)
    print(f"Seeded {len(STATEMENTS)} synthetic statements (synthetic: true).")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
