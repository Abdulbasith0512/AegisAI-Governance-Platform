import uuid
from typing import List, Dict, Any, Optional
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.dependencies import get_db, require_permission
from app.models.users import User
from app.repositories.agents import AgentMLOpsRepository
from app.services.mlops import MLOpsService
from app.schemas.mlops import (
    ModelVersionCreate,
    ModelVersionOut,
    MLOpsDeploymentOut,
    MLflowRunCreate,
    MLflowRunOut,
    DeploymentConfigUpdate,
    RollbackRequest,
    DeploymentHistoryOut
)

router: APIRouter = APIRouter(
    prefix="/agents",
    tags=["MLOps Registry"],
    dependencies=[Depends(require_permission("read:transactions"))],
)

@router.get("", response_model=List[Dict[str, Any]])
async def list_registered_agents(db: AsyncSession = Depends(get_db)) -> List[Dict[str, Any]]:
    """
    List supervised banking agents and their associated registry profiles.
    """
    repo = AgentMLOpsRepository(db)
    agents = await repo.list_agents()
    
    result = []
    for agent in agents:
        versions = await repo.list_versions(agent.id)
        config = await repo.get_deployment_config(agent.id)
        
        result.append({
            "id": str(agent.id),
            "name": agent.name,
            "description": agent.description,
            "status": agent.status,
            "version_count": len(versions),
            "latest_version": versions[0].version_string if versions else "v1.0.0",
            "deployment_type": config.deployment_type,
            "active_version_id": str(config.active_version_id) if config.active_version_id else None,
            "canary_version_id": str(config.canary_version_id) if config.canary_version_id else None,
            "canary_split": config.canary_split,
            "shadow_version_id": str(config.shadow_version_id) if config.shadow_version_id else None,
            "ab_version_a_id": str(config.ab_version_a_id) if config.ab_version_a_id else None,
            "ab_version_b_id": str(config.ab_version_b_id) if config.ab_version_b_id else None,
            "ab_split": config.ab_split,
        })
    return result

@router.get("/{agent_id}/versions", response_model=List[ModelVersionOut])
async def list_model_versions(agent_id: uuid.UUID, db: AsyncSession = Depends(get_db)) -> List[ModelVersionOut]:
    """
    Retrieves all registered model versions for a specific AI agent.
    """
    repo = AgentMLOpsRepository(db)
    return await repo.list_versions(agent_id)

@router.post("/{agent_id}/versions", response_model=ModelVersionOut, status_code=status.HTTP_201_CREATED)
async def register_model_version(
    agent_id: uuid.UUID,
    schema: ModelVersionCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permission("write:policies"))
) -> ModelVersionOut:
    """
    Registers a new trained version checkpoint of an agent into the registry.
    """
    repo = AgentMLOpsRepository(db)
    agent = await repo.get_agent_by_id(agent_id)
    if not agent:
        raise HTTPException(status_code=404, detail="Agent profile not found.")
        
    version = await repo.create_version(agent_id, schema)
    
    # Log promotion audit history
    await repo.log_history(
        agent_id=agent_id,
        action="register_version",
        details=f"Registered model version {schema.version_string} (hash: {schema.parameters_hash[:8]})",
        performed_by="MLOps pipeline"
    )
    return version

@router.get("/deployments/{agent_id}", response_model=MLOpsDeploymentOut)
async def get_agent_deployment_config(agent_id: uuid.UUID, db: AsyncSession = Depends(get_db)) -> MLOpsDeploymentOut:
    """
    Retrieves active traffic splitting, shadow configurations, and deployment strategies.
    """
    repo = AgentMLOpsRepository(db)
    agent = await repo.get_agent_by_id(agent_id)
    if not agent:
        raise HTTPException(status_code=404, detail="Agent profile not found.")
        
    config = await repo.get_deployment_config(agent_id)
    versions = await repo.list_versions(agent_id)
    version_map = {v.id: v for v in versions}
    
    def map_ver(vid: Optional[uuid.UUID]):
        if not vid or vid not in version_map:
            return None
        v = version_map[vid]
        return ModelVersionOut(
            id=v.id,
            agent_id=v.agent_id,
            version_string=v.version_string,
            parameters_hash=v.parameters_hash,
            accuracy_benchmark=v.accuracy_benchmark,
            is_active=v.is_active,
            deployed_at=v.deployed_at,
            hyperparameters=v.hyperparameters or {},
            metrics=v.metrics or {}
        )

    return MLOpsDeploymentOut(
        agent_id=config.agent_id,
        agent_name=agent.name,
        deployment_type=config.deployment_type,
        active_version=map_ver(config.active_version_id),
        canary_version=map_ver(config.canary_version_id),
        canary_split=config.canary_split,
        shadow_version=map_ver(config.shadow_version_id),
        ab_version_a=map_ver(config.ab_version_a_id),
        ab_version_b=map_ver(config.ab_version_b_id),
        ab_split=config.ab_split
    )

