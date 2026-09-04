from typing import Any, Dict, List
import uuid
import time
from agents.base import BaseGovernanceAgent
from app.services.explainability import DefaultExplainabilityEngine

class ExplainabilityAgent(BaseGovernanceAgent):
    """
    Formulates structured explanations detailing attributes contributing to agent risk scores.
    """
    def __init__(self) -> None:
        super().__init__(name="ExplainabilityAgent")
        self.engine = DefaultExplainabilityEngine()

    async def _execute(self, state: Dict[str, Any], logs: List[str]) -> Dict[str, Any]:
        logs.append("Synthesizing decision explainability profiles...")
        
        fraud_result = state.get("fraud_result")
        aml_result = state.get("aml_result")
        device_result = state.get("device_result")
        kyc_result = state.get("kyc_result")
        policy_result = state.get("policy_result")

        # Gathers logs and warnings
        warnings = []
        if fraud_result and getattr(fraud_result, "confidence_score", 1.0) < 0.60:
            warnings.append(f"Suspicious transaction behavior or fraud risk flagged.")
        if aml_result and getattr(aml_result, "confidence_score", 1.0) < 0.60:
            warnings.append(f"AML layering/smurfing graph loop indices flagged.")
        if device_result and getattr(device_result, "confidence_score", 1.0) < 0.60:
            warnings.append(f"Emulator terminal profile signature matched.")
        if kyc_result and getattr(kyc_result, "confidence_score", 1.0) < 0.60:
            warnings.append(f"KYC status mismatch or Pep watchlist registration matched.")
        if policy_result and getattr(policy_result, "confidence_score", 1.0) < 1.00:
            warnings.append(f"Regulatory currency or volume thresholds breached.")

        # Compile traces
        agent_traces = {
            "warnings": warnings,
            "timeline": [
                {"event": "Transaction Ingested", "duration_ms": 1.5, "status": "success"},
                {"event": "Device Evaluation Complete", "duration_ms": 12.4, "status": "success" if device_result else "skipped"},
                {"event": "KYC Identity Check Complete", "duration_ms": 14.8, "status": "success" if kyc_result else "skipped"},
                {"event": "Model Classifier Prediction Resolved", "duration_ms": 42.1, "status": "success" if fraud_result else "skipped"},
                {"event": "Compliance Policies Verified", "duration_ms": 8.2, "status": "success" if policy_result else "skipped"},
                {"event": "Final Decision Output Rendered", "duration_ms": 1.0, "status": "success"}
            ],
            "feature_importance": {
                "amount_value": 0.35 if (warnings and any("volume" in w.lower() for w in warnings)) else 0.05,
                "device_is_emulator": 0.65 if any("emulator" in w.lower() for w in warnings) else 0.05,
                "ip_velocity": 0.12,
                "kyc_risk_tier": 0.45 if any("kyc" in w.lower() for w in warnings) else 0.02,
                "aml_loops": 0.55 if any("aml" in w.lower() for w in warnings) else 0.03,
            }
        }

        prediction_id = state.get("prediction_id", uuid.uuid4())
        
        t_start = time.perf_counter()
        res = self.engine.generate_explanation(prediction_id, agent_traces)
        t_end = time.perf_counter()
        
        logs.append(f"Explainability traces compiled (latency: {(t_end - t_start)*1000:.2f}ms)")
        
        # Save output structures back to the state for repositories mapping
        state["explanation_data"] = res

        # Attribution map and timeline durations are deterministic
        # placeholders (not SHAP model output). Labeled so consumers know.
        return {
            "confidence_score": 1.00,
            "reasoning": f"Explanation: {res['human_readable']}",
            "risk_score": 0.00,
            "flags": [],
            "evidence": {"warnings": warnings, "feature_importance": agent_traces["feature_importance"]},
            "model": "attribution-placeholder-v1",
            "placeholder": True,
        }
