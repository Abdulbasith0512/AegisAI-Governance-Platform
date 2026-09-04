from contextlib import asynccontextmanager
from typing import AsyncGenerator
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config.loader import settings
from app.core.logging import setup_logging
from app.core.exceptions import register_exception_handlers
from app.api.swagger import customize_swagger
from app.api import health, version, ws
from app.api.v1.endpoints import auth, agents, transactions, compliance, chaos, explainability, users, admin, trust, consensus, reviews, observability, self_healing, copilot, graph, security, workflows, simulation, research, intelligence
from app.middleware.prompt_firewall import PromptFirewallMiddleware
from app.middleware.rate_limit import RateLimitMiddleware

# Setup system-wide structured logging prior to server bootstrap
setup_logging()

@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncGenerator[None, None]:
    """
    Manages FastAPI application startup and shutdown lifespan cycles.
    """
    # Startup tasks: Init database pools, trigger connections checks
    try:
        from app.database.database import engine
        from app.models import Base
        async with engine.begin() as conn:
            await conn.run_sync(Base.metadata.create_all)
    except Exception as exc:
        import logging
        logging.getLogger("aegisai.main").warning(f"Database connection skipped or failed: {exc}. Operating with mock/in-memory data.")
    yield
    # Shutdown tasks: Clean connections and free memory
    pass

app: FastAPI = FastAPI(
    title=settings.PROJECT_NAME,
    version=settings.VERSION,
    lifespan=lifespan,
    docs_url="/docs",
    redoc_url="/redoc"
)

# Enable CORS configurations
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Add rate limiting and prompt firewall protection
app.add_middleware(RateLimitMiddleware, limit=100, window_sec=60)
app.add_middleware(PromptFirewallMiddleware)

# Register Custom Exception Handler Policies
register_exception_handlers(app)

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


# Apply Branding and Documentation Overrides to Swagger UI
customize_swagger(app)
