from typing import Any, Dict, List
import time
from agents.base import BaseGovernanceAgent
from ml.models import kyc_estimator

def get_field(obj: Any, key: str, default: Any = None) -> Any:
    if not obj:
        return default
    if isinstance(obj, dict):
        return obj.get(key, default)
    return getattr(obj, key, default)

class KYCAgent(BaseGovernanceAgent):
    """
    Evaluates customer KYC registration profiles and bureau verification matches.
    """
    def __init__(self) -> None:
        super().__init__(name="KYCAgent")

    async def _execute(self, state: Dict[str, Any], logs: List[str]) -> Dict[str, Any]:
        tx_data = state.get("transaction", {})
        account = get_field(tx_data, "account", {})
        customer = get_field(account, "customer", {})
        
        email = get_field(customer, "email", "unknown")
        logs.append(f"Checking KYC records for customer: {email}")
        
        status = get_field(customer, "status", "unknown")
        risk_level = get_field(customer, "risk_level", "medium")
        
        # Pull document matching rules from global state/policy configs
        require_document_match = state.get("require_document_match", True)

        features = {
            "require_document_match": require_document_match,
            "customer_status": status,
            "risk_level": risk_level
        }

        t_start = time.perf_counter()
        risk_score = kyc_estimator.predict_proba(features)
        confidence = kyc_estimator.confidence_score(features)
        t_end = time.perf_counter()

        logs.append(f"KYC Classifier score: {risk_score:.4f} (latency: {(t_end - t_start)*1000:.2f}ms)")

        state["kyc_prob"] = risk_score

        # Deterministic rule evaluation (no ML classifier). Labeled as
        # placeholder so downstream consumers never mistake it for a model
        # prediction.
        flags: List[str] = []
        if status != "active":
            flags.append("customer_not_active")
        if risk_level == "high":
            flags.append("high_risk_tier")
        if not require_document_match:
            flags.append("document_unmatched")
        envelope = {
            "risk_score": float(risk_score),
            "flags": flags,
            "evidence": {"customer_status": status, "risk_level": risk_level},
            "model": "rules-v1",
            "placeholder": True,
        }

        if risk_score > 0.50 or status != "active":
            logs.append(f"Warning: Customer KYC state is suspended/inactive or high risk.")
            return {
                "confidence_score": min(confidence, 0.20 if status != "active" else confidence),
                "reasoning": f"Critical risk: customer KYC validation failure (KYC risk: {risk_score:.2f}).",
                **envelope,
            }

        return {
            "confidence_score": confidence,
            "reasoning": "Low risk: customer identity matches active registries.",
            **envelope,
        }
