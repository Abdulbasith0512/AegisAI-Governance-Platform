import os
import sys

# Add workspace root directory (parent of 'backend') to python path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "../..")))

# The test harness exercises authenticated endpoints without minting JWTs:
# it opts into the explicit development bypass. Production defaults stay
# fail-closed (ALLOW_DEV_BYPASS defaults to False in settings).
os.environ.setdefault("ALLOW_DEV_BYPASS", "true")

import pytest
import pytest_asyncio

# DB endpoint tests require a live Postgres (docker-compose `postgres`
# service). Set TEST_DATABASE_URL to run them, e.g.:
#   TEST_DATABASE_URL=postgresql+asyncpg://postgres:postgres_password@localhost:5432/aegisai_db
TEST_DATABASE_URL = os.getenv("TEST_DATABASE_URL", "")

requires_db = pytest.mark.skipif(
    not TEST_DATABASE_URL,
    reason="TEST_DATABASE_URL not set; DB endpoint tests skipped",
)


@pytest_asyncio.fixture(scope="module")
async def test_engine():
    sqlalchemy = pytest.importorskip("sqlalchemy")
    from sqlalchemy.ext.asyncio import create_async_engine

    engine = create_async_engine(TEST_DATABASE_URL)
    from app.models import Base

    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    yield engine
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)
    await engine.dispose()


@pytest_asyncio.fixture()
async def db_session(test_engine):
    from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker

    maker = async_sessionmaker(test_engine, class_=AsyncSession, expire_on_commit=False)
    async with maker() as session:
        yield session
        # Roll back any uncommitted state between tests
        await session.rollback()


@pytest_asyncio.fixture()
async def api_client(db_session):
    """ASGI client with the DB session overridden.

    Auth relies on the explicit development bypass (ALLOW_DEV_BYPASS=true,
    set above): get_token_payload returns a mock admin payload and
    get_current_user provisions a dev user, so no JWT fixtures are needed.
    Redis/Qdrant absences are fail-open by design.
    """
    pytest.importorskip("fastapi")
    pytest.importorskip("httpx")
    from httpx import AsyncClient, ASGITransport
    from app.main import app
    from app.database.database import get_db_session

    async def _override_session():
        yield db_session

    app.dependency_overrides[get_db_session] = _override_session
    try:
        async with AsyncClient(
            transport=ASGITransport(app=app), base_url="http://test"
        ) as client:
            yield client
    finally:
        app.dependency_overrides.clear()
