"""Tests for evidence-grounded decision explanations.

Every assertion ties output text back to structured inputs: the summary
must name the real verdict, real drivers, real policies, and real agents —
never contradict them. DB-free.
"""

from datetime import datetime

from app.services.explainability import (
    DefaultExplainabilityEngine,
    build_decision_explanation,
)


def _decision(verdict="declined"):
    return {
        "verdict": verdict,
        "trust_score": 32 if verdict == "declined" else 88,
        "failed_agents": [],
        "per_agent": [
            {"agent": "FraudAgent", "status": "success", "risk_score": 0.92,
             "flags": ["fraud:amount_value"], "evidence": {}, "confidence": 0.35,
             "latency_ms": 42.1},
            {"agent": "PolicyAgent", "status": "success", "risk_score": 1.0,
             "flags": ["policy_POL-AML-202"], "evidence": {}, "confidence": 0.0,
             "latency_ms": 8.2},
            {"agent": "DeviceAgent", "status": "success", "risk_score": 0.0,
             "flags": [], "evidence": {}, "confidence": 1.0, "latency_ms": 12.4},
        ],
        "consensus_ratio": 0.4,
        "consensus_votes": {},
        "trust_weights": {},
        "trust_reasons": {},
    }


def test_decline_summary_names_verdict_driver_policy_and_agents() -> None:
    """Q1-Q5: declined summary cites the real verdict, factor, policy, agents."""
    out = build_decision_explanation(
        decision=_decision("declined"),
        trust_score=32,
        policy_status="fail",
        requires_human_review=False,
    )
    assert set(out) == {
        "summary", "contributing_factors", "policy_evidence",
        "agent_evidence", "confidence", "generated_at",
    }
    assert "declined" in out["summary"]
    assert "32/100" in out["summary"]
    assert "POL-AML-202" in str(out["contributing_factors"])
    assert out["policy_evidence"]["policy_status"] == "fail"
    assert {a["agent"] for a in out["agent_evidence"]} == {"FraudAgent", "PolicyAgent", "DeviceAgent"}
    assert "[src:" in out["summary"]  # every claim cited
    datetime.fromisoformat(out["generated_at"])  # parses


def test_approve_summary_contradicts_nothing() -> None:
    """Q1+Q6: clean approval carries no risk language and no review flag."""
    decision = _decision("approved")
    for entry in decision["per_agent"]:
        entry["risk_score"] = 0.0
        entry["flags"] = []
    out = build_decision_explanation(
        decision=decision, trust_score=88, policy_status="pass",
        requires_human_review=False,
    )
    assert "approved" in out["summary"] and "88/100" in out["summary"]
    assert out["contributing_factors"] == []
    for banned in ("declined", "flagged", "violation"):
        assert banned not in out["summary"].lower()


def test_under_review_names_cause_and_failed_agents() -> None:
    """Q6: review routing names failed agents when present, else the score."""
    decision = _decision("under_review")
    decision["failed_agents"] = ["AMLAgent"]
    out = build_decision_explanation(
        decision=decision, trust_score=64, policy_status="pass",
        requires_human_review=True,
    )
    assert "human review" in out["summary"]
    assert "AMLAgent" in out["summary"]


def test_factors_ranked_and_cited() -> None:
    """Highest-risk agent leads; each factor cites its evidence source."""
    out = build_decision_explanation(
        decision=_decision("declined"), trust_score=32,
        policy_status="fail", requires_human_review=False,
    )
    factors = out["contributing_factors"]
    assert factors[0]["agent"] == "PolicyAgent"  # risk 1.0 first
    assert factors[0]["source"] == "supervisor.per_agent"
    assert out["policy_evidence"]["source"] == "policy.simulation"


def test_compiler_uses_real_agent_evidence() -> None:
    """Trace compiler reflects supplied agents, durations, and policies."""
    engine = DefaultExplainabilityEngine()
    res = engine.generate_explanation(
        "11111111-1111-1111-1111-111111111111",
        {
            "warnings": ["AML structuring band hit"],
            "agents": [
                {"name": "FraudAgent", "status": "success", "confidence": 0.2,
                 "execution_time_ms": 42.1,
                 "evidence": {"triggered_features": [{"feature": "amount_value", "contribution": 0.9}]}},
                {"name": "PolicyAgent", "status": "failed", "confidence": 0.0,
                 "execution_time_ms": 8.2, "evidence": {}},
            ],
            "entities": [
                {"id": "acc-1", "type": "account", "label": "Source", "status": "active"}
            ],
            "policies": [{"policy_id": "POL-AML-202", "name": "Structuring rule", "status": "fail"}],
        },
    )
    assert res["contributing_agents"]["agents"] == ["FraudAgent"]
    assert res["feature_importance"] == {"amount_value": 1.0}
    assert res["supporting_policies"]["policies"][0]["policy_id"] == "POL-AML-202"
    assert any(n["id"] == "acc-1" and n["status"] == "active" for n in res["evidence_graph"]["nodes"])
    assert any("42.1" in str(e["duration_ms"]) for e in res["decision_timeline"]["events"])
    assert "structuring" in res["human_readable"].lower()
