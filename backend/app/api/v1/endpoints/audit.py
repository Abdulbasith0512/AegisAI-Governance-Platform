import uuid
from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.dependencies import get_db, require_permission
from app.models.governance import AuditLog
from app.models.users import User
from app.repositories.audit import verify_ledger_chain
from app.schemas.audit import AuditEventOut, AuditHistoryOut, AuditVerifyOut

router = APIRouter(prefix="/audit", tags=["Audit Ledger"])


def _to_event(log: AuditLog) -> AuditEventOut:
    actor = "system"
    if log.actor is not None:
        actor = getattr(log.actor, "email", None) or str(log.actor_id)
    elif log.actor_id is not None:
        actor = str(log.actor_id)
    return AuditEventOut(
        id=log.id,
        transaction_id=log.resource_id,
        event_type=log.action_type,
        actor=actor,
        timestamp=log.created_at,
        payload=log.audit_metadata,
        ledger_hash=log.ledger_hash,
    )


async def _slice(db: AsyncSession, tx_id: uuid.UUID) -> List[AuditLog]:
    result = await db.execute(
        select(AuditLog)
        .where(AuditLog.resource_id == str(tx_id))
        .options(selectinload(AuditLog.actor))
        .order_by(AuditLog.created_at.asc(), AuditLog.id.asc())
    )
    return list(result.scalars().all())


@router.get("/transaction/{tx_id}", response_model=AuditHistoryOut)
async def get_transaction_audit_history(
    tx_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permission("read:transactions")),
) -> AuditHistoryOut:
    """Returns the ordered immutable ledger for one transaction lifecycle."""
    logs = await _slice(db, tx_id)
    return AuditHistoryOut(
        transaction_id=str(tx_id),
        events=[_to_event(log) for log in logs],
    )


@router.get("/transaction/{tx_id}/verify", response_model=AuditVerifyOut)
async def verify_transaction_audit_chain(
    tx_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permission("read:transactions")),
) -> AuditVerifyOut:
    """Replays the hash chain from genesis through this transaction's rows.

    A later human decision appends new rows; it can never invalidate the
    original AI rows, and any tampering breaks verification here.
    """
    head = await db.execute(
        select(AuditLog).order_by(AuditLog.created_at.asc(), AuditLog.id.asc())
    )
    logs = list(head.scalars().all())
    # Replay everything up to and including the slice's last row so the
    # chain links resolve from genesis (hashes chain globally, not per-tx).
    tx_ids = {str(log.id) for log in await _slice(db, tx_id)}
    ordered = sorted(logs, key=lambda log: (log.created_at, str(log.id)))
    cutoff = 0
    for i, log in enumerate(ordered):
        if str(log.id) in tx_ids:
            cutoff = i + 1
    relevant = ordered[:cutoff] if cutoff else []
    valid, broken_at, checked = verify_ledger_chain(relevant)
    if not relevant:
        return AuditVerifyOut(transaction_id=str(tx_id), valid=True, checked=0, broken_at=None)
    if not valid and broken_at not in tx_ids:
        # Breakage predates this transaction's slice; still report honestly.
        return AuditVerifyOut(
            transaction_id=str(tx_id), valid=False, checked=checked, broken_at=broken_at
        )
    return AuditVerifyOut(
        transaction_id=str(tx_id), valid=valid, checked=checked, broken_at=broken_at
    )
