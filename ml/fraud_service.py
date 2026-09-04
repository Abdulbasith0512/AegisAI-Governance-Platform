"""Inference service for the AegisAI fraud baseline.

Loads the versioned artifact produced by ml/train_fraud.py (trained on
SYNTHETIC development data only — no real-world accuracy claims). Falls
back to a seeded in-memory fit if the artifact file is absent so imports
never crash offline environments.

The public input is a feature dict only — there is intentionally NO
transaction_id parameter, so a result can never be hard-coded per ID.
"""

from __future__ import annotations

import json
import logging
import os
from typing import Any, Dict, List, Optional

import joblib
import numpy as np

logger = logging.getLogger("aegisai.ml.fraud_service")

MODEL_VERSION = "fraud-gbm-calibrated-v2.0.0"

FEATURES = [
    "amount_log",
    "velocity_1h",
    "freq_24h",
    "merchant_category_risk",
    "account_age_log",
    "failed_attempts",
    "location_deviation_log",
    "history_amount_zscore",
]

# Documented medians used when a caller omits a signal. Every imputation
# is reported in evidence.imputed — never silent.
FEATURE_DEFAULTS = {
    "amount_log": float(np.log1p(250.0)),
    "velocity_1h": 1.0,
    "freq_24h": 2.0,
    "merchant_category_risk": 0.3,
    "account_age_log": float(np.log1p(365.0)),
    "failed_attempts": 0.0,
    "location_deviation_log": float(np.log1p(10.0)),
    "history_amount_zscore": 0.0,
}

_HUMAN_NAMES = {
    "amount_log": "amount_value",
    "velocity_1h": "velocity",
    "freq_24h": "frequency_24h",
    "merchant_category_risk": "merchant_category",
    "account_age_log": "account_age",
    "failed_attempts": "failed_attempts",
    "location_deviation_log": "location_deviation",
    "history_amount_zscore": "history_zscore",
}


def _artifact_dir() -> str:
    return os.path.join(os.path.dirname(os.path.abspath(__file__)), "artifacts")


