import logging
from typing import Dict, Any, List
from app.database.neo4j_db import Neo4jDatabaseManager

logger = logging.getLogger(__name__)

class KnowledgeGraphService:
    """
    Service executing advanced graph diagnostics, shortest paths traversals,
    risk propagations, and community grouping Cypher queries.
    """
    def __init__(self) -> None:
        self.db = Neo4jDatabaseManager()

    def seed_mock_knowledge_graph(self) -> Dict[str, str]:
        """
        Seeds nodes and relationships inside the Neo4j database.
        """
        if self.db.use_mock:
            logger.info("Mock Knowledge Graph seeded successfully.")
            return {"message": "Neo4j unavailable: nothing seeded (use scripts/seed_neo4j_dev.py with a live instance for synthetic dev data)."}

        cypher = """
        // Clean existing schema
        MATCH (n) DETACH DELETE n;

        // Create Nodes
        CREATE (c1:Customer {id: 'cust-1', name: 'Alice Smith', risk: 0.15})
        CREATE (c2:Customer {id: 'cust-2', name: 'Bob Johnson', risk: 0.85})
        
        CREATE (d1:Device {id: 'dev-1', brand: 'iPhone 15', ip: '192.168.1.5'})
        CREATE (d2:Device {id: 'dev-2', brand: 'Samsung S24', ip: '10.0.0.12'})

        CREATE (a1:Account {id: 'acc-101', balance: 5400.0, risk: 10.0})
        CREATE (a2:Account {id: 'acc-102', balance: 80.0, risk: 80.0})
        CREATE (a3:Account {id: 'acc-103', balance: 12000.0, risk: 15.0})

        CREATE (m1:Merchant {id: 'merch-99', name: 'Binance Escrow', category: 'Crypto'})
        
        CREATE (t1:Transaction {id: 'tx-1001', amount: 1500.0, risk_score: 92.5})
        CREATE (t2:Transaction {id: 'tx-1002', amount: 50.0, risk_score: 12.0})

        CREATE (ag1:AIAgent {id: 'agent-fraud', name: 'Fraud Agent', weight: 0.8})
        CREATE (p1:Policy {id: 'policy-aml-1', type: 'AML', rule: 'High Value Cash Transfer Limit'})
        CREATE (i1:Incident {id: 'incident-drift', failure: 'Model Drift'})
        CREATE (al1:Alert {id: 'alert-critical', severity: 'Critical', message: 'Suspected laundering loop'})

        // Create Relationships
        CREATE (c1)-[:OWNS]->(a1)
        CREATE (c2)-[:OWNS]->(a2)
        CREATE (c1)-[:USES]->(d1)
        CREATE (c2)-[:USES]->(d2)
        
        CREATE (a1)-[:TRANSFERRED_TO]->(a2)
        CREATE (a2)-[:TRANSFERRED_TO]->(a3)
        CREATE (a3)-[:TRANSFERRED_TO]->(a1) // Loop pattern
        
        CREATE (t1)-[:FLAGGED_BY]->(ag1)
        CREATE (t1)-[:VIOLATED]->(p1)
        CREATE (i1)-[:EXPLAINED_BY]->(ag1)
        CREATE (t1)-[:FLAGGED_BY]->(al1)
        """
        
        with self.db.get_session() as session:
            for statement in cypher.split(";"):
                stmt = statement.strip()
                if stmt:
                    session.run(stmt)
            
        return {"message": "Knowledge graph seeded inside active Neo4j database successfully."}

    def get_graph_visualization(self) -> Dict[str, List[Dict[str, Any]]]:
        """
        Returns full node and relationship link maps formatted for D3 graph visuals.
        Returns an explicitly labeled empty graph when Neo4j is unreachable
        instead of fabricated demo nodes.
        """
        if self.db.use_mock:
            return {"nodes": [], "links": [], "mock": True, "reason": "neo4j_unavailable"}

        cypher = """
        MATCH (n)
        OPTIONAL MATCH (n)-[r]->(m)
        RETURN n, r, m
        """
        
        nodes_dict = {}
        links = []
        
        with self.db.get_session() as session:
            results = session.run(cypher)
            for record in results:
                node_a = record["n"]
                if node_a:
                    nodes_dict[node_a.element_id] = {
                        "id": node_a.element_id,
                        "label": list(node_a.labels)[0] if node_a.labels else "Unknown",
                        "name": node_a.get("name") or node_a.get("id") or "Node"
                    }
                
                node_b = record["m"]
                if node_b:
                    nodes_dict[node_b.element_id] = {
                        "id": node_b.element_id,
                        "label": list(node_b.labels)[0] if node_b.labels else "Unknown",
                        "name": node_b.get("name") or node_b.get("id") or "Node"
                    }
                
                rel = record["r"]
                if rel:
                    links.append({
                        "source": rel.start_node.element_id,
                        "target": rel.end_node.element_id,
                        "type": rel.type
                    })
                    
        return {
            "nodes": list(nodes_dict.values()),
            "links": links
        }

    def find_shortest_fraud_path(self, source_id: str, target_id: str) -> Dict[str, Any]:
        """
        Executes shortest path hops traversal between two graph accounts.
        Returns path_found=False (never invented hops) when unreachable.
        """
        if self.db.use_mock:
            return {"path_found": False, "hops": [], "relationships": [], "reason": "neo4j_unavailable"}

        cypher = """
        MATCH (start:Account {id: $source}), (end:Account {id: $target})
        MATCH p = shortestPath((start)-[*]->(end))
        RETURN [n in nodes(p) | n.id] as path_nodes, [r in relationships(p) | type(r)] as rel_types
        """
        
        with self.db.get_session() as session:
            res = session.run(cypher, {"source": source_id, "target": target_id})
            data = res.data()
            if data and data[0]["path_nodes"]:
                return {
                    "path_found": True,
                    "hops": data[0]["path_nodes"],
                    "relationships": data[0]["rel_types"]
                }
                
        return {"path_found": False, "hops": [], "relationships": []}

    def propagate_risk_scores(self, start_node_id: str) -> Dict[str, Any]:
        """
        Simulates risk weight propagations down transfer connections.
        """
        if self.db.use_mock:
            return {
                "start_node": start_node_id,
                "base_risk": 0.0,
                "propagated_risk_map": {},
                "reason": "neo4j_unavailable",
            }

        # Cypher risk propagation down relationships (propagates 70% risk to targets per hop)
        cypher = """
        MATCH p = (start {id: $node_id})-[:OWNS|TRANSFERRED_TO*1..2]->(target:Account)
        RETURN target.id as id, length(p) as path_length, start.risk as start_risk
        """
        with self.db.get_session() as session:
            res = session.run(cypher, {"node_id": start_node_id})
            data = res.data()
            risk_map = {}
            base_risk = 85.0
            for row in data:
                s_risk = row["start_risk"] or 0.0
                if s_risk <= 1.0:
                    s_risk = s_risk * 100
                base_risk = s_risk
                factor = 0.7 ** row["path_length"]
                risk_map[row["id"]] = round(s_risk * factor, 2)
            return {
                "start_node": start_node_id,
                "base_risk": base_risk,
                "propagated_risk_map": risk_map
            }

    def detect_communities_clustering(self) -> List[Dict[str, Any]]:
        """
        Community detection requires the Neo4j Graph Data Science library,
        which is not part of this deployment. Explicitly unimplemented
        rather than returning hard-coded communities.
        """
        return [{"status": "not_implemented", "reason": "requires_gds_library"}]

    def discover_cyclic_patterns(self) -> List[Dict[str, Any]]:
        """
        Queries circular transfers patterns (A -> B -> C -> A) matching laundry networks.
        """
        if self.db.use_mock:
            return []

        cypher = """
        MATCH (a:Account)-[:TRANSFERRED_TO]->(b:Account)-[:TRANSFERRED_TO]->(c:Account)-[:TRANSFERRED_TO]->(a)
        RETURN a.id as a_id, b.id as b_id, c.id as c_id
        """
        with self.db.get_session() as session:
            res = session.run(cypher)
            data = res.data()
            loops = []
            for row in data:
                loops.append({
                    "pattern_type": "Circular Transfer Loop",
                    "nodes": [row["a_id"], row["b_id"], row["c_id"], row["a_id"]]
                })
            return loops

    # ------------------------------------------------------------------
    # Live transaction relationship analysis (AML agent entry point)
    # ------------------------------------------------------------------
    def sync_transaction_to_graph(
        self,
        customer_id: str,
        account_id: str,
        transaction_id: str,
        amount: float,
        beneficiary_id: str | None = None,
        timestamp: str | None = None,
    ) -> bool:
        """Idempotent write-through of one intercept into Neo4j.

        MERGEs Customer/Account/Transaction nodes plus TRANSFERRED_TO edges
        so relationship analysis reads real traffic. Returns False (never
        raises) when Neo4j is unreachable — the money path must not break.
        """
        if self.db.use_mock:
            return False
        cypher = """
        MERGE (c:Customer {id: $customer_id})
        MERGE (a:Account {id: $account_id})
        MERGE (c)-[:OWNS]->(a)
        MERGE (t:Transaction {id: $tx_id})
        SET t.amount = $amount, t.timestamp = $timestamp
        MERGE (a)-[:INITIATED]->(t)
        """
        params: Dict[str, Any] = {
            "customer_id": str(customer_id),
            "account_id": str(account_id),
            "tx_id": str(transaction_id),
            "amount": float(amount),
            "timestamp": timestamp,
        }
        if beneficiary_id:
            cypher += """
            MERGE (b:Account {id: $beneficiary_id})
            MERGE (a)-[r:TRANSFERRED_TO]->(b)
            SET r.amount = $amount, r.timestamp = $timestamp
            """
            params["beneficiary_id"] = str(beneficiary_id)
        try:
            with self.db.get_session() as session:
                session.run(cypher, params)
            return True
        except Exception as e:
            logger.warning("Graph write-through failed: %s", e)
            return False

    def analyze_transaction_relationships(
        self,
        customer_id: str,
        account_id: str,
        beneficiary_id: str | None = None,
        amount: float = 0.0,
    ) -> Dict[str, Any]:
        """Analyze live graph relationships for one transaction.

        Returns {patterns, related_entities, graph_evidence, data_source}.
        Every finding cites the Cypher rows behind it; an unreachable
        graph yields empty patterns with data_source="unavailable".
        """
        if self.db.use_mock:
            return {
                "patterns": [],
                "related_entities": [],
                "graph_evidence": {"reason": "neo4j_unavailable"},
                "data_source": "unavailable",
            }
        try:
            with self.db.get_session() as session:
                ego = session.run(
                    """
                    MATCH (a:Account {id: $account_id})-[r:TRANSFERRED_TO]->(t:Account)
                    RETURN count(r) AS edge_count,
                           count(DISTINCT t) AS distinct_targets,
                           coalesce(sum(r.amount), 0.0) AS total_volume
                    """,
                    {"account_id": str(account_id)},
                ).data()
                ego = ego[0] if ego else {"edge_count": 0, "distinct_targets": 0, "total_volume": 0.0}

                cycles = session.run(
                    """
                    MATCH (a:Account {id: $account_id})-[:TRANSFERRED_TO]->(b:Account)
                          -[:TRANSFERRED_TO]->(c:Account)-[:TRANSFERRED_TO]->(a)
                    RETURN DISTINCT [a.id, b.id, c.id, a.id] AS loop
                    """,
                    {"account_id": str(account_id)},
                ).data()

                chain = {"path_found": False, "hops": [], "hop_count": 0}
                if beneficiary_id:
                    rows = session.run(
                        """
                        MATCH (s:Account {id: $source}), (e:Account {id: $target})
                        MATCH p = shortestPath((s)-[:TRANSFERRED_TO*..6]->(e))
                        RETURN [n IN nodes(p) | n.id] AS hops
                        """,
                        {"source": str(account_id), "target": str(beneficiary_id)},
                    ).data()
                    if rows and rows[0].get("hops"):
                        chain = {
                            "path_found": True,
                            "hops": rows[0]["hops"],
                            "hop_count": len(rows[0]["hops"]) - 1,
                        }

                neighbors = session.run(
                    """
                    MATCH (a:Account {id: $account_id})-[:TRANSFERRED_TO]->(t:Account)
                    RETURN DISTINCT t.id AS id LIMIT 25
                    """,
                    {"account_id": str(account_id)},
                ).data()
        except Exception as e:
            logger.warning("Graph relationship analysis failed: %s", e)
            return {
                "patterns": [],
                "related_entities": [],
                "graph_evidence": {"reason": "query_failed"},
                "data_source": "unavailable",
            }

        patterns: List[Dict[str, Any]] = []
        edge_count = int(ego.get("edge_count") or 0)
        distinct = int(ego.get("distinct_targets") or 0)
        if cycles:
            patterns.append({
                "pattern_type": "circular_transfer_loop",
                "severity": "high",
                "loops": [row["loop"] for row in cycles],
            })
        if chain["path_found"] and chain["hop_count"] >= 3:
            patterns.append({
                "pattern_type": "unusual_chain",
                "severity": "medium",
                "hops": chain["hops"],
                "hop_count": chain["hop_count"],
            })
        if edge_count >= 10 and distinct >= 5:
            patterns.append({
                "pattern_type": "dense_relationships",
                "severity": "medium",
                "edge_count": edge_count,
                "distinct_targets": distinct,
            })
        if edge_count >= 5 and float(amount) >= 4500.0:
            patterns.append({
                "pattern_type": "rapid_movement",
                "severity": "medium",
                "edge_count": edge_count,
                "amount": float(amount),
            })

        return {
            "patterns": patterns,
            "related_entities": [
                {"id": row["id"], "label": "Account"} for row in neighbors
            ],
            "graph_evidence": {
                "ego_edge_count": edge_count,
                "ego_distinct_targets": distinct,
                "ego_total_volume": float(ego.get("total_volume") or 0.0),
                "chain": chain,
                "cycle_count": len(cycles),
            },
            "data_source": "neo4j",
        }
