"""Tests for the behavioral anomaly baseline (per-customer deviations).

Pure Python + sklearn; no database required. Proves normal behavior
passes, real deviations trip the detector with named evidence, thin
history degrades gracefully without inventing data, and inference is
deterministic.
"""

import json
import os

from ml.behavior_service import (
    ANOMALY_THRESHOLD,
    MIN_HISTORY_ROWS,
    MODEL_VERSION,
    behavior_service,
)

META_PATH = os.path.join(
    os.path.dirname(__file__), "..", "..", "ml", "artifacts", "behavior_v1_metadata.json"
)


def _steady_history(n=5):
    return [
        {
            "amount": 200.0 + i * 10.0,
            "timestamp": "2026-01-05T10:00:00",
            "counterparty": "merchant-1",
            "device_fingerprint": "dev-1",
            "merchant_category_risk": 0.2,
        }
        for i in range(n)
    ]


def _steady_current():
    return {
        "amount": 210.0,
        "timestamp": "2026-01-06T10:30:00",
        "counterparty": "merchant-1",
        "device_fingerprint": "dev-1",
        "merchant_category_risk": 0.2,
        "velocity_1h": 1,
        "failed_attempts": 0,
    }


def test_normal_behavior_not_anomalous() -> None:
    """Steady customer behavior scores below threshold."""
    out = behavior_service.analyze(_steady_current(), _steady_history())
    assert set(out) == {"anomaly_score", "is_anomalous", "evidence", "confidence", "model_version"}
    assert out["is_anomalous"] is False
    assert out["anomaly_score"] < ANOMALY_THRESHOLD
    assert out["model_version"] == MODEL_VERSION
    assert out["evidence"]["baseline_n"] == 5


def test_anomalous_behavior_detected_with_evidence() -> None:
    """Amount spike + night hour + new merchant/device trip the detector."""
    out = behavior_service.analyze(
        {
            "amount": 15000.0,
            "timestamp": "2026-01-06T03:00:00",
            "counterparty": "merchant-x",
            "device_fingerprint": "dev-x",
            "merchant_category_risk": 0.9,
            "velocity_1h": 12,
            "failed_attempts": 3,
        },
        _steady_history(),
    )
    assert out["is_anomalous"] is True
    assert out["anomaly_score"] >= ANOMALY_THRESHOLD
    drivers = out["evidence"]["drivers"]
    assert "amount_deviation" in drivers
    assert "device_change" in drivers or "merchant_change" in drivers


def test_thin_history_graceful_neutral() -> None:
    """Under MIN_HISTORY_ROWS: neutral score, low confidence, explicit reason.

    Proves no history is ever fabricated in production paths.
    """
    for history in ([], [{"amount": 50.0}], [{"amount": 50.0}, {"amount": 60.0}]):
        assert len(history) < MIN_HISTORY_ROWS
        out = behavior_service.analyze({"amount": 99999.0}, history)
        assert out["anomaly_score"] == 0.0
        assert out["is_anomalous"] is False
        assert out["confidence"] <= 0.3
        assert out["evidence"]["reason"] == "insufficient_history"


def test_deterministic_scores() -> None:
    """Same input twice yields the same output."""
    first = behavior_service.analyze(_steady_current(), _steady_history())
    second = behavior_service.analyze(_steady_current(), _steady_history())
    assert first == second


def test_artifact_metadata_honest() -> None:
    """Committed artifact matches metadata; synthetic-only is declared."""
    with open(META_PATH) as f:
        meta = json.load(f)
    assert meta["model_version"] == MODEL_VERSION == behavior_service.model_version
    assert meta["synthetic_only"] is True
    assert "no claim" in meta["disclaimer"].lower()
    assert 0.5 < meta["metrics"]["cv_roc_auc"] <= 1.0


def test_fraud_agent_carries_behavior_signal() -> None:
    """FraudAgent envelope includes the behavior version + anomaly evidence."""
    import asyncio

    from agents.fraud import FraudAgent

    agent = FraudAgent()
    state = {
        "transaction": {
            "amount": 250.0,
            "merchant_category": "5411",
            "account_age_days": 900,
            "failed_attempts": 0,
            "timestamp": "2026-01-06T10:30:00",
            "device": {"fingerprint": "dev-1", "ip_address": "192.168.1.1"},
            "beneficiary": {"beneficiary_account_number": "merchant-1"},
        },
        "velocity": 1.0,
        "location_distance": 5.0,
        "history": _steady_history(),
    }
    res = asyncio.run(agent.run(state))
    assert res.status == "success"
    assert res.evidence["behavior_model_version"] == MODEL_VERSION
    assert "behavior_anomaly" in res.evidence
    assert res.placeholder is False
