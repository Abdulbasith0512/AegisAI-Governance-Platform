import uuid
from typing import List, Dict, Any
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.dependencies import get_db, require_permission
from app.models.users import User
from app.repositories.workflows import WorkflowRepository
from app.services.workflow_engine import WorkflowExecutionEngine
from app.schemas.workflows import (
    WorkflowCreate, WorkflowUpdate, WorkflowRead, WorkflowVersionRead, 
    ExecuteWorkflowRequest, WorkflowRunRead
)

router = APIRouter(
    prefix="/workflows",
    tags=["AI Governance Studio"],
    dependencies=[Depends(require_permission("read:transactions"))],
)

def get_workflow_repo(db: AsyncSession = Depends(get_db)) -> WorkflowRepository:
    return WorkflowRepository(db)

def get_engine(repo: WorkflowRepository = Depends(get_workflow_repo)) -> WorkflowExecutionEngine:
    return WorkflowExecutionEngine(repo)

# -----------------
# Workflows CRUD
# -----------------

@router.post("/", response_model=WorkflowRead, status_code=status.HTTP_201_CREATED)
async def create_workflow(
    workflow: WorkflowCreate,
    repo: WorkflowRepository = Depends(get_workflow_repo),
    current_user: User = Depends(require_permission("write:policies"))
):
    """Create a new Workflow draft and initialize version 1."""
    return await repo.create_workflow(workflow)

@router.get("/", response_model=List[WorkflowRead])
async def list_workflows(
    skip: int = 0, limit: int = 100, is_template: bool = None,
    repo: WorkflowRepository = Depends(get_workflow_repo)
):
    """Get all workflows, optionally filtering by template status."""
    return await repo.get_workflows(skip=skip, limit=limit, is_template=is_template)

@router.get("/{workflow_id}", response_model=WorkflowRead)
async def get_workflow(
    workflow_id: uuid.UUID,
    repo: WorkflowRepository = Depends(get_workflow_repo)
):
    workflow = await repo.get_workflow(workflow_id)
    if not workflow:
        raise HTTPException(status_code=404, detail="Workflow not found")
    return workflow

@router.put("/{workflow_id}", response_model=WorkflowRead)
async def update_workflow(
    workflow_id: uuid.UUID,
    update_data: WorkflowUpdate,
    repo: WorkflowRepository = Depends(get_workflow_repo),
    current_user: User = Depends(require_permission("write:policies"))
):
    workflow = await repo.update_workflow(workflow_id, update_data)
    if not workflow:
        raise HTTPException(status_code=404, detail="Workflow not found")
    return workflow

@router.delete("/{workflow_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_workflow(
    workflow_id: uuid.UUID,
    repo: WorkflowRepository = Depends(get_workflow_repo),
    current_user: User = Depends(require_permission("write:policies"))
):
    success = await repo.delete_workflow(workflow_id)
    if not success:
        raise HTTPException(status_code=404, detail="Workflow not found")
    return None

# -----------------
# Versions & Graph Configuration
# -----------------

@router.post("/versions/{version_id}/graph", response_model=WorkflowVersionRead)
async def save_workflow_graph(
    version_id: uuid.UUID,
    payload: Dict[str, Any],
    repo: WorkflowRepository = Depends(get_workflow_repo),
    current_user: User = Depends(require_permission("write:policies"))
):
    """
    Saves the React Flow JSON and converts it into SQL node/edge records.
    Payload expects: {"graph_data": {...}, "nodes": [...], "edges": [...]}
    """
    graph_data = payload.get("graph_data", {})
    nodes = payload.get("nodes", [])
    edges = payload.get("edges", [])
    
    version = await repo.save_workflow_graph(version_id, graph_data, nodes, edges)
    if not version:
        raise HTTPException(status_code=404, detail="Version not found")
    return version

# -----------------
# Execution Engine
# -----------------

@router.post("/versions/{version_id}/execute")
async def execute_workflow(
    version_id: uuid.UUID,
    request: ExecuteWorkflowRequest,
    repo: WorkflowRepository = Depends(get_workflow_repo),
    engine: WorkflowExecutionEngine = Depends(get_engine),
    current_user: User = Depends(require_permission("write:policies"))
):
    """
    Validates and executes a specific workflow version DAG.
    """
    # 1. Fetch Version and its nodes/edges
    # Note: A real app should use a specific repo method here, but we simplify for MVP
    # and just execute using the engine.
    
    # We need to fetch the version with nodes/edges loaded.
    from sqlalchemy import select
    from sqlalchemy.orm import selectinload
    from app.models.workflows import WorkflowVersion
    
    stmt = select(WorkflowVersion).options(
        selectinload(WorkflowVersion.nodes),
        selectinload(WorkflowVersion.edges)
    ).where(WorkflowVersion.id == version_id)
    
    result = await repo.db.execute(stmt)
    version = result.scalars().first()
    
    if not version:
        raise HTTPException(status_code=404, detail="Version not found")
        
    return await engine.execute_run(version, request.transaction_id, request.input_data)
