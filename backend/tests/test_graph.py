import os
import pytest
from app.database.neo4j_db import Neo4jDatabaseManager
from app.services.knowledge_graph import KnowledgeGraphService

needs_neo4j = pytest.mark.skipif(
    not os.getenv("TEST_NEO4J_URI"),
    reason="TEST_NEO4J_URI not set; live graph tests skipped",
)

def test_neo4j_manager_initialization() -> None:
    """
    Verifies that the Neo4j manager correctly initializes and checks driver flags.
    """
    manager = Neo4jDatabaseManager()
    assert manager is not None
    # Verify that it instantiates sessions safely
    session = manager.get_session()
    assert session is not None
    session.close()

def test_knowledge_graph_service_mock_visuals() -> None:
    """
    Unreachable graph returns an explicitly labeled empty graph —
    never fabricated demo nodes.
    """
    service = KnowledgeGraphService()
    if not service.db.use_mock:
        pytest.skip("live Neo4j connected; empty-graph contract is mock-only")
    service.seed_mock_knowledge_graph()
    res = service.get_graph_visualization()

    assert res["nodes"] == []
    assert res["links"] == []
    assert res.get("mock") is True

def test_knowledge_graph_shortest_path() -> None:
    """
    Unreachable graph reports no path instead of inventing hops.
    """
    service = KnowledgeGraphService()
    if not service.db.use_mock:
        pytest.skip("live Neo4j connected; no-path contract is mock-only")
    service.seed_mock_knowledge_graph()
    res = service.find_shortest_fraud_path("acc-101", "acc-103")

    assert res["path_found"] is False
    assert res["hops"] == []

def test_knowledge_graph_risk_propagation() -> None:
    """
    Unreachable graph returns an empty risk map instead of fixed scores.
    """
    service = KnowledgeGraphService()
    if not service.db.use_mock:
        pytest.skip("live Neo4j connected; empty-map contract is mock-only")
    service.seed_mock_knowledge_graph()
    res = service.propagate_risk_scores("cust-2")

    assert res["start_node"] == "cust-2"
    assert res["propagated_risk_map"] == {}
