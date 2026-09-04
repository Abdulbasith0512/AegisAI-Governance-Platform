from typing import Any, Dict, List
import time
from agents.base import BaseGovernanceAgent
from ml.models import aml_estimator

def get_field(obj: Any, key: str, default: Any = None) -> Any:
    if not obj:
        return default
    if isinstance(obj, dict):
        return obj.get(key, default)
    return getattr(obj, key, default)

class AMLAgent(BaseGovernanceAgent):
    """
    Scans relational transfer networks for structuring (smurfing) and layering graph loops.
    """
    def __init__(self) -> None:
        super().__init__(name="AMLAgent")

    async def _execute(self, state: Dict[str, Any], logs: List[str]) -> Dict[str, Any]:
        tx_data = state.get("transaction", {})
        ref = get_field(tx_data, "reference_number", "")
        amount = float(get_field(tx_data, "amount", 0.0))
        customer_id = get_field(tx_data, "customer_id")
        beneficiary_id = get_field(tx_data, "beneficiary_id")
        
        logs.append(f"Scanning transfer graph pathways for customer: {customer_id}")
        
        # Prepare graph features
        features = {
            "amount": amount,
            "customer_id": customer_id,
            "beneficiary_id": beneficiary_id,
            "history": state.get("history", [])
        }

        t_start = time.perf_counter()
        risk_score = aml_estimator.predict_proba(features)
        confidence = aml_estimator.confidence_score(features)
        t_end = time.perf_counter()

        logs.append(f"AML Graph Analyzer score: {risk_score:.4f} (latency: {(t_end - t_start)*1000:.2f}ms)")
        
        state["aml_prob"] = risk_score

        if risk_score > 0.40:
            logs.append("Warning: AML structuring or transfer cycle loop indicators matched.")
            return {
                "confidence_score": confidence,
                "reasoning": f"High risk: structuring bounds or graph loops detected (AML risk: {risk_score:.2f}).",
                "risk_score": float(risk_score),
                "flags": ["structuring_or_cycle"],
                "evidence": {"amount": amount, "customer_id": str(customer_id), "beneficiary_id": str(beneficiary_id)},
                "model": "networkx-structuring-v1",
                "placeholder": False,
            }

        return {
            "confidence_score": confidence,
            "reasoning": "Low risk: no matching money laundering structures found.",
            "risk_score": float(risk_score),
            "flags": [],
            "evidence": {"amount": amount, "customer_id": str(customer_id), "beneficiary_id": str(beneficiary_id)},
            "model": "networkx-structuring-v1",
            "placeholder": False,
        }
