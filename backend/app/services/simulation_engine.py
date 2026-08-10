import uuid
import random
import asyncio
from datetime import datetime, timedelta
from typing import Dict, Any, List
from app.repositories.simulation import SimulationRepository
from app.models.simulation import SimulationScenario, SimulationMetric, SimulationEvent
import logging

logger = logging.getLogger(__name__)

class SyntheticDataGenerator:
    """Generates logical distributions of transactions."""
    @staticmethod
    def calculate_distribution(scenario: SimulationScenario) -> Dict[str, int]:
        total = scenario.num_transactions
        fraud_target = int(total * scenario.fraud_percentage)
        drift_target = int(total * scenario.drift_percentage)
        
        return {
            "normal": total - fraud_target - drift_target,
            "fraud": fraud_target,
            "drift": drift_target
        }

class FailureInjector:
    """Simulates latencies, crashes, and drops in precision."""
    def __init__(self, failures: List[str]):
        self.failures = failures
        
    def get_latency_ms(self, base_latency: float) -> float:
        latency = base_latency
        if "db_latency" in self.failures:
            latency += random.uniform(500, 2000)
        if "kafka_delay" in self.failures:
            latency += random.uniform(100, 500)
        return latency
        
    def simulate_agent_crash(self) -> bool:
        if "fraud_agent_crash" in self.failures:
            return random.random() < 0.15 # 15% chance of crash
        return False
        
    def adjust_accuracy(self, base_accuracy: float) -> float:
        acc = base_accuracy
        if "model_drift" in self.failures:
            acc -= random.uniform(0.1, 0.3)
        return max(0.0, min(1.0, acc))

class SimulationEngine:
    """
    Orchestrates the execution of a Governance Scenario.
    For MVP and performance, we simulate execution mathematically instead of 
    doing 1,000,000 DB inserts.
    """
    def __init__(self, repository: SimulationRepository):
        self.repo = repository

    async def execute_run_background(self, run_id: uuid.UUID):
        """Executes a simulation run asynchronously."""
        from app.database.database import AsyncSessionLocal
        from app.repositories.simulation import SimulationRepository

        async with AsyncSessionLocal() as db:
            repo = SimulationRepository(db)
            try:
                await repo.update_run_status(run_id, "running")
                run = await repo.get_run(run_id)
                if not run:
                    logger.error(f"Run {run_id} not found.")
                    return
                    
                scenario = run.scenario
                injector = FailureInjector(scenario.injected_failures)
                distribution = SyntheticDataGenerator.calculate_distribution(scenario)
                
                # Mathematical Simulation Loop (Simulating batches)
                total_tx = scenario.num_transactions
                batches = min(20, total_tx) # Split into at most 20 chunks for timeline
                tx_per_batch = total_tx // batches
                
                fraud_detected = 0
                aml_alerts = 0
                false_positives = 0
                false_negatives = 0
                total_latency = 0.0
                
                base_accuracy = 0.95
                
                for i in range(batches):
                    await asyncio.sleep(0.5) # Simulate time passing
                    
                    # Calculate metrics for this batch
                    current_accuracy = injector.adjust_accuracy(base_accuracy)
                    batch_latency = injector.get_latency_ms(random.uniform(50, 150))
                    
                    # Check for total system crashes
                    if injector.simulate_agent_crash():
                        await self._log_event(db, run.id, "fraud_agent_crash", "error", f"Fraud Agent crashed at batch {i+1}")
                        current_accuracy = 0.0 # Everything fails open/closed
                        batch_latency = 5000.0 # Timeout
                    
                    # Process logic
                    normal_tx = int(tx_per_batch * (1 - scenario.fraud_percentage))
                    fraud_tx = tx_per_batch - normal_tx
                    
                    detected = int(fraud_tx * current_accuracy)
                    missed = fraud_tx - detected
                    fp = int(normal_tx * (1 - current_accuracy) * 0.1) # 10% of missed normals are FPs
                    
                    fraud_detected += detected
                    false_negatives += missed
                    false_positives += fp
                    
                    # AML logic
                    if scenario.aml_risk_level == "high":
                        aml_alerts += int(tx_per_batch * 0.05)
                    elif scenario.aml_risk_level == "medium":
                        aml_alerts += int(tx_per_batch * 0.02)
                    else:
                        aml_alerts += int(tx_per_batch * 0.001)
                    
                    total_latency += batch_latency * tx_per_batch
                    
                    # Write time-series metric
                    await self._save_metric(db, run.id, "latency", batch_latency)
                    await self._save_metric(db, run.id, "throughput", tx_per_batch / max(1.0, (batch_latency / 1000)))
                    
                    # Occasional Info Event
                    if i % 5 == 0:
                        await self._log_event(db, run.id, "batch_processed", "info", f"Processed {min((i+1)*tx_per_batch, total_tx)} transactions...")

                # Final Aggregation
                avg_latency = total_latency / max(1, total_tx)
                
                # Trust score calculation
                trust_impact = -((false_negatives * 2) + (false_positives * 0.5)) / max(1, total_tx) * 100
                
                result_data = {
                    "total_transactions": total_tx,
                    "fraud_detected": fraud_detected,
                    "aml_alerts": aml_alerts,
                    "false_positives": false_positives,
                    "false_negatives": false_negatives,
                    "avg_latency_ms": avg_latency,
                    "peak_tps": scenario.target_tps * random.uniform(0.8, 1.2),
                    "trust_score_impact": trust_impact,
                    "report_data": {
                        "accuracy": base_accuracy,
                        "final_accuracy": current_accuracy,
                        "injected_failures": scenario.injected_failures
                    }
                }
                
                await repo.save_result(run_id, result_data)
                await repo.update_run_status(run_id, "completed", completed=True)
                await self._log_event(db, run.id, "simulation_completed", "info", "Simulation completed successfully.")
                
            except Exception as e:
                logger.error(f"Simulation failed: {e}")
                try:
                    await repo.update_run_status(run_id, "failed", completed=True)
                    await self._log_event(db, run_id, "simulation_failed", "critical", str(e))
                except Exception as db_err:
                    logger.error(f"Failed to log simulation failure to DB: {db_err}")

    async def _save_metric(self, db, run_id: uuid.UUID, metric_type: str, value: float):
        metric = SimulationMetric(run_id=run_id, metric_type=metric_type, value=value, timestamp=datetime.utcnow())
        db.add(metric)
        await db.commit()
        
    async def _log_event(self, db, run_id: uuid.UUID, event_type: str, severity: str, message: str):
        event = SimulationEvent(run_id=run_id, event_type=event_type, severity=severity, message=message, timestamp=datetime.utcnow())
        db.add(event)
        await db.commit()
