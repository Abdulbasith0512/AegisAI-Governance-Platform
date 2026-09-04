"""Inference service for the behavioral baseline (Isolation Forest).

Scores how much the current transaction DEVIATES from the customer's own
baseline, built from real history rows (DB transactions + caller-supplied
history). Trained on SYNTHETIC deviation profiles only — no real-world
accuracy claims (see ml/behavior_data_gen.py).

Thin history (< MIN_HISTORY_ROWS rows): returns a neutral score with low
confidence and an explicit reason. History is NEVER fabricated.
"""

from __future__ import annotations

import json
import logging
import os
import statistics
from datetime import datetime
from typing import Any, Dict, List

import joblib
import numpy as np

logger = logging.getLogger("aegisai.ml.behavior_service")

MODEL_VERSION = "behavior-if-v1.0.0"
MIN_HISTORY_ROWS = 3
# Decision threshold on the calibrated anomaly score, set from validation.
ANOMALY_THRESHOLD = 0.55

FEATURES = [
    "amount_zscore",
    "hour_rarity",
    "new_merchant",
    "new_device",
    "mcc_deviation",
    "velocity_norm",
    "failed_attempts_norm",
]

_HUMAN_NAMES = {
    "amount_zscore": "amount_deviation",
    "hour_rarity": "time_of_day",
    "new_merchant": "merchant_change",
    "new_device": "device_change",
    "mcc_deviation": "merchant_category",
    "velocity_norm": "velocity",
    "failed_attempts_norm": "failed_attempts",
}


def _parse_hour(value: Any) -> int | None:
    if value is None:
        return None
    if isinstance(value, datetime):
        return value.hour
    try:
        return datetime.fromisoformat(str(value)).hour
    except ValueError:
        return None


