from contextlib import asynccontextmanager
from typing import AsyncGenerator
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config.loader import settings
from app.core.logging import setup_logging
from app.core.exceptions import register_exception_handlers
from app.api.swagger import customize_swagger
from app.api import health, version, ws
from app.api.v1.endpoints import auth, agents, transactions, compliance, chaos, explainability, users, admin, trust, consensus, reviews, observability, self_healing, copilot, graph, security, workflows, simulation, research, intelligence, audit
from app.middleware.prompt_firewall import PromptFirewallMiddleware
from app.middleware.rate_limit import RateLimitMiddleware

# Setup system-wide structured logging prior to server bootstrap
setup_logging()

@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncGenerator[None, None]:
    """
    Manages FastAPI application startup and shutdown lifespan cycles.
    """
    import logging as _logging

    _log = _logging.getLogger("aegisai.main")
    # Startup tasks: Init database pools, trigger connections checks.
    # Production fails fast on an unreachable database so the platform
    # never boots into silent mock behavior; development warns and
    # continues for offline work.
    try:
        from app.database.database import engine
        from app.models import Base
        async with engine.begin() as conn:
            await conn.run_sync(Base.metadata.create_all)
    except Exception as exc:
        if settings.ENVIRONMENT == "production":
            _log.critical("Database unreachable at startup in production; refusing to boot: %s", exc)
            raise
        _log.warning(f"Database connection skipped or failed: {exc}. Operating with mock/in-memory data.")
    yield
    # Shutdown tasks: release pooled connections cleanly.
    try:
        from app.database.database import engine as _engine
        from app.database.database import redis_client as _redis
        from app.database.database import qdrant_client as _qdrant
        from app.database.neo4j_db import Neo4jDatabaseManager

        await _engine.dispose()
        try:
            await _redis.aclose()
        except Exception as exc:
            _log.debug("Redis close skipped: %s", exc)
        try:
            _qdrant.close()
        except Exception as exc:
            _log.debug("Qdrant close skipped: %s", exc)
        try:
            Neo4jDatabaseManager().close()
        except Exception as exc:
            _log.debug("Neo4j close skipped: %s", exc)
    except Exception as exc:
        _logging.getLogger("aegisai.main").warning("Shutdown cleanup incomplete: %s", exc)

app: FastAPI = FastAPI(
    title=settings.PROJECT_NAME,
    version=settings.VERSION,
    lifespan=lifespan,
    docs_url="/docs",
    redoc_url="/redoc"
)

# NOTE: Starlette executes middleware in reverse registration order
# (last added = outermost = runs first). Register inner layers first so
# execution order is CORS -> RateLimit -> PromptFirewall: preflight OPTIONS
# is handled before auth/rate gates, and abusive traffic is throttled
# before inspection.
app.add_middleware(PromptFirewallMiddleware)
app.add_middleware(RateLimitMiddleware, limit=100, window_sec=60)
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Register Custom Exception Handler Policies
register_exception_handlers(app)


@app.get("/", tags=["System Control"])
async def root() -> dict:
    """Platform probe: confirms the gateway booted (used by Render and uptime checks)."""
    return {
        "name": settings.PROJECT_NAME,
        "version": settings.VERSION,
        "status": "running",
    }


# Register Core Infrastructure Endpoints
app.include_router(health.router)
app.include_router(version.router)
app.include_router(ws.router)

# Register Sub-module API Endpoints
app.include_router(auth.router, prefix="/api/v1")
app.include_router(users.router, prefix="/api/v1")
app.include_router(admin.router, prefix="/api/v1")
app.include_router(trust.router, prefix="/api/v1")
app.include_router(consensus.router, prefix="/api/v1")
app.include_router(reviews.router, prefix="/api/v1")
app.include_router(observability.router, prefix="/api/v1")
app.include_router(self_healing.router, prefix="/api/v1")
app.include_router(copilot.router, prefix="/api/v1")
app.include_router(graph.router, prefix="/api/v1")
app.include_router(agents.router, prefix="/api/v1")
app.include_router(transactions.router, prefix="/api/v1")
app.include_router(compliance.router, prefix="/api/v1")
app.include_router(chaos.router, prefix="/api/v1")
app.include_router(explainability.router, prefix="/api/v1")
app.include_router(security.router, prefix="/api/v1")
app.include_router(workflows.router, prefix="/api/v1")
app.include_router(simulation.router, prefix="/api/v1")
app.include_router(research.router, prefix="/api/v1")
app.include_router(intelligence.router, prefix="/api/v1")
app.include_router(audit.router, prefix="/api/v1")


# Apply Branding and Documentation Overrides to Swagger UI
customize_swagger(app)
