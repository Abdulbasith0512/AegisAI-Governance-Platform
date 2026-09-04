"""Tests for live Neo4j AML relationship analysis + labeled fallback.

Fallback paths run anywhere (mock session returns []). Live-Neo4j tests
are skipped without TEST_NEO4J_URI. No graph result is ever fabricated:
missing data yields neutral scores with explicit reasons.
"""

import os

import pytest

pytest.importorskip("neo4j")

from app.database.neo4j_db import MockNeo4jSession
from app.services.knowledge_graph import KnowledgeGraphService

needs_neo4j = pytest.mark.skipif(
    not os.getenv("TEST_NEO4J_URI"), reason="TEST_NEO4J_URI not set"
)


def _service_unavailable():
    svc = KnowledgeGraphService.__new__(KnowledgeGraphService)
    svc.db = type("DB", (), {"use_mock": True, "get_session": lambda self: MockNeo4jSession()})()
    return svc


def test_missing_graph_data_neutral_not_fabricated() -> None:
    """Unreachable graph: empty patterns, neutral evidence, honest source."""
    out = _service_unavailable().analyze_transaction_relationships(
        customer_id="ghost", account_id="ghost-acc", amount=9999.0
    )
    assert out["patterns"] == []
    assert out["related_entities"] == []
    assert out["data_source"] == "unavailable"


def test_visualization_empty_when_unavailable() -> None:
    """No more canned Alice/Bob demo graph."""
    out = _service_unavailable().get_graph_visualization()
    assert out["nodes"] == [] and out["links"] == []
    assert out.get("mock") is True


def test_seed_reports_honestly_when_unavailable() -> None:
    """Seed refuses to pretend it wrote anything."""
    out = _service_unavailable().seed_mock_knowledge_graph()
    assert "unavailable" in out["message"] or "nothing seeded" in out["message"]


def test_suspicious_chain_detected_via_fallback_scoring() -> None:
    """Structuring-band amount scores risk even with no graph behind it."""
    from agents.aml import _structuring_risk

    risk, flags = _structuring_risk(4900.0)
    assert risk == 0.40 and flags == ["structuring_band"]
    risk, flags = _structuring_risk(250.0)
    assert risk == 0.0 and flags == []


def test_aml_agent_envelope_on_missing_graph() -> None:
    """Agent completes with structured envelope and unavailable source flag."""
    import asyncio

    from agents.aml import AMLAgent

    agent = AMLAgent()
    agent.graph = _service_unavailable()
    state = {
        "transaction": {
            "amount": 250.0,
            "customer_id": "cust-1",
            "account_id": "acc-1",
            "beneficiary_id": None,
        },
        "history": [],
    }
    res = asyncio.run(agent.run(state))
    assert res.status == "success"
    assert res.model == "neo4j-relationship-v1"
    assert res.placeholder is False
    assert res.evidence["data_source"] == "unavailable"
    assert "suspicious_patterns" in res.evidence
    assert "related_entities" in res.evidence
    assert "graph_evidence" in res.evidence


@needs_neo4j
def test_live_circular_loop_detected() -> None:
    """Against a seeded dev instance: dev-acc-1 sits on a real cycle."""
    import asyncio

    from agents.aml import AMLAgent

    agent = AMLAgent()
    state = {
        "transaction": {
            "amount": 300.0,
            "customer_id": "dev-cust-synth",
            "account_id": "dev-acc-1",
            "beneficiary_id": "dev-acc-2",
        },
        "history": [],
    }
    res = asyncio.run(agent.run(state))
    assert res.status == "success"
    assert res.evidence["data_source"] == "neo4j"
    types = [p["pattern_type"] for p in res.evidence["suspicious_patterns"]]
    assert "circular_transfer_loop" in types


@needs_neo4j
def test_live_normal_relationship_low_risk() -> None:
    """Linear dev-acc-4 -> dev-acc-5 chain: no cycle, low risk."""
    import asyncio

    from agents.aml import AMLAgent

    agent = AMLAgent()
    state = {
        "transaction": {
            "amount": 120.0,
            "customer_id": "dev-cust-synth",
            "account_id": "dev-acc-4",
            "beneficiary_id": "dev-acc-5",
        },
        "history": [],
    }
    res = asyncio.run(agent.run(state))
    assert res.status == "success"
    types = [p["pattern_type"] for p in res.evidence["suspicious_patterns"]]
    assert "circular_transfer_loop" not in types
    assert res.risk_score < 0.40
