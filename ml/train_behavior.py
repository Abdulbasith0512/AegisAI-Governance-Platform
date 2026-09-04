"""Reproducible training for the behavioral baseline (Isolation Forest).

Trains on SYNTHETIC deviation profiles (see ml/behavior_data_gen.py — no
real banking data, no production-accuracy claims). Writes versioned
artifact + metadata JSON.

Usage: python ml/train_behavior.py [--data ml/data/synthetic_behavior_dev.csv]
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
from sklearn.ensemble import IsolationForest
from sklearn.metrics import roc_auc_score
from sklearn.model_selection import StratifiedKFold
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import StandardScaler

MODEL_VERSION = "behavior-if-v1.0.0"
SEED = 7
FEATURES = [
    "amount_zscore",
    "hour_rarity",
    "new_merchant",
    "new_device",
    "mcc_deviation",
    "velocity_norm",
    "failed_attempts_norm",
]


def load(path: str) -> tuple[np.ndarray, np.ndarray]:
    X, y = [], []
    with open(path, newline="") as f:
        for row in csv.DictReader(f):
            X.append([float(row[c]) for c in FEATURES])
            y.append(int(row["is_anomaly"]))
    return np.array(X), np.array(y)


def build() -> Pipeline:
    return Pipeline(
        [
            ("scaler", StandardScaler()),
            ("clf", IsolationForest(n_estimators=200, contamination=0.12, random_state=SEED)),
        ]
    )


def _sha(path: str) -> str:
    h = hashlib.sha256()
    with open(path, "rb") as f:
        for chunk in iter(lambda: f.read(65536), b""):
            h.update(chunk)
    return h.hexdigest()[:16]


def main() -> None:
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument("--data", default=os.path.join("ml", "data", "synthetic_behavior_dev.csv"))
    p.add_argument("--out-dir", default=os.path.join("ml", "artifacts"))
    p.add_argument("--version", default=MODEL_VERSION)
    args = p.parse_args()

    X, y = load(args.data)
    pipe = build()
    pipe.fit(X, y)
    # Honest CV estimate (manual folds: cross_val_predict needs classes_,
    # which unsupervised IsolationForest lacks). Anomaly score = -decision.
    cv = StratifiedKFold(n_splits=3, shuffle=True, random_state=SEED)
    oof = np.zeros(len(y))
    for tr, va in cv.split(X, y):
        fold = build().fit(X[tr])
        oof[va] = -fold.decision_function(X[va])
    metrics = {
        "n_rows": int(len(y)),
        "n_anomalies": int(y.sum()),
        "cv_roc_auc": round(float(roc_auc_score(y, oof)), 4),
    }
    print("Metrics:", json.dumps(metrics))

    os.makedirs(args.out_dir, exist_ok=True)
    art = os.path.join(args.out_dir, "behavior_v1.joblib")
    joblib.dump({"pipeline": pipe, "features": FEATURES}, art)
    with open(art, "rb") as f:
        art_sha = hashlib.sha256(f.read()).hexdigest()[:16]
    meta = {
        "model_version": args.version,
        "estimator": "IsolationForest(n=200,contamination=0.12)+StandardScaler",
        "features": FEATURES,
        "seed": SEED,
        "data_file": os.path.basename(args.data),
        "data_sha": _sha(args.data),
        "artifact_sha": art_sha,
        "metrics": metrics,
        "synthetic_only": True,
        "disclaimer": "Trained exclusively on synthetic development data. Makes NO claim about real-world accuracy. Baseline only.",
    }
    with open(os.path.join(args.out_dir, "behavior_v1_metadata.json"), "w") as f:
        json.dump(meta, f, indent=2)
    print(f"Wrote {art}")


if __name__ == "__main__":
    sys.exit(main())
