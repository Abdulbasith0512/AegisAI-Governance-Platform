import logging
import re
import uuid
from typing import Any, Dict, List
from agents.base import BaseGovernanceAgent, AgentResponse
from app.services.trust_engine import WeightedTrustEngine
from app.schemas.trust import TrustCalculationRequest

logger = logging.getLogger("aegisai.agents.SupervisorAgent")

SUPERVISOR_VERDICTS = ("approved", "declined", "under_review")

# Agents the supervisor requires before aggregating. Determined here —
# not scattered across the graph — so a missing result is an explicit,
# logged failure instead of a silent default.
REQUIRED_AGENTS = (
    "device_result",
    "kyc_result",
    "fraud_result",
    "aml_result",
    "policy_result",
    "explainability_result",
)

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
        
        # 1. Fetch outputs from preceding nodes.
        # Fail-closed: a missing or failed agent contributes 0.0 confidence
        # (full risk) instead of silently approving. Failures are flagged
        # and floor the verdict at human review.
        results: Dict[str, Any] = {}
        failed_agents: List[str] = []
        for key in REQUIRED_AGENTS:
            res = state.get(key)
            results[key] = res
            if res is None or getattr(res, "status", "failed") != "success":
                failed_agents.append(key)
                logs.append(f"Agent {key} missing or failed; treating as full risk (fail-closed).")

        def _conf(key: str) -> float:
            res = results[key]
            if res is None or getattr(res, "status", "failed") != "success":
                return 0.0
            return float(getattr(res, "confidence_score", 0.0))

        device_result = results["device_result"]
        kyc_result = results["kyc_result"]
        fraud_result = results["fraud_result"]
        aml_result = results["aml_result"]
        policy_result = results["policy_result"]
        explain_result = results["explainability_result"]

        dev_conf = _conf("device_result")
        kyc_conf = _conf("kyc_result")
        fraud_conf = _conf("fraud_result")
        policy_conf = _conf("policy_result")
        aml_conf = _conf("aml_result")

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

        try:
            from app.services.event_bus import emit_event, TRUST_CALCULATED

            await emit_event(
                TRUST_CALCULATED,
                "success",
                agent=self.name,
                metadata={"trust_score": trust_score, "consensus_ratio": consensus_ratio},
            )
        except Exception:
            pass

        # Scale down trust score if safety warning checks are hit (e.g. emulator detected or high fraud risk)
        if dev_conf < 0.50 or fraud_conf < 0.50 or aml_conf < 0.50:
            trust_score = min(trust_score, 70)
            logs.append(f"Trust Score adjusted due to agent safety triggers.")

        logs.append(f"Dynamic Trust Score calculated: {trust_score}/100")

        # 3. Determine final transaction verdict.
        # Any agent failure floors the verdict at human review — a crashed
        # agent must never silently approve a transaction.
        if not policy_passed or aml_conf < 0.30 or trust_score < 50:
            verdict = "declined"
            reasoning = "Transaction declined: failed strict security and compliance policy limits."
        elif failed_agents or trust_score < 75 or dev_conf < 0.50 or fraud_conf < 0.50:
            verdict = "under_review"
            if failed_agents:
                reasoning = (
                    "Transaction pending: agent failure(s) "
                    f"({', '.join(failed_agents)}) require Human-in-the-Loop review."
                )
            else:
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

        # Structured final decision — the single source of truth. The legacy
        # reasoning string below is rendered FROM this dict so both formats
        # can never diverge.
        def _envelope(key: str) -> Dict[str, Any]:
            res = results[key]
            if res is None:
                return {
                    "agent": key, "status": "failed", "risk_score": 1.0,
                    "flags": ["agent_missing"], "evidence": {},
                    "confidence": 0.0, "latency_ms": 0.0,
                }
            get = (lambda k, d=None: res.get(k, d)) if isinstance(res, dict) else (lambda k, d=None: getattr(res, k, d))
            return {
                "agent": get("agent_name", key) or key,
                "status": get("status", "failed"),
                "risk_score": float(get("risk_score", 0.0) or 0.0),
                "flags": list(get("flags", []) or []),
                "evidence": dict(get("evidence", {}) or {}),
                "confidence": float(get("confidence_score", 0.0) or 0.0),
                "latency_ms": round(float(get("execution_time", 0.0) or 0.0) * 1000, 2),
            }

        decision = {
            "verdict": verdict,
            "trust_score": trust_score,
            "failed_agents": failed_agents,
            "per_agent": [_envelope(k) for k in REQUIRED_AGENTS],
            "consensus_ratio": consensus_ratio,
            "consensus_votes": dict(state["consensus_votes"]),
            "trust_weights": weights_config,
            "trust_reasons": reasons,
        }
        state["supervisor_decision"] = decision

        # Final verdict explanation assembled from structured evidence only.
        # Answers: decision, why, contributors, risk signals, policies,
        # review requirement — every sentence cites its evidence source.
        try:
            from app.services.explainability import build_decision_explanation

            policy_overall = None
            policy_sim = state.get("policy_simulation") or {}
            if isinstance(policy_sim, dict):
                policy_overall = policy_sim.get("overall_status")
            state["decision_explanation"] = build_decision_explanation(
                decision=decision,
                trust_score=trust_score,
                policy_status=policy_overall,
                requires_human_review=bool(verdict == "under_review"),
            )
        except Exception as e:
            logger.warning("Decision explanation build failed: %s", e)

        return {
            "confidence_score": float(trust_score / 100),
            "reasoning": (
                f"verdict: {verdict} | trust_score: {trust_score} | "
                f"reasoning: {reasoning} | {explanation}"
            )
        }
