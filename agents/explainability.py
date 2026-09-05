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

        upstream = [
            ("DeviceAgent", state.get("device_result")),
            ("KYCAgent", state.get("kyc_result")),
            ("FraudAgent", state.get("fraud_result")),
            ("AMLAgent", state.get("aml_result")),
            ("PolicyAgent", state.get("policy_result")),
        ]

        def _get(res: Any, key: str, default: Any = None) -> Any:
            if res is None:
                return default
            if isinstance(res, dict):
                return res.get(key, default)
            return getattr(res, key, default)

        # Gathers logs and warnings from real upstream confidences
        warnings = []
        if fraud_result := state.get("fraud_result"):
            if (_get(fraud_result, "confidence_score", 1.0) or 1.0) < 0.60:
                warnings.append("Suspicious transaction behavior or fraud risk flagged.")
        if aml_result := state.get("aml_result"):
            if (_get(aml_result, "confidence_score", 1.0) or 1.0) < 0.60:
                warnings.append("AML layering/smurfing graph loop indices flagged.")
        if device_result := state.get("device_result"):
            if (_get(device_result, "confidence_score", 1.0) or 1.0) < 0.60:
                warnings.append("Emulator terminal profile signature matched.")
        if kyc_result := state.get("kyc_result"):
            if (_get(kyc_result, "confidence_score", 1.0) or 1.0) < 0.60:
                warnings.append("KYC status mismatch or Pep watchlist registration matched.")
        if policy_result := state.get("policy_result"):
            if (_get(policy_result, "confidence_score", 1.0) or 1.0) < 1.00:
                warnings.append("Regulatory currency or volume thresholds breached.")

        # Structured per-agent evidence with MEASURED durations (missing
        # results are marked skipped, never filled with canned timings).
        agents_trace = []
        for name, res in upstream:
            if res is None:
                agents_trace.append({"name": name, "status": "skipped", "execution_time_ms": 0.0})
                continue
            agents_trace.append({
                "name": _get(res, "agent_name", name) or name,
                "status": _get(res, "status", "failed"),
                "confidence": _get(res, "confidence_score", 0.0),
                "execution_time_ms": round(float(_get(res, "execution_time", 0.0) or 0.0) * 1000, 2),
                "evidence": _get(res, "evidence", {}) or {},
            })

        # Entity nodes + real policy outcomes from the policy simulation.
        tx_data = state.get("transaction", {}) or {}
        entities = [
            {"id": "source_account", "type": "account", "label": "Source account", "status": "active"},
            {
                "id": "device_terminal", "type": "device", "label": "Client device",
                "status": "risk" if any("emulator" in w.lower() for w in warnings) else "passed",
            },
        ]
        policies_checked: List[Dict[str, Any]] = []
        policy_sim = state.get("policy_simulation") or {}
        for policy in policy_sim.get("policies_checked", []) or []:
            if not isinstance(policy, dict):
                continue
            status = str(policy.get("status", "unknown"))
            policies_checked.append({
                "policy_id": str(policy.get("policy_id", "unknown")),
                "name": str(policy.get("name", policy.get("policy_id", "unknown"))),
                "status": status,
            })
            entities.append({
                "id": str(policy.get("policy_id", "policy")),
                "type": "policy",
                "label": str(policy.get("name", policy.get("policy_id", "policy"))),
                "status": "failed" if status == "fail" else "passed",
            })

        agent_traces = {
            "warnings": warnings,
            "agents": agents_trace,
            "entities": entities,
            "policies": policies_checked,
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
            "evidence": {
                "warnings": warnings,
                "feature_importance": res.get("feature_importance", {}),
            },
            "model": "attribution-placeholder-v1",
            "placeholder": True,
        }
