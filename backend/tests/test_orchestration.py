import sys
import os
import uuid
import pytest

# Ensure the root directory is in the PYTHONPATH to find the top-level agents directory
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..")))

from agents import run_governance_graph
from agents.graph import compiled_graph
from agents.supervisor import REQUIRED_AGENTS, parse_supervisor_verdict
from agents.fraud import FraudAgent


def _low_risk_tx(**overrides):
    tx = {
        "id": str(uuid.uuid4()),
        "amount": 250.00,
        "currency": "USD",
        "reference_number": "TX-TEST01",
        "device": {
            "fingerprint": "dev-test-01",
            "ip_address": "192.168.1.50",
            "is_emulator": False,
        },
        "account": {
            "customer": {
                "email": "orchestration_test@aegisai.test",
                "status": "active",
                "risk_level": "low",
            }
        },
    }
    tx.update(overrides)
    return tx


CONTRACT_KEYS = (
    "agent",
    "status",
    "risk_score",
    "flags",
    "evidence",
    "confidence",
    "latency_ms",
)


def _envelope(res):
    """Normalize an AgentResponse (or dict) to the requested wire shape."""
    if isinstance(res, dict):
        get = res.get
        return {
            "agent": get("agent_name", ""),
            "status": get("status"),
            "risk_score": get("risk_score", 0.0),
            "flags": get("flags", []),
            "evidence": get("evidence", {}),
            "confidence": get("confidence_score"),
            "latency_ms": round(float(get("execution_time", 0.0)) * 1000, 2),
        }
    return {
        "agent": res.agent_name,
        "status": res.status,
        "risk_score": res.risk_score,
        "flags": res.flags,
        "evidence": res.evidence,
        "confidence": res.confidence_score,
        "latency_ms": round(res.execution_time * 1000, 2),
    }


@pytest.mark.anyio
async def test_pipeline_returns_structured_agent_contract() -> None:
    """Every required agent returns the 7-key structured envelope."""
    state = await compiled_graph.ainvoke({"transaction": _low_risk_tx()})

    for key in REQUIRED_AGENTS:
        res = state.get(key)
        assert res is not None, f"missing {key}"
        env = _envelope(res)
        for contract_key in CONTRACT_KEYS:
            assert contract_key in env, f"{key} missing {contract_key}"
        assert env["status"] == "success"
        assert env["agent"] != ""

    # Structured decision agrees with the parsed legacy string
    decision = state.get("supervisor_decision")
    assert decision is not None
    assert len(decision["per_agent"]) == len(REQUIRED_AGENTS)
    assert parse_supervisor_verdict(state["supervisor_result"]) == decision["verdict"]
    assert decision["verdict"] in ("approved", "declined", "under_review")


@pytest.mark.anyio
async def test_agent_failure_isolated_and_fail_closed(monkeypatch) -> None:
    """A crashed agent degrades the verdict instead of crashing the request."""

    async def _boom(self, state, logs):
        raise RuntimeError("injected fault")

    monkeypatch.setattr(FraudAgent, "_execute", _boom)

    result = await run_governance_graph(_low_risk_tx())

    assert result["status"] == "success"
    # Fail-closed: a dead fraud agent must never silently approve
    assert result["verdict"] in ("declined", "under_review")
    assert result["details"]["fraud"].status == "failed"
    # Healthy agents still ran
    assert result["details"]["device"].status == "success"
    assert result["details"]["policy"].status == "success"


@pytest.mark.anyio
async def test_deterministic_agents_labeled_placeholder() -> None:
    """Heuristic agents are labeled placeholder=True; model agents False.

    Proves we never present deterministic rules as ML predictions.
    """
    state = await compiled_graph.ainvoke({"transaction": _low_risk_tx()})

    def _ph(key):
        res = state.get(key)
        return res["placeholder"] if isinstance(res, dict) else res.placeholder

    assert _ph("device_result") is True
    assert _ph("kyc_result") is True
    assert _ph("explainability_result") is True
    assert _ph("fraud_result") is False
    assert _ph("aml_result") is False
    assert _ph("policy_result") is False


@pytest.mark.anyio
async def test_supervisor_decision_matches_response_scores() -> None:
    """Trust score in the decision dict equals the persisted pipeline value."""
    state = await compiled_graph.ainvoke({"transaction": _low_risk_tx()})
    decision = state["supervisor_decision"]
    assert decision["trust_score"] == state["trust_score_value"]
    assert 0 <= decision["trust_score"] <= 100
    assert decision["failed_agents"] == []
