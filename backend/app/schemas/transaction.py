import uuid
from datetime import datetime
from typing import Dict, Any, Optional, List
from pydantic import BaseModel, Field, ConfigDict

class DeviceTelemetry(BaseModel):
    """Telemetry parameters for the device agent evaluation."""
    fingerprint: str = Field(..., description="Device fingerprint hash.")
    ip_address: str = Field(..., description="IP Address.")
    user_agent: Optional[str] = None
    os: Optional[str] = None
    is_emulator: bool = False
    location_lat: Optional[float] = None
    location_long: Optional[float] = None

class BeneficiaryTelemetry(BaseModel):
    """Telemetry parameters for the beneficiary."""
    beneficiary_account_number: str = Field(..., description="Account number of the recipient.")
    bank_code: str = Field(..., description="Routing bank code.")
    nickname: Optional[str] = None

class TransactionHistoryItem(BaseModel):
    """Single historical transaction entry supplied by the caller for AML context."""
    amount: float = Field(..., gt=0.0, description="Historical transaction amount.")
    timestamp: Optional[datetime] = None
    counterparty: Optional[str] = None
    status: Optional[str] = None

class TransactionInterceptRequest(BaseModel):
    """Payload representing a transaction intercepted by the governance control plane."""
    transaction_id: Optional[uuid.UUID] = None
    customer_id: uuid.UUID = Field(..., description="ID of the initiating customer.")
    merchant_id: Optional[uuid.UUID] = None
    merchant_category: Optional[str] = Field(None, min_length=2, max_length=10, description="Merchant category code (MCC).")
    amount: float = Field(..., gt=0.0, description="Transaction amount.")
    currency: str = Field("USD", min_length=3, max_length=3, description="ISO 3-letter currency code.")
    location: Optional[str] = None
    device: Optional[DeviceTelemetry] = None
    device_id: Optional[str] = Field(None, description="Device identifier alias (maps to device fingerprint when device object is absent).")
    ip_address: Optional[str] = Field(None, description="Source IP address (maps into device telemetry when device object is absent).")
    account_age_days: Optional[int] = Field(None, ge=0, description="Account age in days. Derived from account record when omitted.")
    failed_attempts: int = Field(0, ge=0, description="Recent failed attempt count for this customer.")
    transaction_history: Optional[List[TransactionHistoryItem]] = Field(None, description="Caller-supplied recent history for AML context.")
    channel: str = Field("mobile", description="Channel of execution (mobile, web, atm).")
    timestamp: datetime = Field(default_factory=datetime.utcnow)
    beneficiary: Optional[BeneficiaryTelemetry] = None
    transaction_type: str = Field("transfer", description="Type of transaction (transfer, payment, withdrawal).")
    metadata: Optional[Dict[str, Any]] = None

class TransactionInterceptResponse(BaseModel):
    """Verdicts and evaluations resulting from transaction pipeline orchestration."""
    transaction_id: uuid.UUID
    verdict: str = Field(..., description="Resolved final verdict: approved, declined, under_review.")
    trust_score: int = Field(..., ge=0, le=100, description="Combined safety trust rating.")
    reasons: List[str] = Field(default_factory=list, description="Reasoning and violations triggered by agents.")
    explanation: Optional[str] = Field(None, description="Human-readable decision trace details.")
    requires_human_review: bool = False
    review_id: Optional[uuid.UUID] = None

    model_config = ConfigDict(from_attributes=True)

class TransactionOut(BaseModel):
    """Detailed transaction data for ledger queries."""
    id: uuid.UUID
    account_id: uuid.UUID
    beneficiary_id: Optional[uuid.UUID] = None
    merchant_id: Optional[uuid.UUID] = None
    device_id: Optional[uuid.UUID] = None
    amount: float
    currency: str
    transaction_type: str
    status: str
    reference_number: str
    initiated_at: datetime
    completed_at: Optional[datetime] = None

    model_config = ConfigDict(from_attributes=True)

class TransactionDetailResponse(BaseModel):
    """Detailed transaction data combined with agent predictions and trust score context."""
    transaction: TransactionOut
    trust_score: Optional[int] = None
    policy_status: Optional[str] = None
    consensus_score: Optional[float] = None
    predictions: List[Dict[str, Any]] = []
    explanation: Optional[str] = None

    model_config = ConfigDict(from_attributes=True)

class ReplayResponse(BaseModel):
    """Status details resulting from transaction pipeline re-execution."""
    original_transaction_id: uuid.UUID
    new_transaction_id: uuid.UUID
    previous_verdict: str
    new_verdict: str
    previous_trust_score: int
    new_trust_score: int
    reprocessed_at: datetime