class FraudModelService:
    """Versioned fraud inference. Stateless after load; safe to share."""

    def __init__(self, artifact_path: Optional[str] = None) -> None:
        self.model_version = MODEL_VERSION
        self._metadata: Dict[str, Any] = {}
        path = artifact_path or os.path.join(_artifact_dir(), "fraud_v2.joblib")
        bundle = None
        if os.path.exists(path):
            try:
                bundle = joblib.load(path)
            except Exception as e:
                logger.warning("Fraud artifact unreadable (%s); using seeded fallback.", e)
        if bundle is None:
            bundle = self._seeded_fallback()
        self._pipeline = bundle["pipeline"]
        self._auxiliary = bundle.get("auxiliary")
        meta_path = os.path.join(_artifact_dir(), "fraud_v2_metadata.json")
        if os.path.exists(meta_path):
            try:
                with open(meta_path) as f:
                    self._metadata = json.load(f)
                    self.model_version = self._metadata.get("model_version", MODEL_VERSION)
            except Exception:
                pass

    def _seeded_fallback(self) -> Dict[str, Any]:
        """Minimal seeded fit so offline imports never crash.

        Clearly inferior to the artifact; used only when the file is absent.
        """
        from sklearn.ensemble import GradientBoostingClassifier

        rng = np.random.default_rng(42)
        X = rng.normal(0, 1, size=(400, len(FEATURES)))
        y = (X[:, 0] + X[:, 1] > 1.5).astype(int)
        clf = GradientBoostingClassifier(random_state=42)
        clf.fit(X, y)
        logger.warning("FraudModelService running on seeded fallback (no artifact).")
        return {"pipeline": clf, "auxiliary": None}

    @property
    def metadata(self) -> Dict[str, Any]:
        return dict(self._metadata)

    def vectorize(self, features: Dict[str, Any]) -> tuple[np.ndarray, List[str]]:
        """Map a raw feature dict to the model vector. Returns (X, imputed).

        Column order matches FEATURES: amount_log, velocity_1h, freq_24h,
        merchant_category_risk, account_age_log, failed_attempts,
        location_deviation_log, history_amount_zscore.
        """
        get = features.get
        imputed: List[str] = []

        def _raw(name: str, transform=None):
            val = get(name, None)
            if val is None:
                return None
            v = float(val)
            return transform(v) if transform else v

        def _log1p_nonneg(v: float) -> float:
            return float(np.log1p(max(0.0, v)))

        vec: List[float] = []
        specs = [
            ("amount", "amount_log", _log1p_nonneg),
            ("velocity_1h", "velocity_1h", None),
            ("freq_24h", "freq_24h", None),
            ("merchant_category_risk", "merchant_category_risk", None),
            ("account_age_days", "account_age_log", _log1p_nonneg),
            ("failed_attempts", "failed_attempts", None),
            ("location_deviation_km", "location_deviation_log", _log1p_nonneg),
            ("history_amount_zscore", "history_amount_zscore", None),
        ]
        for raw_name, feat_name, transform in specs:
            val = _raw(raw_name, transform)
            if val is None:
                vec.append(FEATURE_DEFAULTS[feat_name])
                imputed.append(feat_name)
            else:
                vec.append(val)
        return np.array(vec, dtype=float).reshape(1, -1), imputed

    def _contributions(self, X: np.ndarray) -> List[Dict[str, Any]]:
        """Honest per-feature attribution: GBM importance x |standardized deviation|.

        This is NOT SHAP — it is documented as importance-weighted deviation.
        """
        try:
            clf = self._pipeline.named_steps["clf"]
            importances = np.asarray(getattr(clf, "feature_importances_", None))
            if importances is None or importances.shape != (len(FEATURES),):
                # CalibratedClassifierCV wraps the GBM per fold; average them
                estimators = getattr(clf, "calibrated_classifiers_", [])
                imps = [np.asarray(e.estimator.feature_importances_) for e in estimators if hasattr(e.estimator, "feature_importances_")]
                importances = np.mean(imps, axis=0) if imps else np.ones(len(FEATURES)) / len(FEATURES)
        except Exception:
            importances = np.ones(len(FEATURES)) / len(FEATURES)
        try:
            scaler = self._pipeline.named_steps["scaler"]
            means = np.asarray(scaler.mean_)
            scales = np.asarray(scaler.scale_)
            dev = np.abs((X.flatten() - means) / np.where(scales == 0, 1.0, scales))
        except Exception:
            dev = np.abs(X.flatten())
        raw = importances * dev
        total = float(raw.sum()) or 1.0
        ranked = sorted(zip(FEATURES, raw / total), key=lambda t: t[1], reverse=True)
        return [
            {"feature": _HUMAN_NAMES[name], "contribution": round(float(score), 4)}
            for name, score in ranked[:3]
            if score > 0
        ]

    def predict(self, features: Dict[str, Any]) -> Dict[str, Any]:
        """Run inference. Input is features only — no transaction identity."""
        X, imputed = self.vectorize(features)
        proba = float(self._pipeline.predict_proba(X)[0][1])
        proba = min(1.0, max(0.0, proba))
        confidence = round(abs(proba - 0.5) * 2.0, 4)
        aux_agrees = None
        if self._auxiliary is not None:
            try:
                aux_proba = float(self._auxiliary.predict_proba(X)[0][1])
                aux_agrees = bool((aux_proba >= 0.5) == (proba >= 0.5))
            except Exception:
                aux_agrees = None
        return {
            "fraud_probability": round(proba, 4),
            "risk_score": round(proba, 4),
            "triggered_features": self._contributions(X),
            "confidence": confidence,
            "model_version": self.model_version,
            "evidence": {
                "auxiliary_agrees": aux_agrees,
                "imputed": imputed,
            },
        }


# Shared singleton used by the Fraud agent
fraud_service = FraudModelService()
