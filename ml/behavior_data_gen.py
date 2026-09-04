"""Synthetic DEVELOPMENT sequences for the behavioral baseline.

SYNTHETIC DATA — FOR DEVELOPMENT/TESTING ONLY. Rows encode per-customer
*deviation profiles* (not raw transactions): a profiling step (in the
service, not here) converts real history into these deviations. NOT real
banking data; supports NO real-world accuracy claims.

Usage: python ml/behavior_data_gen.py [--n 4000] [--seed 7]
"""

from __future__ import annotations

import argparse
import csv
import os
import sys

import numpy as np

FEATURES = [
    "amount_zscore",
    "hour_rarity",
    "new_merchant",
    "new_device",
    "mcc_deviation",
    "velocity_norm",
    "failed_attempts_norm",
]
LABEL = "is_anomaly"


def generate(n: int, seed: int, anomaly_rate: float = 0.12) -> list[dict]:
    rng = np.random.default_rng(seed)
    rows: list[dict] = []
    for _ in range(n):
        anomaly = bool(rng.random() < anomaly_rate)
        if anomaly:
            kind = rng.random()
            z = float(rng.uniform(2.5, 6.0)) if kind < 0.5 else float(abs(rng.normal(0.5, 1.0)))
            hour = float(rng.uniform(0.6, 1.0)) if kind < 0.5 else float(rng.uniform(0.0, 0.4))
            new_m = 1 if rng.random() < 0.65 else 0
            new_d = 1 if rng.random() < 0.55 else 0
            mcc = float(rng.uniform(0.5, 1.0))
            vel = float(rng.uniform(0.5, 1.5))
            fail = float(min(rng.poisson(1.5), 5) / 5.0)
        else:
            z = float(abs(rng.normal(0.4, 0.5)))
            hour = float(rng.uniform(0.0, 0.3))
            new_m = 1 if rng.random() < 0.08 else 0
            new_d = 1 if rng.random() < 0.05 else 0
            mcc = float(rng.uniform(0.0, 0.3))
            vel = float(rng.uniform(0.0, 0.4))
            fail = 0.0 if rng.random() < 0.9 else 0.2
        rows.append(
            {
                "amount_zscore": round(z, 3),
                "hour_rarity": round(hour, 3),
                "new_merchant": new_m,
                "new_device": new_d,
                "mcc_deviation": round(mcc, 3),
                "velocity_norm": round(vel, 3),
                "failed_attempts_norm": round(fail, 3),
                "is_anomaly": int(anomaly),
            }
        )
    return rows


def main() -> None:
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument("--n", type=int, default=4000)
    p.add_argument("--seed", type=int, default=7)
    p.add_argument("--out", default=os.path.join("ml", "data", "synthetic_behavior_dev.csv"))
    args = p.parse_args()
    rows = generate(args.n, args.seed)
    os.makedirs(os.path.dirname(os.path.abspath(args.out)), exist_ok=True)
    with open(args.out, "w", newline="") as f:
        w = csv.DictWriter(f, fieldnames=FEATURES + [LABEL])
        w.writeheader()
        w.writerows(rows)
    print(f"Wrote {len(rows)} rows ({sum(r['is_anomaly'] for r in rows)} anomalies) -> {args.out}")


if __name__ == "__main__":
    sys.exit(main())
