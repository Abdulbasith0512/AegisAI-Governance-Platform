import hashlib
import json
import uuid
from typing import Any, Dict, List, Optional, Sequence, Tuple
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from app.models.governance import AuditLog


def _payload_data(
    actor_id: Optional[uuid.UUID],
    action_type: str,
    description: str,
    resource_id: Optional[str],
    metadata: Optional[Dict[str, Any]],
    prev_hash: str,
) -> str:
    """Canonical serialization. Must stay identical everywhere the chain
    is written or verified (single implementation)."""
    meta_str: str = json.dumps(metadata, sort_keys=True) if metadata else "{}"
    return (
        f"{actor_id or ''}|{action_type}|{description}|{resource_id or ''}|"
        f"{meta_str}|{prev_hash}"
    )


def verify_ledger_chain(logs: Sequence[AuditLog]) -> Tuple[bool, Optional[str], int]:
    """Replay a hash chain ordered oldest-first.

    Returns (valid, broken_log_id_or_None, checked_count). Pure function —
    shared by the copilot reporter and the audit verify endpoint.
    """
    prev_hash = "0" * 64
    checked = 0
    for log in logs:
        expected = hashlib.sha256(
            _payload_data(
                log.actor_id, log.action_type, log.description,
                log.resource_id, log.audit_metadata, prev_hash,
            ).encode("utf-8")
        ).hexdigest()
        if log.ledger_hash != expected:
            return False, str(log.id), checked
        prev_hash = log.ledger_hash
        checked += 1
    return True, None, checked

class AuditRepository:
    """
    Handles appending cryptographic ledger audit logs inside PostgreSQL.
    Enforces WORM-compliance via SHA-256 hashing links.
    """
    def __init__(self, db: AsyncSession) -> None:
        self.db = db

    async def log_action(
        self,
        action_type: str,
        description: str,
        actor_id: Optional[uuid.UUID] = None,
        resource_id: Optional[str] = None,
        metadata: Optional[Dict[str, Any]] = None
    ) -> AuditLog:
        """
        Creates and signs a new audit log record.
        Chains hashes: SHA256(Record_n + Hash_n-1).
        """
        # 1. Fetch previous hash
        prev_result = await self.db.execute(
            select(AuditLog).order_by(AuditLog.created_at.desc()).limit(1)
        )
        prev_log = prev_result.scalars().first()
        prev_hash: str = prev_log.ledger_hash if prev_log else "0" * 64

        # 2. Serialize payload details to build chain signature
        #    (canonical form shared with verify_ledger_chain)
        current_hash: str = hashlib.sha256(
            _payload_data(
                actor_id, action_type, description, resource_id, metadata, prev_hash
            ).encode("utf-8")
        ).hexdigest()

        # 4. Save audit log record
        log_record = AuditLog(
            actor_id=actor_id,
            action_type=action_type,
            description=description,
            resource_id=resource_id,
            audit_metadata=metadata,
            ledger_hash=current_hash
        )

        self.db.add(log_record)
        await self.db.commit()
        await self.db.refresh(log_record)
        return log_record
