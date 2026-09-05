"""Tests for the immutable lifecycle audit trail.

Pure chain test is DB-free (in-memory rows through the shared verifier).
Lifecycle tests reuse the phase-2 harness and are gated on TEST_DATABASE_URL.
"""

import uuid
from types import SimpleNamespace

import pytest

pytest.importorskip("sqlalchemy")

from sqlalchemy import select

from app.repositories.audit import verify_ledger_chain
from .conftest import requires_db

LIFECYCLE_TYPES = [
    "transaction.received",
    "agents.executed",
    "policy.evaluated",
    "trust.calculated",
    "decision.created",
    "explanation.generated",
]


def _row(action, meta=None, actor=None, resource="tx-1", prev="0" * 64):
    import hashlib
    import json

    meta_str = json.dumps(meta, sort_keys=True) if meta else "{}"
    payload = f"{actor or ''}|{action}|desc|{resource}|{meta_str}|{prev}"
    return SimpleNamespace(
        id=uuid.uuid4(),
        actor_id=actor,
        action_type=action,
        description="desc",
        resource_id=resource,
        audit_metadata=meta,
        ledger_hash=hashlib.sha256(payload.encode()).hexdigest(),
    )


def _chained(actions):
    rows, prev = [], "0" * 64
    for action in actions:
        row = _row(action, prev=prev)
        rows.append(row)
        prev = row.ledger_hash
    return rows


def test_chain_verifies_and_detects_tamper() -> None:
    """Shared verifier passes intact chains and pinpoints the break."""
    rows = _chained(["transaction.received", "decision.created"])
    valid, broken, checked = verify_ledger_chain(rows)
    assert (valid, broken, checked) == (True, None, 2)

    rows[1] = SimpleNamespace(**{**vars(rows[1]), "description": "forged"})
    valid, broken, checked = verify_ledger_chain(rows)
    assert valid is False
    assert broken == str(rows[1].id)
    assert checked == 1


@pytest.mark.anyio
@requires_db
async def test_lifecycle_reconstructs_in_order(api_client, db_session) -> None:
    """Full intercept lifecycle replays from the ledger in execution order."""
    from app.models.banking import Account, Customer

    customer_id = uuid.uuid4()
    db_session.add(
        Customer(
            id=customer_id, first_name="Ada", last_name="Audit",
            email=f"ada_{customer_id.hex[:6]}@aegisai.test",
            risk_level="low", status="active",
        )
    )
    await db_session.commit()
    db_session.add(
        Account(
            id=uuid.uuid4(), customer_id=customer_id,
            account_number=f"AUD-{uuid.uuid4().hex[:10].upper()}",
            account_type="checking", balance=5000.00, currency="USD", status="active",
        )
    )
    await db_session.commit()

    res = await api_client.post(
        "/api/v1/transactions/intercept",
        json={"customer_id": str(customer_id), "amount": 250.0, "currency": "USD"},
    )
    assert res.status_code == 201, res.text
    tx_id = res.json()["transaction_id"]

    hist = await api_client.get(f"/api/v1/audit/transaction/{tx_id}")
    assert hist.status_code == 200, hist.text
    types = [e["event_type"] for e in hist.json()["events"]]
    for expected in LIFECYCLE_TYPES:
        assert expected in types, f"missing {expected}"
    # Execution order preserved
    positions = [types.index(t) for t in LIFECYCLE_TYPES]
    assert positions == sorted(positions)
    # Every event carries the correlation ID and an actor slot
    for event in hist.json()["events"]:
        assert event["transaction_id"] == tx_id
        assert event["actor"] is not None
        assert event["ledger_hash"]

    verify = await api_client.get(f"/api/v1/audit/transaction/{tx_id}/verify")
    assert verify.status_code == 200, verify.text
    assert verify.json()["valid"] is True

    # Human decisions append; they never rewrite AI history. When this run
    # lands under review, resolve it and prove the original rows are intact.
    if res.json()["verdict"] == "under_review":
        from app.models.governance import TrustScore

        before_events = hist.json()["events"]
        first_hash = before_events[0]["ledger_hash"]
        trust_before = (
            await db_session.execute(
                select(TrustScore).where(TrustScore.transaction_id == uuid.UUID(tx_id))
            )
        ).scalars().one()

        queue = await api_client.get("/api/v1/reviews/queue")
        review_id = next(
            r["id"] for r in queue.json() if r["transaction_id"] == tx_id
        )
        action = await api_client.post(
            f"/api/v1/reviews/{review_id}/action",
            json={"status": "approved", "comments": "audit trail verification approval"},
        )
        assert action.status_code == 200, action.text

        after = await api_client.get(f"/api/v1/audit/transaction/{tx_id}")
        after_types = [e["event_type"] for e in after.json()["events"]]
        assert after_types[: len(before_events)] == [e["event_type"] for e in before_events]
        assert after.json()["events"][0]["ledger_hash"] == first_hash
        assert len(after.json()["events"]) > len(before_events)  # appended, not edited
        await db_session.refresh(trust_before)
        assert trust_before.score == res.json()["trust_score"]
