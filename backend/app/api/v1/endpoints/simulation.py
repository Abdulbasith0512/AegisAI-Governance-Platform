import uuid
import asyncio
from typing import List, Dict, Any
from fastapi import APIRouter, Depends, HTTPException, status, BackgroundTasks
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.dependencies import get_db, require_permission
from app.models.users import User
from app.repositories.simulation import SimulationRepository
from app.services.simulation_engine import SimulationEngine
from app.schemas.simulation import (
    SimulationScenarioCreate, SimulationScenarioRead, SimulationScenarioUpdate,
    SimulationRunRead, SimulationResultRead, SimulationMetricRead, SimulationEventRead
)

router = APIRouter(
    prefix="/simulation",
    tags=["Governance Simulation (Digital Twin)"],
    dependencies=[Depends(require_permission("read:transactions"))],
)

def get_sim_repo(db: AsyncSession = Depends(get_db)) -> SimulationRepository:
    return SimulationRepository(db)

def get_engine(repo: SimulationRepository = Depends(get_sim_repo)) -> SimulationEngine:
    return SimulationEngine(repo)

# -----------------
# Scenarios
# -----------------
@router.post("/scenarios", response_model=SimulationScenarioRead, status_code=status.HTTP_201_CREATED)
async def create_scenario(
    scenario: SimulationScenarioCreate,
    repo: SimulationRepository = Depends(get_sim_repo),
    current_user: User = Depends(require_permission("write:policies"))
):
    """Create a new Digital Twin simulation scenario configuration."""
    return await repo.create_scenario(scenario)

@router.get("/scenarios", response_model=List[SimulationScenarioRead])
async def list_scenarios(
    repo: SimulationRepository = Depends(get_sim_repo)
):
    """List all simulation scenarios."""
    return await repo.get_scenarios()

@router.get("/scenarios/{scenario_id}", response_model=SimulationScenarioRead)
async def get_scenario(
    scenario_id: uuid.UUID,
    repo: SimulationRepository = Depends(get_sim_repo)
):
    scenario = await repo.get_scenario(scenario_id)
    if not scenario:
        raise HTTPException(status_code=404, detail="Scenario not found")
    return scenario

# -----------------
# Execution Runs
# -----------------
@router.post("/scenarios/{scenario_id}/runs", response_model=SimulationRunRead, status_code=status.HTTP_201_CREATED)
async def trigger_simulation_run(
    scenario_id: uuid.UUID,
    background_tasks: BackgroundTasks,
    repo: SimulationRepository = Depends(get_sim_repo),
    engine: SimulationEngine = Depends(get_engine),
    current_user: User = Depends(require_permission("write:policies"))
):
    """Trigger a simulation execution in the background."""
    scenario = await repo.get_scenario(scenario_id)
    if not scenario:
        raise HTTPException(status_code=404, detail="Scenario not found")
        
    run = await repo.create_run(scenario_id)
    
    # Run the engine mathematically in the background to prevent blocking FastAPI
    background_tasks.add_task(engine.execute_run_background, run.id)
    
    return run

@router.get("/scenarios/{scenario_id}/runs", response_model=List[SimulationRunRead])
async def get_runs_for_scenario(
    scenario_id: uuid.UUID,
    repo: SimulationRepository = Depends(get_sim_repo)
):
    return await repo.get_runs_for_scenario(scenario_id)

@router.get("/runs/{run_id}", response_model=SimulationRunRead)
async def get_run_details(
    run_id: uuid.UUID,
    repo: SimulationRepository = Depends(get_sim_repo)
):
    run = await repo.get_run(run_id)
    if not run:
        raise HTTPException(status_code=404, detail="Run not found")
    return run

# -----------------
# Telemetry & Analytics
# -----------------
@router.get("/runs/{run_id}/metrics", response_model=List[SimulationMetricRead])
async def get_run_metrics(
    run_id: uuid.UUID,
    repo: SimulationRepository = Depends(get_sim_repo)
):
    """Get time-series metrics for a run (Latency, Throughput, CPU)."""
    return await repo.get_metrics(run_id)

@router.get("/runs/{run_id}/events", response_model=List[SimulationEventRead])
async def get_run_events(
    run_id: uuid.UUID,
    limit: int = 100,
    repo: SimulationRepository = Depends(get_sim_repo)
):
    """Get real-time execution events/logs for a run."""
    return await repo.get_events(run_id, limit=limit)
