from typing import Any, Dict, List
import time
from agents.base import BaseGovernanceAgent
from app.services.knowledge_graph import KnowledgeGraphService
from ml.models import aml_estimator

SEVERITY_WEIGHTS = {"high": 0.45, "medium": 0.20, "low": 0.10}


def _structuring_risk(amount: float) -> tuple[float, List[str]]:
    """Deterministic structuring-band check (kept from the legacy model)."""
    if 4800.0 <= amount < 5000.0 or 9500.0 <= amount < 10000.0:
        return 0.40, ["structuring_band"]
    return 0.0, []


class AMLAgent(BaseGovernanceAgent):
    """
    Scans live Neo4j transfer relationships for structuring, layering
    chains, circular loops, and dense relationship patterns. Falls back to
    the in-memory networkx estimator (labeled) when Neo4j is unreachable.
    """
    def __init__(self) -> None:
        super().__init__(name="AMLAgent")
        self.graph = KnowledgeGraphService()

    async def _execute(self, state: Dict[str, Any], logs: List[str]) -> Dict[str, Any]:
        tx_data = state.get("transaction", {})
        amount = float(tx_data.get("amount", 0.0) or 0.0)
        customer_id = tx_data.get("customer_id")
        account_id = tx_data.get("account_id")
        beneficiary_id = tx_data.get("beneficiary_id")

        logs.append(f"Scanning transfer graph pathways for customer: {customer_id}")

        t_start = time.perf_counter()
        analysis = self.graph.analyze_transaction_relationships(
            customer_id=str(customer_id) if customer_id else "",
            account_id=str(account_id) if account_id else str(customer_id or ""),
            beneficiary_id=str(beneficiary_id) if beneficiary_id else None,
            amount=amount,
        )
        graph_ms = (time.perf_counter() - t_start) * 1000

        risk_score = 0.0
        flags: List[str] = []
        suspicious_patterns: List[Dict[str, Any]] = list(analysis.get("patterns", []))
        for pattern in suspicious_patterns:
            weight = SEVERITY_WEIGHTS.get(str(pattern.get("severity", "low")), 0.10)
            risk_score += weight
            flags.append(f"aml:{pattern.get('pattern_type', 'unknown')}")
            logs.append(
                f"Warning: {pattern.get('pattern_type')} "
                f"(severity {pattern.get('severity')})."
            )

        band_risk, band_flags = _structuring_risk(amount)
        risk_score += band_risk
        flags.extend(f"aml:{f}" for f in band_flags)
        if band_flags:
            logs.append(f"Warning: amount {amount} inside structuring band.")

        data_source = analysis.get("data_source", "unavailable")
        related_entities = analysis.get("related_entities", [])
        graph_evidence: Dict[str, Any] = dict(analysis.get("graph_evidence", {}))

        if data_source == "unavailable":
            # Labeled fallback: legacy in-memory networkx estimator over the
            # request-scoped history window (NOT a Neo4j result).
            features = {
                "amount": amount,
                "customer_id": str(customer_id) if customer_id else "",
                "beneficiary_id": str(beneficiary_id) if beneficiary_id else "",
                "history": state.get("history", []),
            }
            fallback_risk = float(aml_estimator.predict_proba(features))
            risk_score = max(risk_score, fallback_risk)
            if fallback_risk > 0.40:
                flags.append("aml:fallback_structuring_or_cycle")
            graph_evidence["fallback"] = "networkx-in-memory"
            graph_evidence["fallback_risk"] = fallback_risk
            logs.append(f"Neo4j unavailable; networkx fallback risk={fallback_risk:.4f}.")

        risk_score = max(0.0, min(1.0, float(risk_score)))
        confidence = float(1.0 - risk_score)
        logs.append(f"AML Graph Analyzer risk score: {risk_score:.4f} (latency: {graph_ms:.2f}ms)")

        state["aml_prob"] = risk_score

        envelope = {
            "risk_score": risk_score,
            "flags": flags,
            "evidence": {
                "suspicious_patterns": suspicious_patterns,
                "related_entities": related_entities,
                "graph_evidence": graph_evidence,
                "data_source": data_source,
                "amount": amount,
            },
            "model": "neo4j-relationship-v1",
            "placeholder": False,
        }

        if risk_score > 0.40:
            return {
                "confidence_score": confidence,
                "reasoning": (
                    f"High risk: {len(suspicious_patterns)} suspicious pattern(s) "
                    f"detected (AML risk: {risk_score:.2f})."
                ),
                **envelope,
            }

        return {
            "confidence_score": confidence,
            "reasoning": "Low risk: no matching money laundering structures found.",
            **envelope,
        }
