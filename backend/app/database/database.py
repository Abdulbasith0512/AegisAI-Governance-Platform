import logging
from typing import AsyncGenerator, Optional
from redis.asyncio import Redis, from_url
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine, async_sessionmaker
from sqlalchemy.orm import DeclarativeBase
from qdrant_client import QdrantClient
from app.config.loader import settings

logger = logging.getLogger("aegisai.database")

# 1. Async PostgreSQL Engine and Session Configuration
engine = create_async_engine(
    settings.DATABASE_URL,
    echo=False,
    pool_size=20,
    max_overflow=10,
    pool_pre_ping=True,
)

AsyncSessionLocal = async_sessionmaker(
    bind=engine,
    class_=AsyncSession,
    expire_on_commit=False,
    autocommit=False,
    autoflush=False,
)

class Base(DeclarativeBase):
    """
    Base class for all schema models in the PostgreSQL relational tier.
    """
    pass

async def get_db_session() -> AsyncGenerator[Optional[AsyncSession], None]:
    """
    FastAPI dependency yielding an asynchronous PostgreSQL database session.
    Yields None if database is unreachable in development mode.
    """
    session = AsyncSessionLocal()
    try:
        await session.execute(text("SELECT 1"))
        yield session
        await session.commit()
    except Exception as exc:
        await session.rollback()
        if settings.ENVIRONMENT == "development":
            logger.warning(f"PostgreSQL connection offline ({exc}). Yielding mock session for dev mode.")
            yield None
        else:
            raise
    finally:
        await session.close()

# 2. Redis Connection Manager
redis_client: Redis = from_url(settings.REDIS_URL, decode_responses=True)

async def get_redis() -> AsyncGenerator[Redis, None]:
    """
    FastAPI dependency yielding a Redis connection.
    """
    try:
        yield redis_client
    finally:
        # Client handles persistence internally, no explicit close needed on every request
        pass

# 3. Qdrant Client Builder
qdrant_client: QdrantClient = QdrantClient(url=settings.QDRANT_URL, api_key=settings.QDRANT_API_KEY or None)

def get_qdrant() -> QdrantClient:
    """
    Dependency returning the thread-safe Qdrant Client.
    """
    return qdrant_client
