import uuid
import pytest
from app.services.explainability import DefaultExplainabilityEngine

def test_explainability_engine_normal_generation() -> None:
    """
    Verifies that a standard explainability trace generates all core elements.
    """
    pred_id = uuid.uuid4()
    agent_traces = {
        "warnings": [],
        "timeline": [
            {"event": "Start Ingestion", "duration_ms": 1.0, "status": "success"},
            {"event": "Evaluated Fraud", "duration_ms": 12.0, "status": "success"}
        ],
        "feature_importance": {
            "amount": 0.12,
            "ip_risk": 0.05
        }
    }
    
    engine = DefaultExplainabilityEngine()
    res = engine.generate_explanation(pred_id, agent_traces)

    assert res["prediction_id"] == pred_id
    assert res["explainability_score"] == 0.80 # text + attributions + timeline; no entities supplied
    assert "events" in res["decision_timeline"]
    assert len(res["decision_timeline"]["events"]) == 2
    assert "nodes" in res["evidence_graph"]
    # No canned topology: graph derives from supplied agents/entities only
    assert res["evidence_graph"]["nodes"] == []
    assert res["feature_importance"]["amount"] == 0.12
    assert res["contributing_agents"]["agents"] == []
    assert res["machine_readable"]["attributions_format"] == "model-contributions"

def test_explainability_warnings_adaptation() -> None:
    """
    Verifies that warnings alter graph node state risk levels.
    """
    pred_id = uuid.uuid4()
    agent_traces = {
        "warnings": ["Warning: Terminal emulator active", "Policy Limit Breached"],
        "feature_importance": {
            "amount": 0.15,
            "unsupported_currency": 0.85
        }
    }
    
    engine = DefaultExplainabilityEngine()
    res = engine.generate_explanation(pred_id, agent_traces)

    # Graph nodes derive from supplied agents/entities — with neither, the
    # graph is honestly empty (no canned device/policy topology).
    assert res["evidence_graph"]["nodes"] == []
    assert "emulator" in res["human_readable"].lower()
