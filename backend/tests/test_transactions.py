import pytest
import uuid
from typing import Dict, Any
from pydantic import ValidationError
from app.schemas.transaction import TransactionInterceptRequest
from agents.supervisor import parse_supervisor_verdict
from ml.models import fraud_estimator, behavior_estimator, aml_estimator, kyc_estimator
from app.services.vector_store import AegisVectorStore

def test_transaction_intercept_request_validation() -> None:
    """Verifies Pydantic validation on incoming transaction requests."""
    cust_id = uuid.uuid4()
    payload = {
        "customer_id": str(cust_id),
        "amount": 250.0,
        "currency": "USD",
        "channel": "mobile",
        "transaction_type": "transfer",
        "device": {
            "fingerprint": "dev_fingerprint_abc",
            "ip_address": "192.168.1.1",
            "is_emulator": False
        }
    }
    
    req = TransactionInterceptRequest(**payload)
    assert req.customer_id == cust_id
    assert req.amount == 250.0
    assert req.currency == "USD"
    assert req.device.fingerprint == "dev_fingerprint_abc"

def test_transaction_intercept_request_full_payload() -> None:
    """Validates the extended Phase-1 payload with all optional risk signals."""
    payload = {
        "transaction_id": str(uuid.uuid4()),
        "customer_id": str(uuid.uuid4()),
        "merchant_id": str(uuid.uuid4()),
        "merchant_category": "5411",
        "amount": 1250.75,
        "currency": "EUR",
        "location": "Berlin, DE",
        "device_id": "dev-flat-alias-01",
        "ip_address": "203.0.113.10",
        "account_age_days": 365,
        "failed_attempts": 2,
        "transaction_history": [
            {"amount": 100.0, "counterparty": "acct-1", "status": "approved"},
            {"amount": 4900.0, "counterparty": "acct-2", "status": "declined"},
        ],
        "channel": "web",
        "transaction_type": "payment",
        "device": {
            "fingerprint": "dev_full_01",
            "ip_address": "203.0.113.10",
            "is_emulator": False
        },
        "metadata": {"order_id": "ord-123"}
    }

    req = TransactionInterceptRequest(**payload)
    assert req.merchant_category == "5411"
    assert req.device_id == "dev-flat-alias-01"
    assert req.ip_address == "203.0.113.10"
    assert req.account_age_days == 365
    assert req.failed_attempts == 2
    assert len(req.transaction_history) == 2
    assert req.transaction_history[0].amount == 100.0

def test_transaction_intercept_request_minimal_payload_defaults() -> None:
    """New fields are optional: minimal payload still validates with safe defaults."""
    req = TransactionInterceptRequest(customer_id=uuid.uuid4(), amount=10.0)
    assert req.merchant_category is None
    assert req.device_id is None
    assert req.ip_address is None
    assert req.account_age_days is None
    assert req.failed_attempts == 0
    assert req.transaction_history is None
    assert req.transaction_id is None  # generated server-side

@pytest.mark.parametrize("payload,field", [
    ({"customer_id": str(uuid.uuid4()), "amount": -5.0}, "amount"),
    ({"customer_id": str(uuid.uuid4()), "amount": 0.0}, "amount"),
    ({"customer_id": str(uuid.uuid4()), "amount": 10.0, "currency": "US"}, "currency"),
    ({"customer_id": str(uuid.uuid4()), "amount": 10.0, "currency": "DOLLAR"}, "currency"),
    ({"amount": 10.0}, "customer_id"),
    ({"customer_id": "not-a-uuid", "amount": 10.0}, "customer_id"),
    ({"customer_id": str(uuid.uuid4()), "amount": 10.0, "account_age_days": -1}, "account_age_days"),
    ({"customer_id": str(uuid.uuid4()), "amount": 10.0, "failed_attempts": -2}, "failed_attempts"),
    ({"customer_id": str(uuid.uuid4()), "amount": 10.0, "transaction_history": [{"counterparty": "x"}]}, "transaction_history"),
])
def test_transaction_intercept_request_invalid(payload: Dict[str, Any], field: str) -> None:
    """Invalid payloads are rejected by Pydantic before any DB or agent work."""
    with pytest.raises(ValidationError) as exc_info:
        TransactionInterceptRequest(**payload)
    assert field in str(exc_info.value).lower() or len(exc_info.value.errors()) > 0

@pytest.mark.parametrize("reasoning,expected", [
    ("verdict: approved | trust_score: 92 | reasoning: ok", "approved"),
    ("verdict: declined | trust_score: 20 | reasoning: hard block", "declined"),
    ("verdict: under_review | trust_score: 68 | reasoning: review", "under_review"),
    # Prose mentioning "declined" must not flip an approved verdict prefix
    ("verdict: approved | trust_score: 88 | reasoning: never declined before", "approved"),
    (None, "approved"),
    ("", "approved"),
    ("something unstructured", "approved"),
])
def test_parse_supervisor_verdict(reasoning: Any, expected: str) -> None:
    """Verdict parsing prefers the structured prefix over substring matching."""
    assert parse_supervisor_verdict({"reasoning": reasoning}) == expected
    assert parse_supervisor_verdict(type("R", (), {"reasoning": reasoning})()) == expected

def test_real_ml_estimators_predict() -> None:
    """Checks prediction output ranges and probas for scikit-learn models."""
    # Test Fraud RFC/GBC Ensemble
    features_safe = {"amount": 100.0, "device_is_emulator": False, "location_match": True, "customer_risk": "low"}
    features_risk = {"amount": 45000.0, "device_is_emulator": True, "location_match": False, "customer_risk": "high"}

    assert fraud_estimator.predict_proba(features_safe) < 0.30
    assert fraud_estimator.predict_proba(features_risk) > 0.60
    assert 0.0 <= fraud_estimator.confidence_score(features_safe) <= 1.0

    # Test Behavior Anomaly IsolationForest
    behavior_safe = {"amount": 200.0, "velocity": 2.0, "location_distance": 5.0}
    behavior_anomaly = {"amount": 95000.0, "velocity": 45.0, "location_distance": 8500.0}

    assert behavior_estimator.predict_proba(behavior_safe) < 0.50
    assert behavior_estimator.predict_proba(behavior_anomaly) > 0.50

    # Test AML Network/Structuring
    aml_structuring = {"amount": 4900.0, "customer_id": "cust_a", "beneficiary_id": "cust_b", "history": []}
    assert aml_estimator.predict_proba(aml_structuring) >= 0.40

    # Test KYC matches
    kyc_fail = {"require_document_match": False, "customer_status": "suspended", "risk_level": "high"}
    assert kyc_estimator.predict_proba(kyc_fail) > 0.80

def test_deterministic_vector_store_embeddings() -> None:
    """Verifies that vector hashing creates 384 dimensional normalized vectors."""
    # Create vector store with a mock qdrant client (None is fine as we trigger fallback)
    store = AegisVectorStore(client=None)
    store.use_fallback = True

    exp_text1 = "Transaction flagged. Warnings: Emulator terminal profile signature matched."
    exp_text2 = "Transaction clean: fits standard behavioral and profiling limits."

    v1 = store.generate_embedding(exp_text1)
    v2 = store.generate_embedding(exp_text2)

    assert len(v1) == 384
    assert len(v2) == 384
    
    # Check L2 Normalization (dot product of normalized vector with itself should be ~1.0)
    norm = sum(x*x for x in v1)
    assert abs(norm - 1.0) < 1e-5
