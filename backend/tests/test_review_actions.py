"""Tests for human-review RBAC and verdict actions.

Pure tier (schema + permission-closure + no-token auth) runs wherever the
backend dependencies exist. DB tier reuses the phase-2 harness and is
gated on TEST_DATABASE_URL.
"""

import uuid
from datetime import datetime, timedelta
from types import SimpleNamespace

import pytest

pytest.importorskip("fastapi")

from app.schemas.review import ReviewActionRequest

try:
    from pydantic import ValidationError
except ImportError:  # pragma: no cover
    from pydantic_core import ValidationError


def _role(name, permissions):
    return SimpleNamespace(
        name=name, permissions=[SimpleNamespace(name=p) for p in permissions]
    )


def test_action_schema_rejects_short_comments() -> None:
    """Reviewer reason is mandatory (min 10 chars) at the schema boundary."""
    with pytest.raises(ValidationError):
        ReviewActionRequest(status="approved", comments="ok")


def test_action_schema_rejects_unknown_status() -> None:
    """Only approved / rejected / escalated pass validation."""
    with pytest.raises(ValidationError):
        ReviewActionRequest(status="deleted", comments="detailed reason here")


def test_action_schema_accepts_all_verdicts() -> None:
    """Approve / Reject / Escalate all validate."""
    for status in ("approved", "rejected", "escalated"):
        req = ReviewActionRequest(status=status, comments="detailed reason here")
        assert req.status == status


async def test_require_permission_allows_granted_scope() -> None:
    """Auditor holding write:policies passes the action guard."""
    from app.core.dependencies import require_permission

    user = SimpleNamespace(id=uuid.uuid4(), role=_role("auditor", ["write:policies"]))
    assert require_permission("write:policies")(user) is user


async def test_require_permission_denies_missing_scope() -> None:
    """Authenticated user without the scope is rejected (403 path)."""
    from app.core.dependencies import require_permission
    from app.core.exceptions import AuthenticationException

    user = SimpleNamespace(id=uuid.uuid4(), role=_role("viewer", ["read:transactions"]))
    with pytest.raises(AuthenticationException):
        require_permission("write:policies")(user)


async def test_require_permission_admin_bypass() -> None:
    """Admin role passes regardless of explicit permission grants."""
    from app.core.dependencies import require_permission

    user = SimpleNamespace(id=uuid.uuid4(), role=_role("admin", []))
    assert require_permission("write:policies")(user) is user


async def test_no_token_rejected_outside_development(monkeypatch) -> None:
    """No bearer token outside dev mode is an authentication failure."""
    from app.config.loader import settings
    from app.core.dependencies import get_token_payload
    from app.core.exceptions import AuthenticationException

    monkeypatch.setattr(settings, "ENVIRONMENT", "production")
    with pytest.raises(AuthenticationException):
        await get_token_payload(token=None, redis=None)


async def test_invalid_token_rejected() -> None:
    """Forged bearer tokens never authenticate."""
    from app.core.dependencies import get_token_payload
    from app.core.exceptions import AuthenticationException

    class _Redis:
        async def exists(self, key):
            return False

    with pytest.raises(AuthenticationException):
        await get_token_payload(token="forged.token.value", redis=_Redis())


from .conftest import requires_db

pytestmark_needs_db = requires_db


async def _seed_pending_review(db_session):
    from app.models.banking import Customer, Account
    from app.models.transactions import Transaction
    from app.models.governance import HumanReview, TrustScore

    customer_id = uuid.uuid4()
    db_session.add(
        Customer(
            id=customer_id,
            first_name="Ruth",
            last_name="Review",
            email=f"ruth_{customer_id.hex[:6]}@aegisai.test",
            risk_level="medium",
            status="active",
        )
    )
    await db_session.commit()
    account = Account(
        id=uuid.uuid4(),
        customer_id=customer_id,
        account_number=f"RVW-{uuid.uuid4().hex[:10].upper()}",
        account_type="checking",
        balance=10000.00,
        currency="USD",
        status="active",
    )
    db_session.add(account)
    await db_session.commit()
    tx = Transaction(
        id=uuid.uuid4(),
        account_id=account.id,
        amount=4800.00,
        currency="USD",
        transaction_type="transfer",
        status="under_review",
        reference_number=f"TX-{uuid.uuid4().hex[:12].upper()}",
    )
    db_session.add(tx)
    await db_session.commit()
    db_session.add(
        TrustScore(
            id=uuid.uuid4(),
            transaction_id=tx.id,
            score=68,
            weights_configuration={"agent": 1.0},
            reasons={"warnings": ["structuring band"]},
        )
    )
    review = HumanReview(
        id=uuid.uuid4(),
        transaction_id=tx.id,
        status="pending",
        assigned_at=datetime.utcnow(),
        sla_deadline=datetime.utcnow() + timedelta(hours=4),
    )
    db_session.add(review)
    await db_session.commit()
    return review, tx


