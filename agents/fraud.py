from typing import Any, Dict, List
import statistics
import time
from agents.base import BaseGovernanceAgent
from ml.fraud_service import fraud_service
from ml.models import behavior_estimator

# Merchant category codes treated as elevated-risk for cash-out /
# structuring typologies. Documented heuristic input to the model vector,
# not a verdict by itself.
HIGH_RISK_MCC = {"4829", "6012", "6051", "7995", "7994"}
MED_RISK_MCC = {"5411", "5812", "5999", "5732"}


def mcc_risk_score(category: Any) -> float:
    code = str(category or "").strip()
    if code in HIGH_RISK_MCC:
        return 0.85
    if code in MED_RISK_MCC:
        return 0.5
    if code:
        return 0.2
    return 0.3  # unknown category -> documented median


class FraudAgent(BaseGovernanceAgent):
    """
    Evaluates transaction payment parameters with the versioned fraud
    baseline (calibrated gradient boosting, see ml/fraud_service.py).
    The Isolation Forest behavior signal is retained as a second opinion.
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

        # Assemble the 8-feature vector from live state. Nothing here is
        # invented: missing signals are imputed with documented medians by
        # the service and reported in evidence.imputed.
        history = state.get("history", []) or []
        hist_amounts = [float(h.get("amount", 0.0)) for h in history if isinstance(h, dict)]
        if len(hist_amounts) >= 2:
            mean = statistics.fmean(hist_amounts)
            stdev = statistics.pstdev(hist_amounts) or 1.0
            history_z = (amount - mean) / stdev
        else:
            history_z = 0.0

        is_emulator = bool(device_conf < 0.50)
        model_features = {
            "amount": amount,
            "velocity_1h": float(state.get("velocity", 1.0)),
            "freq_24h": float(len(hist_amounts)),
            "merchant_category_risk": mcc_risk_score(tx_data.get("merchant_category")),
            "account_age_days": tx_data.get("account_age_days"),
            "failed_attempts": int(tx_data.get("failed_attempts", 0) or 0),
            "location_deviation_km": float(state.get("location_distance", 0.0)),
            "history_amount_zscore": history_z,
        }

        logs.append(
            f"Evaluating transaction amount {amount} with fraud baseline "
            f"{fraud_service.model_version}. Emulator trigger: {is_emulator}"
        )

        # 1. Versioned fraud baseline inference
        t_start = time.perf_counter()
        result = fraud_service.predict(model_features)
        t_end = time.perf_counter()
        fraud_prob = float(result["fraud_probability"])
        fraud_conf = float(result["confidence"])
        logs.append(
            f"Fraud baseline {result['model_version']}: prob={fraud_prob:.4f} "
            f"(latency: {(t_end - t_start)*1000:.2f}ms)"
        )
        if result["evidence"]["imputed"]:
            logs.append(f"Imputed signals: {', '.join(result['evidence']['imputed'])}")

        # 2. Behavior anomaly second opinion (Isolation Forest, unchanged)
        behavior_features = {
            "amount": amount,
            "velocity": float(state.get("velocity", 1.0)),
            "location_distance": float(state.get("location_distance", 0.0)),
        }
        behavior_prob = behavior_estimator.predict_proba(behavior_features)
        logs.append(f"Behavior Anomaly Classifier score: {behavior_prob:.4f}")

        # Save metrics back into the state for explainability attributions
        state["fraud_prob"] = fraud_prob
        state["behavior_prob"] = behavior_prob
        state["fraud_features"] = model_features

        flags = [f"fraud:{t['feature']}" for t in result["triggered_features"]]
        if is_emulator:
            flags.append("emulator_trigger")
        behavior_disagrees = bool((behavior_prob >= 0.5) != (fraud_prob >= 0.5))
        if behavior_disagrees:
            flags.append("behavior_disagreement")
            logs.append("Note: behavior model disagrees with fraud baseline.")

        envelope = {
            "risk_score": fraud_prob,
            "flags": flags,
            "evidence": {
                "fraud_probability": fraud_prob,
                "triggered_features": result["triggered_features"],
                "behavior_prob": float(behavior_prob),
                "behavior_disagreement": behavior_disagrees,
                "auxiliary_agrees": result["evidence"]["auxiliary_agrees"],
                "imputed": result["evidence"]["imputed"],
            },
            "model": result["model_version"],
            "placeholder": False,
        }

        if fraud_prob >= 0.50 or is_emulator:
            logs.append("Warning: Model indicates high probability of payment or behavioral risk.")
            return {
                "confidence_score": min(fraud_conf, 0.45 if is_emulator else fraud_conf),
                "reasoning": (
                    f"High risk: fraud baseline {result['model_version']} flagged suspicious "
                    f"pattern (fraud prob: {fraud_prob:.2f}, behavior prob: {behavior_prob:.2f})."
                ),
                **envelope,
            }

        return {
            "confidence_score": fraud_conf,
            "reasoning": "Low risk: transaction matches expected behavior clusters.",
            **envelope,
        }
