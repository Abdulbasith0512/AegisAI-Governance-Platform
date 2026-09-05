"""Tests for bearer-token type enforcement and WebSocket auth.

Pure (no DB): minting/validating JWTs exercises the real security module.
"""

import pytest

pytest.importorskip("fastapi")


async def test_refresh_token_rejected_as_bearer() -> None:
    """A refresh JWT must never authorize API calls."""
    from app.core.dependencies import get_token_payload
    from app.core.exceptions import AuthenticationException
    from app.core.security import create_refresh_token

    class _Redis:
        async def exists(self, key):
            return False

    token = create_refresh_token(subject="user@aegisai.test")
    with pytest.raises(AuthenticationException):
        await get_token_payload(token=token, redis=_Redis())


async def test_access_token_accepted_as_bearer() -> None:
    """A valid access JWT passes the type gate (revocation check mocked)."""
    from app.core.dependencies import get_token_payload
    from app.core.security import create_access_token

    class _Redis:
        async def exists(self, key):
            return False

    token = create_access_token(
        subject="user@aegisai.test", role="auditor", permissions=["read:transactions"]
    )
    payload = await get_token_payload(token=token, redis=_Redis())
    assert payload.sub == "user@aegisai.test"
    assert payload.role == "auditor"


async def test_ws_rejects_missing_token_when_bypass_off(monkeypatch) -> None:
    """WS without ?token= closes the door unless bypass is explicitly on."""
    from app.api.ws import _validate_ws_token
    from app.config.loader import settings
    from app.core.exceptions import AuthenticationException

    monkeypatch.setattr(settings, "ALLOW_DEV_BYPASS", False)
    with pytest.raises(AuthenticationException):
        _validate_ws_token(None)


async def test_ws_rejects_refresh_and_forged_tokens(monkeypatch) -> None:
    """WS accepts only access-type JWTs."""
    from app.api.ws import _validate_ws_token
    from app.config.loader import settings
    from app.core.exceptions import AuthenticationException
    from app.core.security import create_access_token, create_refresh_token

    monkeypatch.setattr(settings, "ALLOW_DEV_BYPASS", False)
    _validate_ws_token(
        create_access_token(subject="u@a.test", role="viewer", permissions=[])
    )
    with pytest.raises(AuthenticationException):
        _validate_ws_token(create_refresh_token(subject="u@a.test"))
    with pytest.raises(AuthenticationException):
        _validate_ws_token("forged.token.value")


async def test_ws_allows_missing_token_with_bypass_on(monkeypatch) -> None:
    """Explicit local-dev bypass still works when deliberately enabled."""
    from app.api.ws import _validate_ws_token
    from app.config.loader import settings

    monkeypatch.setattr(settings, "ENVIRONMENT", "development")
    monkeypatch.setattr(settings, "ALLOW_DEV_BYPASS", True)
    _validate_ws_token(None)  # must not raise
