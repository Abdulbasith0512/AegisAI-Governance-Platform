"""End-to-end lifecycle test: a real transaction travels the whole system.

Covers all 12 workflow steps in one pass per verdict path (APPROVE /
REVIEW / BLOCK) against the live FastAPI app + Postgres: seed -> POST
intercept -> persisted rows -> supervisor + agents -> policy -> trust ->
verdict -> decision persisted -> audit events -> human review (REVIEW path)
-> final state verified through the API.

Verdicts EMERGE from the real pipeline (clean / emulator / EUR fixtures);
nothing about the outcome is hardcoded. Reuses the phase-2 harness
(conftest api_client/db_session); gated on TEST_DATABASE_URL.
"""

import uuid

import pytest

pytest.importorskip("sqlalchemy")
pytest.importorskip("httpx")

from sqlalchemy import select

from conftest import requires_db

pytestmark = requires_db

LIFECYCLE_TYPES = [
    "transaction.received",
    "agents.executed",
    "policy.evaluated",
    "trust.calculated",
    "decision.created",
    "explanation.generated",
]


async def _seed_customer(db_session, tag: str):
    from app.models.banking import Account, Customer

    customer_id = uuid.uuid4()
    db_session.add(
        Customer(
            id=customer_id,
            first_name="End",
            last_name=f"ToEnd{tag}",
            email=f"e2e_{tag}_{customer_id.hex[:6]}@aegisai.test",
            risk_level="low",
            status="active",
        )
    )
    await db_session.commit()
    db_session.add(
        Account(
            id=uuid.uuid4(),
            customer_id=customer_id,
            account_number=f"E2E-{tag}-{uuid.uuid4().hex[:8].upper()}",
            account_type="checking",
            balance=50000.00,
            currency="USD",
            status="active",
        )
    )
    await db_session.commit()
    return customer_id


def _payload(customer_id, **overrides):
    body = {
        "customer_id": str(customer_id),
        "amount": 250.00,
        "currency": "USD",
        "channel": "mobile",
        "transaction_type": "transfer",
        "device": {
            "fingerprint": f"e2e-dev-{uuid.uuid4().hex[:6]}",
            "ip_address": "192.168.10.10",
            "is_emulator": False,
        },
    }
    body.update(overrides)
    return body


async def _run_lifecycle(api_client, db_session, payload):
    """Steps 2-10 + 12: intercept, persist, supervise, decide, audit."""
    from app.models.governance import TrustScore
    from app.models.transactions import Transaction
    from app.models.agents import Prediction
    from app.models.governance import PolicyCheck

    res = await api_client.post("/api/v1/transactions/intercept", json=payload)
    assert res.status_code == 201, res.text
    body = res.json()
    assert body["verdict"] in ("approved", "declined", "under_review")
    assert 0 <= body["trust_score"] <= 100
    tx_id = uuid.UUID(body["transaction_id"])

    tx = (
        await db_session.execute(select(Transaction).where(Transaction.id == tx_id))
    ).scalars().one()
    assert float(tx.amount) == float(payload["amount"])
    assert tx.status == body["verdict"]
    assert tx.reference_number.startswith("TX-")

    scores = (
        await db_session.execute(select(TrustScore).where(TrustScore.transaction_id == tx_id))
    ).scalars().all()
    assert len(scores) == 1
    assert scores[0].score == body["trust_score"]

    preds = (
        await db_session.execute(
            select(Prediction).where(Prediction.transaction_id == tx_id)
        )
    ).scalars().all()
    assert len(preds) == 6  # device/kyc/fraud/aml/policy/explainability

    checks = (
        await db_session.execute(
            select(PolicyCheck).where(PolicyCheck.transaction_id == tx_id)
        )
    ).scalars().all()
    assert len(checks) >= 1  # policy retrieval/evaluation ran

    hist = await api_client.get(f"/api/v1/audit/transaction/{tx_id}")
    assert hist.status_code == 200, hist.text
    types = [e["event_type"] for e in hist.json()["events"]]
    for expected in LIFECYCLE_TYPES:
        assert expected in types, f"missing audit event {expected}"
    assert [types.index(t) for t in LIFECYCLE_TYPES] == sorted(
        [types.index(t) for t in LIFECYCLE_TYPES]
    )

    verify = await api_client.get(f"/api/v1/audit/transaction/{tx_id}/verify")
    assert verify.status_code == 200, verify.text
    assert verify.json()["valid"] is True

    detail = await api_client.get(f"/api/v1/transactions/{tx_id}")
    assert detail.status_code == 200, detail.text
    assert detail.json()["transaction"]["id"] == str(tx_id)
    return body, tx


async def test_lifecycle_approve_path(api_client, db_session) -> None:
    """Clean transaction travels the system and is approved."""
    customer_id = await _seed_customer(db_session, "approve")
    body, tx = await _run_lifecycle(api_client, db_session, _payload(customer_id))
    assert body["verdict"] == "approved"
    assert body["requires_human_review"] is False
    assert tx.status == "approved"


async def test_lifecycle_review_path_with_human_resolution(api_client, db_session) -> None:
    """Emulator device forces review; auditor resolves; AI history intact."""
    from app.models.governance import HumanReview, TrustScore

    customer_id = await _seed_customer(db_session, "review")
    payload = _payload(customer_id, amount=1200.00)
    payload["device"]["is_emulator"] = True
    body, tx = await _run_lifecycle(api_client, db_session, payload)
    assert body["verdict"] == "under_review"
    assert body["requires_human_review"] is True
    assert body["review_id"] is not None

    reviews = (
        await db_session.execute(
            select(HumanReview).where(HumanReview.transaction_id == tx.id)
        )
    ).scalars().all()
    assert len(reviews) == 1
    assert reviews[0].status == "pending"

    trust_before = (
        await db_session.execute(
            select(TrustScore).where(TrustScore.transaction_id == tx.id)
        )
    ).scalars().one().score

    action = await api_client.post(
        f"/api/v1/reviews/{reviews[0].id}/action",
        json={"status": "approved", "comments": "e2e auditor approval after manual verification"},
    )
    assert action.status_code == 200, action.text

    detail = await api_client.get(f"/api/v1/transactions/{tx.id}")
    assert detail.json()["transaction"]["status"] == "approved"

    await db_session.refresh(reviews[0])
    assert reviews[0].status == "approved"
    assert reviews[0].reviewer_id is not None
    trust_after = (
        await db_session.execute(
            select(TrustScore).where(TrustScore.transaction_id == tx.id)
        )
    ).scalars().one().score
    assert trust_after == trust_before == body["trust_score"]

    hist = await api_client.get(f"/api/v1/audit/transaction/{tx.id}")
    types = [e["event_type"] for e in hist.json()["events"]]
    assert "review.created" in types
    assert any(t.startswith("review_") for t in types)


async def test_lifecycle_block_path(api_client, db_session) -> None:
    """Non-USD currency deterministically fails policy and is declined."""
    customer_id = await _seed_customer(db_session, "block")
    body, tx = await _run_lifecycle(
        api_client, db_session, _payload(customer_id, amount=100.00, currency="EUR")
    )
    assert body["verdict"] == "declined"
    assert tx.status == "declined"
