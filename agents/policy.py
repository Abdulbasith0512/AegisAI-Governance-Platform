from typing import Any, Dict, List
import time
from agents.base import BaseGovernanceAgent
from app.services.policy_engine import PolicyEngine

class PolicyAgent(BaseGovernanceAgent):
    """
    Validates proposed transaction metadata against strict banking constraints.
    Integrates the real backend PolicyEngine with policies.yaml configurations.
    """
    def __init__(self) -> None:
        super().__init__(name="PolicyAgent")
        self.engine = PolicyEngine()

    async def _execute(self, state: Dict[str, Any], logs: List[str]) -> Dict[str, Any]:
        tx_data = state.get("transaction", {})
        amount = float(tx_data.get("amount", 0.0))
        currency = tx_data.get("currency", "USD")
        
        logs.append(f"Checking transaction policies against currency: {currency} and amount: {amount}")
        
        t_start = time.perf_counter()
        
        # Build transaction representation matching dot-notation references in rules config
        # E.g. POL-KYC-303 evaluates account.status
        account_status = state.get("account_status", "active")
        
        tx_payload = {
            **tx_data,
            "account": {
                "status": account_status
            }
        }
        
        # Evaluate transaction through PolicyEngine
        res = self.engine.evaluate_transaction(tx_payload)
        
        t_end = time.perf_counter()
        logs.append(f"PolicyEngine execution complete. Status: {res.overall_status} (latency: {(t_end - t_start)*1000:.2f}ms)")

        # Map results to state for downstream consensus & supervisor
        state["policy_simulation"] = res.model_dump()
        
        reasons = []
        confidence = 1.00
        for policy in res.policies_checked:
            if policy.status == "fail":
                reasons.append(f"Policy violation: {policy.name} ({policy.policy_id})")
                confidence = 0.00 # Hard fail indicators

        if res.overall_status == "fail":
            logs.append("Warning: Transaction violates deterministic rule constraints.")
            return {
                "confidence_score": 0.00,
                "reasoning": "; ".join(reasons),
                "risk_score": 1.00,
                "flags": [f"policy_{p.policy_id}" for p in res.policies_checked if p.status == "fail"],
                "evidence": {"overall_status": res.overall_status, "policies_checked": res.model_dump().get("policies_checked", [])},
                "model": "yaml-policy-engine-v1",
                "placeholder": False,
            }

        return {
            "confidence_score": 1.00,
            "reasoning": "Policy checks passed successfully.",
            "risk_score": 0.00,
            "flags": [],
            "evidence": {"overall_status": res.overall_status},
            "model": "yaml-policy-engine-v1",
            "placeholder": False,
        }
