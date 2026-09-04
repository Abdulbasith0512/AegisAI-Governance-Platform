import logging
import uuid
from datetime import datetime, timezone
from typing import AsyncGenerator, Callable, List, Optional
from fastapi import Depends
from fastapi.security import OAuth2PasswordBearer
from redis.asyncio import Redis
from sqlalchemy.ext.asyncio import AsyncSession
from jose import JWTError
from qdrant_client import QdrantClient

from app.database.database import get_db_session, get_redis, get_qdrant
from app.config.loader import settings
from app.core.security import decode_token
from app.core.exceptions import AuthenticationException
from app.schemas.auth import TokenPayload
from app.repositories.user import UserRepository
from app.models.users import User

logger = logging.getLogger("aegisai.dependencies")

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/v1/auth/login", auto_error=False)

async def get_db(session: AsyncSession = Depends(get_db_session)) -> AsyncGenerator[AsyncSession, None]:
    """
    Yields active PostgreSQL database sessions.
    """
    yield session

async def get_cache(redis: Redis = Depends(get_redis)) -> AsyncGenerator[Redis, None]:
    """
    Yields Redis connection instance.
    """
    yield redis

def get_vector_db(qdrant: QdrantClient = Depends(get_qdrant)) -> QdrantClient:
    """
    Returns thread-safe Qdrant client.
    """
    return qdrant

async def get_token_payload(
    token: Optional[str] = Depends(oauth2_scheme),
    redis: Redis = Depends(get_cache)
) -> TokenPayload:
    """
    Parses and decodes bearer token signatures.
    Cross-checks JTI tokens against Redis blacklist registries.
    """
    if not token:
        if settings.ENVIRONMENT == "development":
            return TokenPayload(
                sub="dev@aegisai.com",
                jti="mock_jti",
                exp=9999999999,
                role="admin",
                permissions=["read:transactions", "write:transactions", "write:policies"]
            )
        raise AuthenticationException("Authentication credentials are required.")

    try:
        payload_data = decode_token(token)
        token_payload = TokenPayload(
            sub=payload_data.get("sub"),
            jti=payload_data.get("jti"),
            exp=payload_data.get("exp"),
            role=payload_data.get("role"),
            permissions=payload_data.get("permissions", [])
        )
        
        if not token_payload.sub or not token_payload.jti:
            raise AuthenticationException("Invalid token credentials payload.")
            
        # Check token identifier blacklist status
        is_revoked = await redis.exists(f"blacklist:{token_payload.jti}")
        if is_revoked:
            raise AuthenticationException("Token credentials session has been revoked.")
            
        return token_payload

    except JWTError as e:
        logger.error(f"JWT decode error: {e}")
        raise AuthenticationException("Invalid authentication signature.")

async def get_current_user(
    db: Optional[AsyncSession] = Depends(get_db),
    payload: TokenPayload = Depends(get_token_payload)
) -> User:
    """
    Injects the currently authenticated database User model.
    """
    if db is None:
        dev_perms = [type("Permission", (), {"name": p})() for p in (payload.permissions or ["read:transactions", "write:transactions", "write:policies"])]
        dev_role = type("Role", (), {"name": payload.role or "admin", "permissions": dev_perms})()
        return type("User", (), {
            "id": uuid.UUID("00000000-0000-0000-0000-000000000001"),
            "email": payload.sub or "dev@aegisai.com",
            "is_active": True,
            "role": dev_role
        })()

    try:
        user_repo = UserRepository(db)
        user = await user_repo.get_user_by_email(payload.sub)
        if not user:
            if settings.ENVIRONMENT == "development":
                user = await user_repo.create_mock_dev_user()
            else:
                raise AuthenticationException("User account not found.")
        if not user.is_active:
            raise AuthenticationException("User account is suspended.")
        return user
    except Exception as e:
        if settings.ENVIRONMENT == "development":
            dev_perms = [type("Permission", (), {"name": p})() for p in (payload.permissions or ["read:transactions", "write:transactions", "write:policies"])]
            dev_role = type("Role", (), {"name": payload.role or "admin", "permissions": dev_perms})()
            return type("User", (), {
                "id": uuid.UUID("00000000-0000-0000-0000-000000000001"),
                "email": payload.sub or "dev@aegisai.com",
                "is_active": True,
                "role": dev_role
            })()
        raise AuthenticationException(f"User authentication DB check failed: {e}")

def require_role(allowed_roles: List[str]) -> Callable:
    """
    Dynamic policy dependency checking if the user holds required role clearance.
    """
    def dependency(user: User = Depends(get_current_user)) -> User:
        if user.role.name not in allowed_roles:
            raise AuthenticationException("Insufficient role clearance permission levels.")
        return user
    return dependency

def require_permission(permission_name: str) -> Callable:
    """
    Dynamic policy dependency checking if the user holds atomic permission mappings.
    """
    def dependency(user: User = Depends(get_current_user)) -> User:
        user_permissions = [p.name for p in user.role.permissions]
        if permission_name not in user_permissions and "admin" not in [user.role.name]:
            raise AuthenticationException(f"Missing required permission: '{permission_name}'")
        return user
    return dependency