class BehaviorModelService:
    """Per-customer behavioral anomaly scoring. Stateless; safe to share."""

    def __init__(self, artifact_path: str | None = None) -> None:
        self.model_version = MODEL_VERSION
        self._metadata: Dict[str, Any] = {}
        base = os.path.join(os.path.dirname(os.path.abspath(__file__)), "artifacts")
        path = artifact_path or os.path.join(base, "behavior_v1.joblib")
        bundle = None
        if os.path.exists(path):
            try:
                bundle = joblib.load(path)
            except Exception as e:
                logger.warning("Behavior artifact unreadable (%s); seeded fallback.", e)
        self._pipeline = bundle["pipeline"] if bundle else None
        if self._pipeline is None:
            logger.warning("BehaviorModelService has no model; all scores neutral.")
        meta_path = os.path.join(base, "behavior_v1_metadata.json")
        if os.path.exists(meta_path):
            try:
                with open(meta_path) as f:
                    self._metadata = json.load(f)
                    self.model_version = self._metadata.get("model_version", MODEL_VERSION)
            except Exception:
                pass

    @property
    def metadata(self) -> Dict[str, Any]:
        return dict(self._metadata)

    def build_baseline(self, history: List[Dict[str, Any]]) -> Dict[str, Any]:
        """Summarize a customer's normal behavior from real history rows."""
        amounts = [float(h.get("amount", 0.0)) for h in history if h.get("amount") is not None]
        hours = [h for h in (_parse_hour(r.get("timestamp")) for r in history) if h is not None]
        merchants = {str(h.get("counterparty") or h.get("merchant_id") or "") for h in history} - {""}
        devices = {str(h.get("device_fingerprint") or h.get("fingerprint") or "") for h in history} - {""}
        mccs = [float(h.get("merchant_category_risk", 0.3)) for h in history]
        return {
            "n": len(history),
            "amount_mean": statistics.fmean(amounts) if amounts else 0.0,
            "amount_std": (statistics.pstdev(amounts) if len(amounts) >= 2 else 0.0) or 1.0,
            "active_hours": set(hours),
            "merchants": merchants,
            "devices": devices,
            "mcc_mean": statistics.fmean(mccs) if mccs else 0.3,
        }

    def vectorize(
        self, current: Dict[str, Any], baseline: Dict[str, Any]
    ) -> tuple[List[float], List[str]]:
        """Current transaction -> deviation vector. Returns (vector, drivers)."""
        drivers: List[str] = []
        z = (float(current.get("amount", 0.0)) - baseline["amount_mean"]) / baseline["amount_std"]
        amount_z = abs(z)
        if amount_z >= 2.0:
            drivers.append("amount_deviation")

        hour = _parse_hour(current.get("timestamp"))
        if hour is None or not baseline["active_hours"]:
            hour_rarity = 0.5
        else:
            hour_rarity = 0.0 if hour in baseline["active_hours"] else 1.0
            if hour_rarity:
                drivers.append("time_of_day")

        merch = str(current.get("counterparty") or current.get("merchant_id") or "")
        # Only flag novelty when the baseline actually knows past values;
        # otherwise absence of data must not count as deviation.
        new_merchant = 0.0
        if merch and baseline["merchants"] and merch not in baseline["merchants"]:
            new_merchant = 1.0
            drivers.append("merchant_change")

        dev = str(current.get("device_fingerprint") or current.get("fingerprint") or "")
        new_device = 0.0
        if dev and baseline["devices"] and dev not in baseline["devices"]:
            new_device = 1.0
            drivers.append("device_change")

        mcc_dev = abs(float(current.get("merchant_category_risk", 0.3)) - baseline["mcc_mean"])
        if mcc_dev >= 0.4:
            drivers.append("merchant_category")

        velocity = min(1.5, float(current.get("velocity_1h", 1.0)) / 10.0)
        if velocity >= 0.8:
            drivers.append("velocity")

        failed = min(1.0, float(current.get("failed_attempts", 0)) / 5.0)
        if failed >= 0.4:
            drivers.append("failed_attempts")

        return [amount_z, hour_rarity, new_merchant, new_device, mcc_dev, velocity, failed], drivers

    def _score_vector(self, vector: List[float]) -> float:
        dec = float(self._pipeline.decision_function([vector])[0])
        # Map decision_function (higher = normal) to 0..1 anomaly score.
        # decision ~ +0.1 normal / negative anomalous; sigmoid centers there.
        return float(1.0 / (1.0 + np.exp(dec * 8.0)))

    def analyze(
        self, current: Dict[str, Any], history: List[Dict[str, Any]] | None
    ) -> Dict[str, Any]:
        """Score one transaction against its customer baseline.

        Returns exactly: anomaly_score, is_anomalous, evidence,
        confidence, model_version. Thin history yields a neutral,
        low-confidence result — history is never invented.
        """
        history = [h for h in (history or []) if isinstance(h, dict)]
        if len(history) < MIN_HISTORY_ROWS:
            return {
                "anomaly_score": 0.0,
                "is_anomalous": False,
                "evidence": {
                    "reason": "insufficient_history",
                    "baseline_n": len(history),
                    "required_n": MIN_HISTORY_ROWS,
                    "drivers": [],
                },
                "confidence": 0.3,
                "model_version": self.model_version,
            }
        if self._pipeline is None:
            return {
                "anomaly_score": 0.0,
                "is_anomalous": False,
                "evidence": {"reason": "model_unavailable", "drivers": []},
                "confidence": 0.3,
                "model_version": self.model_version,
            }
        baseline = self.build_baseline(history)
        vector, drivers = self.vectorize(current, baseline)
        score = round(self._score_vector(vector), 4)
        anomalous = bool(score >= ANOMALY_THRESHOLD)
        evidence_drivers = [
            {"feature": _HUMAN_NAMES.get(f, f), "observed": True} for f in drivers
        ]
        return {
            "anomaly_score": score,
            "is_anomalous": anomalous,
            "evidence": {
                "baseline_n": baseline["n"],
                "drivers": [d["feature"] for d in evidence_drivers],
                "deviations": dict(zip(FEATURES, [round(v, 4) for v in vector])),
            },
            "confidence": round(0.5 + abs(score - 0.5), 4),
            "model_version": self.model_version,
        }


# Shared singleton used by the Fraud agent
behavior_service = BehaviorModelService()