@router.post("/deployments/configure", response_model=Dict[str, str])
async def configure_deployment_strategy(
    schema: DeploymentConfigUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permission("write:policies"))
) -> Dict[str, str]:
    """
    Promotes models and modifies live deployment traffic configurations.
    """
    repo = AgentMLOpsRepository(db)
    config = await repo.update_deployment_config(schema)
    
    # Log promotion history audit
    details = f"Updated deployment to {schema.deployment_type.upper()}. "
    if schema.deployment_type == "production":
        details += f"Active version ID: {schema.active_version_id}"
    elif schema.deployment_type == "canary":
        details += f"Canary split: {schema.canary_split}% to {schema.canary_version_id}"
    elif schema.deployment_type == "ab_testing":
        details += f"A/B split: {schema.ab_split}% / {100-schema.ab_split}% between versions."

    await repo.log_history(
        agent_id=schema.agent_id,
        action="promote",
        details=details,
        performed_by="Lead Administrator"
    )
    return {"status": "success", "message": "Deployment routing parameters updated successfully."}

@router.post("/deployments/rollback", response_model=Dict[str, str])
async def rollback_model_version(
    schema: RollbackRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permission("write:policies"))
) -> Dict[str, str]:
    """
    Reverts deployment target immediately to a certified historic model version.
    """
    repo = AgentMLOpsRepository(db)
    target = await repo.get_version_by_id(schema.target_version_id)
    if not target:
        raise HTTPException(status_code=404, detail="Target model version not found.")

    update_schema = DeploymentConfigUpdate(
        agent_id=schema.agent_id,
        deployment_type="production",
        active_version_id=schema.target_version_id
    )
    await repo.update_deployment_config(update_schema)
    
    await repo.log_history(
        agent_id=schema.agent_id,
        action="rollback",
        details=f"Triggered safety rollback to version {target.version_string}",
        performed_by="Lead Administrator"
    )
    return {"status": "success", "message": f"Successfully rolled back to version {target.version_string}."}

@router.get("/performance/{agent_id}", response_model=List[Dict[str, Any]])
async def get_performance_telemetry(agent_id: uuid.UUID, db: AsyncSession = Depends(get_db)) -> List[Dict[str, Any]]:
    """
    Exposes accuracy, latency, and drift telemetries for registry charts.
    """
    repo = AgentMLOpsRepository(db)
    service = MLOpsService(repo)
    return await service.get_performance_history(agent_id)

@router.get("/history/{agent_id}", response_model=List[DeploymentHistoryOut])
async def get_deployment_history_log(agent_id: uuid.UUID, db: AsyncSession = Depends(get_db)) -> List[DeploymentHistoryOut]:
    """
    Lists audit promotion logs and historical rolls of a supervised agent.
    """
    repo = AgentMLOpsRepository(db)
    return await repo.list_deployment_history(agent_id=agent_id, limit=30)

@router.get("/mlflow/runs", response_model=List[MLflowRunOut])
async def list_mlflow_experiment_runs(agent_id: Optional[uuid.UUID] = None, db: AsyncSession = Depends(get_db)) -> List[MLflowRunOut]:
    """
    Lists logged training runs compatible with MLflow run tracking metrics schemas.
    """
    repo = AgentMLOpsRepository(db)
    return await repo.list_mlflow_runs(agent_id=agent_id)

@router.post("/mlflow/runs", response_model=Dict[str, str])
async def log_mlflow_experiment_run(
    schema: MLflowRunCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permission("write:policies"))
) -> Dict[str, str]:
    """
    Logs hyperparameters and test metrics to standard MLflow run logs schema.
    """
    repo = AgentMLOpsRepository(db)
    service = MLOpsService(repo)
    res = await service.log_experiment_run(
        agent_id=schema.agent_id,
        run_name=schema.run_name,
        params=schema.parameters,
        metrics=schema.metrics
    )
    return res
