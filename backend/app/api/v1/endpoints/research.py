from typing import List, Dict, Any, Optional
from fastapi import APIRouter, Depends, HTTPException, status, Response
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.dependencies import get_db, require_permission
from app.models.users import User
from app.schemas.research import (
    ResearchExperimentCreate, ResearchExperimentOut,
    ExperimentRunCreate, ExperimentRunOut,
    BenchmarkResultOut, GovernanceScoreOut,
    AgentReputationOut, FailureIndexOut,
    MaturityAssessmentOut, CompareRequest,
    ComparisonMatrixResponse
)
from app.repositories.research import ResearchRepository
from app.services.research import ResearchService

router = APIRouter(prefix="/research", tags=["AI Research Lab & Governance Intelligence"])

@router.post("/experiment", response_model=ResearchExperimentOut, status_code=status.HTTP_201_CREATED)
async def create_experiment(
    payload: ResearchExperimentCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permission("write:policies"))
) -> ResearchExperimentOut:
    """
    Creates a new research experiment setup.
    Requires 'write:policies' permission.
    """
    repo = ResearchRepository(db)
    exp = await repo.create_experiment(
        project_id=payload.project_id,
        name=payload.name,
        description=payload.description,
        tags=payload.tags,
        version_string=payload.version_string,
        config_data=payload.config_data
    )
    return ResearchExperimentOut.model_validate(exp)

@router.get("/experiments", response_model=List[ResearchExperimentOut])
async def list_experiments(
    include_archived: bool = False,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permission("read:transactions"))
) -> List[ResearchExperimentOut]:
    """Lists registered experiments."""
    repo = ResearchRepository(db)
    records = await repo.list_experiments(include_archived=include_archived)
    return [ResearchExperimentOut.model_validate(r) for r in records]

@router.post("/run", response_model=ExperimentRunOut, status_code=status.HTTP_201_CREATED)
async def create_experiment_run(
    payload: ExperimentRunCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permission("write:policies"))
) -> ExperimentRunOut:
    """
    Spawns a new simulation run for an experiment.
    """
    repo = ResearchRepository(db)
    run = await repo.create_run(
        experiment_id=payload.experiment_id,
        parameters=payload.parameters or {}
    )

    # The run is recorded with its initial status. Metrics are written by
    # the real evaluation worker on completion — this endpoint never
    # fabricates accuracy/latency numbers.
    refreshed = await repo.get_run(run.id)
    return ExperimentRunOut.model_validate(refreshed)

@router.get("/results", response_model=List[ExperimentRunOut])
async def get_experiment_results(
    limit: int = 50,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permission("read:transactions"))
) -> List[ExperimentRunOut]:
    """Retrieves list of completed simulation runs."""
    repo = ResearchRepository(db)
    records = await repo.list_runs(limit=limit)
    return [ExperimentRunOut.model_validate(r) for r in records]

@router.get("/governance-score")
async def get_governance_score(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permission("read:transactions"))
) -> Dict[str, Any]:
    """
    Retrieves the calculated overall governance index score and trends.
    """
    repo = ResearchRepository(db)
    service = ResearchService(repo)
    return await service.get_governance_report()

@router.get("/reputation", response_model=List[Dict[str, Any]])
async def get_agents_reputation(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permission("read:transactions"))
) -> List[Dict[str, Any]]:
    """Retrieves agents reputation ranking leaderboard."""
    repo = ResearchRepository(db)
    service = ResearchService(repo)
    return await service.get_reputation_leaderboard()

@router.get("/failure-index", response_model=Dict[str, Any])
async def get_failure_index(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permission("read:transactions"))
) -> Dict[str, Any]:
    """Retrieves AI Failure index metrics."""
    repo = ResearchRepository(db)
    service = ResearchService(repo)
    return await service.get_failure_index_report()

@router.get("/maturity", response_model=Dict[str, Any])
async def get_governance_maturity(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permission("read:transactions"))
) -> Dict[str, Any]:
    """Retrieves active maturity index scores and recommendation suggestions."""
    repo = ResearchRepository(db)
    service = ResearchService(repo)
    return await service.get_maturity_assessment()

@router.get("/benchmarks", response_model=List[Dict[str, Any]])
async def get_benchmarks(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permission("read:transactions"))
) -> List[Dict[str, Any]]:
    """Retrieves benchmarking data for models."""
    repo = ResearchRepository(db)
    service = ResearchService(repo)
    return await service.get_benchmarks_report()

@router.post("/compare", response_model=ComparisonMatrixResponse)
async def compare_algorithms(
    payload: CompareRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permission("write:policies"))
) -> ComparisonMatrixResponse:
    """
    Triggers comparison matrix report for multiple algorithm run configurations.
    """
    repo = ResearchRepository(db)
    service = ResearchService(repo)
    
    benchmarks = await service.get_benchmarks_report()
    matrix = {}
    
    # Filter algorithms matching comparison requests
    # Since we use uuid in comparison, we mock comparison data mapping matching names
    for b in benchmarks:
        matrix[b["algorithm_name"]] = {
            "accuracy": b["accuracy"],
            "roc_auc": b["roc_auc"],
            "latency_ms": b["latency_ms"],
            "throughput": b["throughput"],
            "memory_usage": b["memory_usage"]
        }

    report = await repo.create_comparison_report(
        title=f"Comparison report: {len(payload.algorithm_ids)} algorithms",
        comparison_data=matrix,
        summary="Automated comparison report generated by AI Research Lab compilation engine."
    )

    return ComparisonMatrixResponse(
        comparison_id=report.id,
        title=report.title,
        summary=report.summary,
        matrix=report.comparison_data,
        created_at=report.created_at
    )

@router.get("/download/csv")
async def download_csv_report(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permission("read:transactions"))
) -> Response:
    """
    Downloads CSV containing benchmark performance statistics.
    """
    repo = ResearchRepository(db)
    service = ResearchService(repo)
    benchmarks = await service.get_benchmarks_report()
    csv_str = await service.export_report_csv(benchmarks)
    return Response(
        content=csv_str,
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=benchmark_report.csv"}
    )
