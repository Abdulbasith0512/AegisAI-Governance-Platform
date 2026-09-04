from typing import Any, Dict, List
import time
from agents.base import BaseGovernanceAgent

def get_field(obj: Any, key: str, default: Any = None) -> Any:
    if not obj:
        return default
    if isinstance(obj, dict):
        return obj.get(key, default)
    return getattr(obj, key, default)

class DeviceAgent(BaseGovernanceAgent):
    """
    Evaluates client terminal IP, fingerprint, and geolocation anomalies.
    """
    def __init__(self) -> None:
        super().__init__(name="DeviceAgent")

    async def _execute(self, state: Dict[str, Any], logs: List[str]) -> Dict[str, Any]:
        tx_data = state.get("transaction", {})
        device_profile = get_field(tx_data, "device", {})
        
        fingerprint = get_field(device_profile, "fingerprint", "unknown")
        logs.append(f"Evaluating device fingerprint: {fingerprint}")
        
        is_emulator = get_field(device_profile, "is_emulator", False)
        ip = get_field(device_profile, "ip_address", "")
        
        t_start = time.perf_counter()
        
        risk_score = 0.0
        flags: List[str] = []
        if is_emulator:
            risk_score += 0.55
            flags.append("emulator_detected")
            logs.append("Warning: Terminal is running on an emulator.")
        if not ip:
            risk_score += 0.40
            flags.append("missing_ip")
            logs.append("Warning: Ingested transaction lacks IP tracking.")
            
        confidence = float(1.0 - risk_score)
        t_end = time.perf_counter()
        
        logs.append(f"Device Profiler risk score: {risk_score:.4f} (latency: {(t_end - t_start)*1000:.2f}ms)")
        
        state["device_prob"] = risk_score

        # Deterministic heuristic (no ML model). Labeled as placeholder so
        # downstream consumers never mistake it for a model prediction.
        envelope = {
            "risk_score": risk_score,
            "flags": flags,
            "evidence": {"fingerprint": fingerprint, "is_emulator": bool(is_emulator), "ip_present": bool(ip)},
            "model": "heuristic-v1",
            "placeholder": True,
        }

        if risk_score > 0.50:
            return {
                "confidence_score": confidence,
                "reasoning": f"High risk: suspicious emulator execution footprint (device risk: {risk_score:.2f}).",
                **envelope,
            }

        return {
            "confidence_score": confidence,
            "reasoning": "Low risk: device integrity check passed.",
            **envelope,
        }