@pytestmark_needs_db
async def test_approve_action_persists_all_identities(api_client, db_session) -> None:
    """Approve: reviewer stamped, timestamped, decided with reason; tx flips; audit row; AI score untouched."""
    from sqlalchemy import select
    from app.models.governance import AuditLog, HumanReview, TrustScore
    from app.models.transactions import Transaction

    review, tx = await _seed_pending_review(db_session)
    res = await api_client.post(
        f"/api/v1/reviews/{review.id}/action",
        json={"status": "approved", "comments": "verified legitimate business transfer"},
    )
    assert res.status_code == 200, res.text
    assert res.json()["review_id"] == str(review.id)

    await db_session.refresh(review)
    assert review.status == "approved"
    assert review.reviewer_id is not None  # stamp-if-empty preserved identity
    assert review.reviewed_at is not None
    assert review.comments == "verified legitimate business transfer"

    await db_session.refresh(tx)
    assert tx.status == "approved"
    assert tx.completed_at is not None

    audits = (
        await db_session.execute(select(AuditLog).where(AuditLog.resource_id == str(review.id)))
    ).scalars().all()
    assert any(a.action_type == "review_approved" and a.actor_id is not None for a in audits)

    score = (
        await db_session.execute(select(TrustScore).where(TrustScore.transaction_id == tx.id))
    ).scalars().one()
    assert score.score == 68  # original AI decision preserved


@pytestmark_needs_db
async def test_reject_and_escalate_transitions(api_client, db_session) -> None:
    """Reject declines the transaction; escalate keeps it under review."""
    from app.models.transactions import Transaction

    review, tx = await _seed_pending_review(db_session)
    res = await api_client.post(
        f"/api/v1/reviews/{review.id}/action",
        json={"status": "rejected", "comments": "confirmed structuring pattern present"},
    )
    assert res.status_code == 200, res.text
    await db_session.refresh(tx)
    assert tx.status == "declined"

    review2, tx2 = await _seed_pending_review(db_session)
    res2 = await api_client.post(
        f"/api/v1/reviews/{review2.id}/action",
        json={"status": "escalated", "comments": "needs senior auditor second opinion"},
    )
    assert res2.status_code == 200, res2.text
    await db_session.refresh(review2)
    await db_session.refresh(tx2)
    assert review2.status == "escalated"
    assert tx2.status == "under_review"


@pytestmark_needs_db
async def test_resolved_case_is_immutable(api_client, db_session) -> None:
    """Second decision on a resolved case is rejected with 409."""
    review, _ = await _seed_pending_review(db_session)
    first = await api_client.post(
        f"/api/v1/reviews/{review.id}/action",
        json={"status": "approved", "comments": "verified legitimate business transfer"},
    )
    assert first.status_code == 200, first.text
    second = await api_client.post(
        f"/api/v1/reviews/{review.id}/action",
        json={"status": "rejected", "comments": "second thoughts should not apply here"},
    )
    assert second.status_code == 409, second.text


@pytestmark_needs_db
async def test_action_on_missing_case_404(api_client, db_session) -> None:
    """Unknown review IDs 404 instead of creating phantom decisions."""
    res = await api_client.post(
        f"/api/v1/reviews/{uuid.uuid4()}/action",
        json={"status": "approved", "comments": "no such case exists here"},
    )
    assert res.status_code == 404, res.text
