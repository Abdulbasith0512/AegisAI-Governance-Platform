from typing import Any, Dict, List
import time
from agents.base import BaseGovernanceAgent
from ml.models import fraud_estimator, behavior_estimator

class FraudAgent(BaseGovernanceAgent):
    """
    Evaluates transaction payment parameters to detect immediate fraud anomalies.
    Integrates Random Forest/Gradient Boosting and Isolation Forest estimators.
    """
    def __init__(self) -> None:
        super().__init__(name="FraudAgent")

    async def _execute(self, state: Dict[str, Any], logs: List[str]) -> Dict[str, Any]:
        tx_data = state.get("transaction", {})
        amount = float(tx_data.get("amount", 0.0))
        
        # Check context from prior device and kyc evaluations if present
        device_result = state.get("device_result")
        device_conf = 1.0
        if device_result:
            if isinstance(device_result, dict):
                device_conf = device_result.get("confidence_score", 1.0)
            else:
                device_conf = getattr(device_result, "confidence_score", 1.0)

        kyc_result = state.get("kyc_result")
        kyc_conf = 1.0
        if kyc_result:
            if isinstance(kyc_result, dict):
                kyc_conf = kyc_result.get("confidence_score", 1.0)
            else:
                kyc_conf = getattr(kyc_result, "confidence_score", 1.0)

        # Map to features
        is_emulator = bool(device_conf < 0.50)
        risk_level = "high" if kyc_conf < 0.80 else "medium"

        logs.append(f"Evaluating transaction amount {amount} USD for fraud anomalies. Emulator trigger: {is_emulator}")
        
        # Formulate features for ML models
        fraud_features = {
            "amount": amount,
            "device_is_emulator": is_emulator,
            "location_match": True,
            "customer_risk": risk_level
        }
        
        # 1. Run Fraud ML Estimator
        t_start = time.perf_counter()
        fraud_prob = fraud_estimator.predict_proba(fraud_features)
        fraud_conf = fraud_estimator.confidence_score(fraud_features)
        t_end = time.perf_counter()
        logs.append(f"Fraud Classifier score: {fraud_prob:.4f} (latency: {(t_end - t_start)*1000:.2f}ms)")

        # 2. Run Behavior Anomaly ML Estimator (Isolation Forest)
        behavior_features = {
            "amount": amount,
            "velocity": float(state.get("velocity", 1.0)),
            "location_distance": float(state.get("location_distance", 0.0))
        }
        t_start = time.perf_counter()
        behavior_prob = behavior_estimator.predict_proba(behavior_features)
        behavior_conf = behavior_estimator.confidence_score(behavior_features)
        t_end = time.perf_counter()
        logs.append(f"Behavior Anomaly Classifier score: {behavior_prob:.4f} (latency: {(t_end - t_start)*1000:.2f}ms)")

        # Combined scoring (Average of safety trust scores)
        combined_score = float((fraud_conf + behavior_conf) / 2)
        
        # Save metrics back into the state for explainability SHAP attributions
        state["fraud_prob"] = fraud_prob
        state["behavior_prob"] = behavior_prob
        state["fraud_features"] = fraud_features
        state["behavior_features"] = behavior_features

        if combined_score < 0.70 or is_emulator:
            logs.append("Warning: Model indicates high probability of payment or behavioral risk.")
            return {
                "confidence_score": min(combined_score, 0.45 if is_emulator else combined_score),
                "reasoning": f"High risk: models flagged suspicious pattern (fraud prob: {fraud_prob:.2f}, behavior prob: {behavior_prob:.2f}).",
                "risk_score": float(1.0 - combined_score),
                "flags": ["fraud_model_flag"] + (["emulator_trigger"] if is_emulator else []),
                "evidence": {
                    "fraud_prob": float(fraud_prob),
                    "behavior_prob": float(behavior_prob),
                    "location_match_assumed": True,
                },
                "model": "rf-gbc-ensemble-v1+isolation-forest-v1",
                "placeholder": False,
            }

        return {
            "confidence_score": combined_score,
            "reasoning": "Low risk: transaction matches expected behavior clusters.",
            "risk_score": float(1.0 - combined_score),
            "flags": [],
            "evidence": {
                "fraud_prob": float(fraud_prob),
                "behavior_prob": float(behavior_prob),
                "location_match_assumed": True,
            },
            "model": "rf-gbc-ensemble-v1+isolation-forest-v1",
            "placeholder": False,
        }
