import logging
import re
import uuid
from typing import Any, Dict, List
from agents.base import BaseGovernanceAgent, AgentResponse
from app.services.trust_engine import WeightedTrustEngine
from app.schemas.trust import TrustCalculationRequest

logger = logging.getLogger("aegisai.agents.SupervisorAgent")

SUPERVISOR_VERDICTS = ("approved", "declined", "under_review")

_verdict_prefix_re = re.compile(r"verdict\s*:\s*(approved|declined|under_review)", re.IGNORECASE)


def parse_supervisor_verdict(supervisor_result: Any) -> str:
    """Extract the structured verdict from a supervisor result.

    The supervisor emits ``verdict: <verdict> | trust_score: ...`` as the
    reasoning prefix. Parse that prefix instead of substring-matching the
    whole reasoning text (explanation prose may contain words like
    "declined"). Falls back to legacy substring matching, then "approved".
    """
    if supervisor_result is None:
        return "approved"
    if isinstance(supervisor_result, dict):
        reasoning = supervisor_result.get("reasoning", "")
    else:
        reasoning = getattr(supervisor_result, "reasoning", "")
    text = str(reasoning or "")
    m = _verdict_prefix_re.search(text)
    if m:
        return m.group(1).lower()
    lowered = text.lower()
    if "under_review" in lowered:
        return "under_review"
    if "declined" in lowered:
        return "declined"
    return "approved"

class SupervisorAgent(BaseGovernanceAgent):
    """
    Coordinates agent outputs, calculates trust index scores, and resolves transaction verdicts.
    """
    def __init__(self) -> None:
        super().__init__(name="SupervisorAgent")
        self.trust_engine = WeightedTrustEngine()

    async def _execute(self, state: Dict[str, Any], logs: List[str]) -> Dict[str, Any]:
        logs.append("Evaluating multi-agent outcomes to determine transaction governance verdict.")
        
        # 1. Fetch outputs from preceding nodes
        device_result: AgentResponse = state.get("device_result")
        kyc_result: AgentResponse = state.get("kyc_result")
        fraud_result: AgentResponse = state.get("fraud_result")
        aml_result: AgentResponse = state.get("aml_result")
        policy_result: AgentResponse = state.get("policy_result")
        explain_result: AgentResponse = state.get("explainability_result")

        # Fallback values if any agent failed or is missing
        dev_conf = device_result.confidence_score if device_result and device_result.status == "success" else 1.0
        kyc_conf = kyc_result.confidence_score if kyc_result and kyc_result.status == "success" else 1.0
        fraud_conf = fraud_result.confidence_score if fraud_result and fraud_result.status == "success" else 1.0
        policy_conf = policy_result.confidence_score if policy_result and policy_result.status == "success" else 1.0
        aml_conf = aml_result.confidence_score if aml_result and aml_result.status == "success" else 1.0

        # Calculate consensus score: ratio of agents agreeing on approval
        votes = [
            1.0 if dev_conf >= 0.5 else 0.0,
            1.0 if kyc_conf >= 0.5 else 0.0,
            1.0 if fraud_conf >= 0.5 else 0.0,
            1.0 if policy_conf >= 0.5 else 0.0,
            1.0 if aml_conf >= 0.5 else 0.0,
        ]
        consensus_ratio = float(sum(votes) / len(votes))

        # Compile telemetry parameters
        tx_id = state.get("transaction", {}).get("id", uuid.uuid4())
        policy_passed = bool(policy_conf == 1.0)
        explain_score = 0.90
        if explain_result and explain_result.status == "success":
            explain_score = 0.95

        # 2. Invoke the real WeightedTrustEngine
        telemetry = TrustCalculationRequest(
            transaction_id=tx_id,
            agent_confidence=float(fraud_conf),
            historical_accuracy=0.96,
            model_drift=float(state.get("drift", 0.05)),
            data_quality=1.0,
            latency_ms=float(state.get("latency_ms", 12.5)),
            policy_compliance=policy_passed,
            explainability_score=explain_score,
            agent_consensus=consensus_ratio
        )

        trust_score, weights_config, reasons = self.trust_engine.calculate_score(telemetry)

        # Scale down trust score if safety warning checks are hit (e.g. emulator detected or high fraud risk)
        if dev_conf < 0.50 or fraud_conf < 0.50 or aml_conf < 0.50:
            trust_score = min(trust_score, 70)
            logs.append(f"Trust Score adjusted due to agent safety triggers.")

        logs.append(f"Dynamic Trust Score calculated: {trust_score}/100")

        # 3. Determine final transaction verdict
        if not policy_passed or aml_conf < 0.30 or trust_score < 50:
            verdict = "declined"
            reasoning = "Transaction declined: failed strict security and compliance policy limits."
        elif trust_score < 75 or dev_conf < 0.50 or fraud_conf < 0.50:
            verdict = "under_review"
            reasoning = "Transaction pending: low trust score requires Human-in-the-Loop review."
        else:
            verdict = "approved"
            reasoning = "Transaction approved: complies with all risk parameters."

        logs.append(f"Final verdict resolved: {verdict}")

        explanation = explain_result.reasoning if explain_result else "No explanation generated."

        # Keep results in state for DB persistence in endpoints
        state["trust_score_value"] = trust_score
        state["trust_weights"] = weights_config
        state["trust_reasons"] = reasons
        state["consensus_ratio"] = consensus_ratio
        state["consensus_votes"] = {
            "device": "approve" if dev_conf >= 0.5 else "decline",
            "kyc": "approve" if kyc_conf >= 0.5 else "decline",
            "fraud": "approve" if fraud_conf >= 0.5 else "decline",
            "aml": "approve" if aml_conf >= 0.5 else "decline",
            "policy": "approve" if policy_conf >= 0.5 else "decline",
        }

        return {
            "confidence_score": float(trust_score / 100),
            "reasoning": (
                f"verdict: {verdict} | trust_score: {trust_score} | "
                f"reasoning: {reasoning} | {explanation}"
            )
        }
