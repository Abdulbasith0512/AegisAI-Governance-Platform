"""Tests for the versioned fraud baseline (synthetic-data model).

Covers the inference contract, determinism, the no-transaction-id rule,
artifact/version consistency, and agent integration. Pure Python + sklearn;
no database required.
"""

import inspect
import json
import os

import pytest

from ml.fraud_service import FraudModelService, fraud_service, MODEL_VERSION

ARTIFACT = os.path.join(os.path.dirname(__file__), "..", "..", "ml", "artifacts", "fraud_v2.joblib")
META_PATH = os.path.join(os.path.dirname(__file__), "..", "..", "ml", "artifacts", "fraud_v2_metadata.json")

LEGIT = {
    "amount": 250.0,
    "velocity_1h": 1,
    "freq_24h": 2,
    "merchant_category_risk": 0.2,
    "account_age_days": 900,
    "failed_attempts": 0,
    "location_deviation_km": 5.0,
    "history_amount_zscore": 0.1,
}

STRUCTURING = {
    "amount": 4900.0,
    "velocity_1h": 12,
    "freq_24h": 20,
    "merchant_category_risk": 0.9,
    "account_age_days": 10,
    "failed_attempts": 4,
    "location_deviation_km": 3000.0,
    "history_amount_zscore": 3.5,
}


def test_inference_contract_keys_and_ranges() -> None:
    """predict() returns the documented envelope with sane ranges."""
    out = fraud_service.predict(dict(LEGIT))
    assert set(out) == {
        "fraud_probability", "risk_score", "triggered_features",
        "confidence", "model_version", "evidence",
    }
    assert 0.0 <= out["fraud_probability"] <= 1.0
    assert out["risk_score"] == out["fraud_probability"]
    assert 0.0 <= out["confidence"] <= 1.0
    assert out["model_version"] == MODEL_VERSION
    assert isinstance(out["triggered_features"], list) and out["triggered_features"]
    assert all({"feature", "contribution"} <= set(t) for t in out["triggered_features"])


def test_legit_scores_low_structuring_scores_high() -> None:
    """Sanity separation on textbook cases (synthetic distribution)."""
    assert fraud_service.predict(dict(LEGIT))["fraud_probability"] < 0.30
    assert fraud_service.predict(dict(STRUCTURING))["fraud_probability"] > 0.60


def test_deterministic_same_input_same_output() -> None:
    """No randomness at inference time."""
    first = fraud_service.predict(dict(STRUCTURING))
    second = fraud_service.predict(dict(STRUCTURING))
    assert first == second


def test_no_transaction_id_influence() -> None:
    """predict() accepts features only — a result can never be keyed by ID."""
    params = list(inspect.signature(FraudModelService.predict).parameters)
    assert params == ["self", "features"], params
    # Same features with different identities alongside must score identically
    a = fraud_service.predict({**LEGIT, "transaction_id": "id-1", "customer_id": "c-1"})
    b = fraud_service.predict({**LEGIT, "transaction_id": "id-2", "customer_id": "c-2"})
    assert a["fraud_probability"] == b["fraud_probability"]
    # ...while genuinely different features score differently
    c = fraud_service.predict({**LEGIT, "amount": 45000.0, "failed_attempts": 5})
    assert c["fraud_probability"] != a["fraud_probability"]


def test_missing_signals_imputed_and_reported() -> None:
    """Omitted signals fall back to documented medians and are reported."""
    out = fraud_service.predict({"amount": 100.0})
    assert "account_age_log" in out["evidence"]["imputed"]
    assert 0.0 <= out["fraud_probability"] <= 1.0


def test_artifact_and_metadata_consistent() -> None:
    """Committed artifact matches its metadata; metrics are honestly recorded."""
    assert os.path.exists(ARTIFACT), "fraud_v2.joblib must be committed"
    with open(META_PATH) as f:
        meta = json.load(f)
    assert meta["model_version"] == MODEL_VERSION == fraud_service.model_version
    assert meta["synthetic_only"] is True
    assert "synthetic" in meta["disclaimer"].lower()
    assert "no claim" in meta["disclaimer"].lower()
    assert 0.5 < meta["metrics"]["val_roc_auc"] <= 1.0
    svc = FraudModelService()  # fresh load from disk
    assert svc.predict(dict(LEGIT)) == fraud_service.predict(dict(LEGIT))


def test_agent_integration_envelope() -> None:
    """FraudAgent returns the versioned envelope, never a placeholder."""
    import asyncio

    from agents.fraud import FraudAgent

    agent = FraudAgent()
    state = {
        "transaction": {
            "amount": 250.0,
            "merchant_category": "5411",
            "account_age_days": 900,
            "failed_attempts": 0,
        },
        "velocity": 1.0,
        "location_distance": 5.0,
        "history": [],
    }
    res = asyncio.run(agent.run(state))
    assert res.status == "success"
    assert res.placeholder is False
    assert res.model == MODEL_VERSION
    assert res.risk_score == pytest.approx(res.evidence["fraud_probability"])
    assert isinstance(res.flags, list)
