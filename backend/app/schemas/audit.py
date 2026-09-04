import uuid
from datetime import datetime
from typing import Any, Dict, List, Optional
from pydantic import BaseModel, Field, ConfigDict

class AuditEventOut(BaseModel):
    """One immutable ledger event for a transaction lifecycle."""
    id: uuid.UUID
    transaction_id: Optional[str] = Field(None, description="Correlated transaction (resource_id).")
    event_type: str = Field(..., description="Lifecycle event type, e.g. decision.created.")
    actor: Optional[str] = Field(None, description="Actor email, or 'system' for automated stages.")
    timestamp: datetime
    payload: Optional[Dict[str, Any]] = None
    ledger_hash: str

    model_config = ConfigDict(from_attributes=True)

class AuditHistoryOut(BaseModel):
    """Ordered lifecycle ledger for one transaction."""
    transaction_id: str
    events: List[AuditEventOut]

class AuditVerifyOut(BaseModel):
    """Hash-chain verification verdict over a transaction slice."""
    transaction_id: str
    valid: bool
    checked: int = Field(..., description="Ledger rows replayed from genesis through the slice.")
    broken_at: Optional[str] = Field(None, description="First failing row ID, if any.")
