"""Synthetic DEVELOPMENT dataset generator for the AegisAI fraud baseline.

SYNTHETIC DATA — FOR DEVELOPMENT/TESTING ONLY. These rows are drawn from
hand-specified distributions with a fixed seed. They are NOT real banking
transactions and support NO claims about real-world fraud accuracy. The
trained model is a pipeline baseline, not a production fraud system.

Usage:
    python ml/fraud_data_gen.py [--n 5000] [--seed 42] [--out ml/data/synthetic_fraud_dev.csv]
"""

from __future__ import annotations

import argparse
import csv
import os
import sys

import numpy as np

FEATURES = [
    "amount",
    "velocity_1h",
    "freq_24h",
    "merchant_category_risk",
    "account_age_days",
    "failed_attempts",
    "location_deviation_km",
    "history_amount_zscore",
]
LABEL = "is_fraud"

# High-risk merchant category codes (MCC families commonly abused in
# structuring / cash-out typologies). Used only to shape synthetic data.
HIGH_RISK_MCC = {"4829", "6012", "6051", "7995", "7994"}
MED_RISK_MCC = {"5411", "5812", "5999", "5732"}


def _mcc_risk(rng: np.random.Generator, fraud: bool) -> float:
    if fraud:
        pick = rng.random()
        if pick < 0.55:
            return round(float(rng.uniform(0.75, 1.0)), 3)
        if pick < 0.80:
            return round(float(rng.uniform(0.45, 0.75)), 3)
        return round(float(rng.uniform(0.0, 0.45)), 3)
    pick = rng.random()
    if pick < 0.70:
        return round(float(rng.uniform(0.0, 0.35)), 3)
    if pick < 0.92:
        return round(float(rng.uniform(0.35, 0.65)), 3)
    return round(float(rng.uniform(0.65, 1.0)), 3)


def generate(n: int, seed: int, fraud_rate: float = 0.08) -> list[dict]:
    rng = np.random.default_rng(seed)
    rows: list[dict] = []
    for _ in range(n):
        fraud = bool(rng.random() < fraud_rate)
        if fraud:
            shape = rng.random()
            if shape < 0.35:
                # Structuring band just below reporting thresholds
                amount = float(rng.choice([rng.uniform(4800, 4999), rng.uniform(9500, 9999)]))
            elif shape < 0.60:
                # Large anomalous wire
                amount = float(rng.uniform(15000, 60000))
            else:
                amount = float(rng.uniform(200, 12000))
            velocity = int(rng.integers(4, 25))
            freq = int(rng.integers(6, 40))
            age = int(rng.integers(0, 180))
            failed = int(rng.integers(0, 6))
            loc = float(rng.uniform(50, 9000))
            z = float(rng.uniform(1.5, 5.0))
        else:
            amount = float(min(rng.lognormal(5.6, 1.0), 20000.0))
            velocity = int(min(rng.poisson(1.2), 8))
            freq = int(min(rng.poisson(2.5), 12))
            age = int(rng.integers(30, 3650))
            failed = int(min(rng.poisson(0.2), 3))
            loc = float(min(rng.exponential(25.0), 1500.0))
            z = float(rng.normal(0.0, 1.0))
        rows.append(
            {
                "amount": round(amount, 2),
                "velocity_1h": velocity,
                "freq_24h": freq,
                "merchant_category_risk": _mcc_risk(rng, fraud),
                "account_age_days": age,
                "failed_attempts": failed,
                "location_deviation_km": round(loc, 1),
                "history_amount_zscore": round(z, 3),
                "is_fraud": int(fraud),
            }
        )
    return rows


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--n", type=int, default=5000)
    parser.add_argument("--seed", type=int, default=42)
    parser.add_argument("--fraud-rate", type=float, default=0.08)
    parser.add_argument("--out", default=os.path.join("ml", "data", "synthetic_fraud_dev.csv"))
    args = parser.parse_args()

    rows = generate(args.n, args.seed, args.fraud_rate)
    os.makedirs(os.path.dirname(os.path.abspath(args.out)), exist_ok=True)
    with open(args.out, "w", newline="") as f:
        writer = csv.DictWriter(f, fieldnames=FEATURES + [LABEL])
        writer.writeheader()
        writer.writerows(rows)
    n_fraud = sum(r["is_fraud"] for r in rows)
    print(f"Wrote {len(rows)} rows ({n_fraud} fraud) -> {args.out}")


if __name__ == "__main__":
    sys.exit(main())
