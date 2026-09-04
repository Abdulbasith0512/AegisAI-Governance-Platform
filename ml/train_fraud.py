"""Reproducible training for the AegisAI fraud baseline.

Reads the SYNTHETIC development dataset (see ml/fraud_data_gen.py — no
real banking data, no production-accuracy claims) and trains a calibrated
gradient-boosting pipeline. Writes a versioned artifact + metadata JSON.

Usage:
    python ml/train_fraud.py [--data ml/data/synthetic_fraud_dev.csv]
                             [--out-dir ml/artifacts] [--version fraud-gbm-calibrated-v2.0.0]

All randomness is seeded. Metrics are printed and stored in metadata.json.
"""

from __future__ import annotations

import argparse
import csv
import hashlib
import json
import os
import sys

import joblib
import numpy as np
from sklearn.calibration import CalibratedClassifierCV
from sklearn.ensemble import GradientBoostingClassifier, RandomForestClassifier
from sklearn.metrics import average_precision_score, precision_score, recall_score, roc_auc_score
from sklearn.model_selection import StratifiedKFold, cross_val_predict, train_test_split
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import StandardScaler

MODEL_VERSION = "fraud-gbm-calibrated-v2.0.0"
SEED = 42

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

RAW_COLUMNS = [
    "amount",
    "velocity_1h",
    "freq_24h",
    "merchant_category_risk",
    "account_age_days",
    "failed_attempts",
    "location_deviation_km",
    "history_amount_zscore",
]


def load_rows(path: str) -> tuple[np.ndarray, np.ndarray]:
    """Load raw CSV rows into the engineered feature matrix + labels."""
    raw: list[list[float]] = []
    y: list[int] = []
    with open(path, newline="") as f:
        for row in csv.DictReader(f):
            raw.append([float(row[c]) for c in RAW_COLUMNS])
            y.append(int(row["is_fraud"]))
    arr = np.array(raw, dtype=float)
    X = np.column_stack(
        [
            np.log1p(arr[:, 0]),  # amount_log
            arr[:, 1],  # velocity_1h
            arr[:, 2],  # freq_24h
            arr[:, 3],  # merchant_category_risk
            np.log1p(arr[:, 4]),  # account_age_log
            arr[:, 5],  # failed_attempts
            np.log1p(arr[:, 6]),  # location_deviation_log
            arr[:, 7],  # history_amount_zscore
        ]
    )
    return X, np.array(y, dtype=int)


def build_pipeline() -> Pipeline:
    gbm = GradientBoostingClassifier(
        n_estimators=150,
        max_depth=3,
        learning_rate=0.08,
        subsample=0.85,
        min_samples_leaf=20,
        random_state=SEED,
    )
    calibrated = CalibratedClassifierCV(estimator=gbm, method="sigmoid", cv=3)
    return Pipeline([("scaler", StandardScaler()), ("clf", calibrated)])


def build_auxiliary() -> RandomForestClassifier:
    """Second-opinion forest fitted on the same features (kept small)."""
    return RandomForestClassifier(
        n_estimators=100, max_depth=6, min_samples_leaf=10, random_state=SEED, n_jobs=1
    )


def data_hash(path: str) -> str:
    h = hashlib.sha256()
    with open(path, "rb") as f:
        for chunk in iter(lambda: f.read(65536), b""):
            h.update(chunk)
    return h.hexdigest()[:16]


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--data", default=os.path.join("ml", "data", "synthetic_fraud_dev.csv"))
    parser.add_argument("--out-dir", default=os.path.join("ml", "artifacts"))
    parser.add_argument("--version", default=MODEL_VERSION)
    args = parser.parse_args()

    X, y = load_rows(args.data)
    print(f"Loaded {len(y)} rows ({int(y.sum())} fraud) from {args.data}")

    X_train, X_val, y_train, y_val = train_test_split(
        X, y, test_size=0.25, stratify=y, random_state=SEED
    )

    pipeline = build_pipeline()
    pipeline.fit(X_train, y_train)
    proba = pipeline.predict_proba(X_val)[:, 1]
    pred = (proba >= 0.5).astype(int)

    # Honest cross-validated estimate on the full synthetic set
    cv = StratifiedKFold(n_splits=3, shuffle=True, random_state=SEED)
    cv_proba = cross_val_predict(build_pipeline(), X, y, cv=cv, method="predict_proba")[:, 1]

    metrics = {
        "n_rows": int(len(y)),
        "n_fraud": int(y.sum()),
        "val_precision": round(float(precision_score(y_val, pred, zero_division=0)), 4),
        "val_recall": round(float(recall_score(y_val, pred, zero_division=0)), 4),
        "val_roc_auc": round(float(roc_auc_score(y_val, proba)), 4),
        "val_avg_precision": round(float(average_precision_score(y_val, proba)), 4),
        "cv_roc_auc": round(float(roc_auc_score(y, cv_proba)), 4),
        "cv_avg_precision": round(float(average_precision_score(y, cv_proba)), 4),
    }
    print("Validation metrics:", json.dumps(metrics, indent=2))

    aux = build_auxiliary()
    aux.fit(X_train, y_train)

    os.makedirs(args.out_dir, exist_ok=True)
    artifact_path = os.path.join(args.out_dir, "fraud_v2.joblib")
    joblib.dump({"pipeline": pipeline, "auxiliary": aux, "features": FEATURES}, artifact_path)

    with open(artifact_path, "rb") as f:
        artifact_hash = hashlib.sha256(f.read()).hexdigest()[:16]

    metadata = {
        "model_version": args.version,
        "estimator": "GradientBoostingClassifier(n=150,depth=3,lr=0.08)+CalibratedCV(sigmoid,3-fold)+StandardScaler; auxiliary RandomForest(n=100)",
        "features": FEATURES,
        "seed": SEED,
        "data_file": os.path.basename(args.data),
        "data_sha": data_hash(args.data),
        "artifact_sha": artifact_hash,
        "metrics": metrics,
        "synthetic_only": True,
        "disclaimer": (
            "Trained exclusively on synthetic development data. "
            "Makes NO claim about real-world banking fraud accuracy. "
            "Baseline for pipeline integration and testing only."
        ),
    }
    meta_path = os.path.join(args.out_dir, "fraud_v2_metadata.json")
    with open(meta_path, "w") as f:
        json.dump(metadata, f, indent=2)
    print(f"Wrote {artifact_path} and {meta_path}")


if __name__ == "__main__":
    sys.exit(main())
