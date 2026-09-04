import uuid
from datetime import datetime
from typing import List, Dict, Any, Optional
from fastapi import APIRouter, Depends, HTTPException, status, Response
from fastapi.responses import StreamingResponse
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.dependencies import get_db, require_permission
from app.models.users import User
from app.schemas.intelligence import (
    GovernanceScoreResponse, AgentLeaderboardResponse,
    MaturityReportResponse, FailureIndexResponse,
    BenchmarksReportResponse, GovernanceReportOut,
    BenchmarkRunOut, BenchmarkRunCreate,
    ReportGenerateRequest
)
from app.repositories.intelligence import IntelligenceRepository
from app.services.intelligence import IntelligenceService

router = APIRouter(prefix="/intelligence", tags=["AI Governance Intelligence Platform"])

@router.get("/governance-score", response_model=GovernanceScoreResponse)
async def get_governance_score(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permission("read:transactions"))
) -> GovernanceScoreResponse:
    """
    Retrieves the calculated overall governance index score and weekly/monthly trends.
    """
    repo = IntelligenceRepository(db)
    service = IntelligenceService(repo)
    res = await service.get_governance_score_report()
    return GovernanceScoreResponse(**res)

@router.get("/reputation", response_model=AgentLeaderboardResponse)
async def get_agents_reputation(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permission("read:transactions"))
) -> AgentLeaderboardResponse:
    """Retrieves dynamic agent reputations rankings leaderboard."""
    repo = IntelligenceRepository(db)
    service = IntelligenceService(repo)
    records = await service.get_agent_leaderboard()
    return AgentLeaderboardResponse(agents=records, leaderboard_date=datetime.utcnow())

@router.get("/maturity", response_model=MaturityReportResponse)
async def get_governance_maturity(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permission("read:transactions"))
) -> MaturityReportResponse:
    """Retrieves organizational AI governance maturity index progress scores."""
    repo = IntelligenceRepository(db)
    service = IntelligenceService(repo)
    res = await service.get_maturity_assessment()
    return MaturityReportResponse(
        maturity_level=res["maturity_level"],
        scores=res["scores"],
        recommendations=res["recommendations"],
        assessed_at=res["assessed_at"]
    )

@router.get("/failure-index", response_model=FailureIndexResponse)
async def get_failure_index(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permission("read:transactions"))
) -> FailureIndexResponse:
    """Retrieves AI Failure index severity telemetry checks."""
    repo = IntelligenceRepository(db)
    service = IntelligenceService(repo)
    res = await service.get_failure_index_report()
    return FailureIndexResponse(**res)

@router.get("/benchmarks", response_model=BenchmarksReportResponse)
async def get_benchmarks(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permission("read:transactions"))
) -> BenchmarksReportResponse:
    """Retrieves model/algorithm benchmark metrics comparison reports."""
    repo = IntelligenceRepository(db)
    service = IntelligenceService(repo)
    records = await service.get_benchmarks_report()
    return BenchmarksReportResponse(
        run_id=uuid.uuid4(),
        results=records,
        created_at=datetime.utcnow()
    )

@router.get("/reports", response_model=List[GovernanceReportOut])
async def list_governance_reports(
    limit: int = 50,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permission("read:transactions"))
) -> List[GovernanceReportOut]:
    """Lists generated executive reports."""
    repo = IntelligenceRepository(db)
    records = await repo.list_governance_reports(limit=limit)
    return [GovernanceReportOut.model_validate(r) for r in records]

@router.post("/benchmark/run", response_model=BenchmarkRunOut, status_code=status.HTTP_201_CREATED)
async def run_benchmark(
    payload: BenchmarkRunCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permission("write:policies"))
) -> BenchmarkRunOut:
    """
    Triggers a new model/algorithm benchmark execution.
    """
    repo = IntelligenceRepository(db)
    run = await repo.create_benchmark_run(parameters=payload.parameters or {})

    # The run is recorded with its initial status. Metrics are written by
    # the real benchmark worker on completion — this endpoint never
    # fabricates latency/throughput numbers.
    refreshed = await repo.get_benchmark_run(run.id)
    return BenchmarkRunOut.model_validate(refreshed)

@router.post("/report/generate", response_model=GovernanceReportOut, status_code=status.HTTP_201_CREATED)
async def generate_report(
    payload: ReportGenerateRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permission("write:policies"))
) -> GovernanceReportOut:
    """
    Generates and saves a new executive PDF/CSV/JSON report.
    """
    repo = IntelligenceRepository(db)
    service = IntelligenceService(repo)
    report = await service.generate_and_save_report(
        type_=payload.report_type,
        format_=payload.report_format,
        params=payload.parameters
    )
    return GovernanceReportOut.model_validate(report)

@router.get("/report/download/{report_id}")
async def download_report(
    report_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permission("read:transactions"))
) -> Response:
    """Downloads binary report bytes (PDF, CSV, JSON)."""
    repo = IntelligenceRepository(db)
    service = IntelligenceService(repo)
    content, media_type, filename = await service.get_report_bytes(report_id)
    return Response(
        content=content,
        media_type=media_type,
        headers={"Content-Disposition": f"attachment; filename={filename}"}
    )
