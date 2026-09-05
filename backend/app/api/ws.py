"""WebSocket stream of live transaction execution events.

Route: WS /ws/transactions/{tx_id}?token=<JWT access token>

Streams the canonical envelopes from app.services.event_bus for one
transaction: transaction.received, agent.started/completed/failed,
policy.evaluated, trust.calculated, decision.created, review.created.

Auth: a valid access-type JWT is required via ?token=, except when the
explicit development bypass is enabled (ALLOW_DEV_BYPASS=true with
ENVIRONMENT=development). Invalid tokens are rejected with close code
4401 before subscribing.
"""

import asyncio
import logging
from typing import Optional

from fastapi import APIRouter, Query, WebSocket, WebSocketDisconnect

from app.config.loader import settings
from app.core.exceptions import AuthenticationException
from app.core.security import decode_token
from app.services.event_bus import event_bus

logger = logging.getLogger("aegisai.api.ws")

router = APIRouter(tags=["Execution Stream"])

HEARTBEAT_SECONDS = 20


def _dev_bypass_enabled() -> bool:
    return settings.ENVIRONMENT == "development" and settings.ALLOW_DEV_BYPASS


def _validate_ws_token(token: Optional[str]) -> None:
    """Raise AuthenticationException unless the token is a valid access JWT."""
    if not token:
        if _dev_bypass_enabled():
            return
        raise AuthenticationException("Authentication credentials are required.")
    try:
        payload = decode_token(token)
    except Exception as e:
        raise AuthenticationException("Invalid authentication signature.") from e
    if payload.get("type", "access") != "access":
        raise AuthenticationException("Invalid authentication signature.")
    if not payload.get("sub") or not payload.get("jti"):
        raise AuthenticationException("Invalid token credentials payload.")


@router.websocket("/ws/transactions/{tx_id}")
async def transaction_execution_stream(
    websocket: WebSocket,
    tx_id: str,
    token: Optional[str] = Query(default=None),
) -> None:
    """Stream execution events for one transaction until disconnect."""
    await websocket.accept()
    try:
        _validate_ws_token(token)
    except AuthenticationException:
        logger.warning("WS rejected tx_id=%s: invalid credentials", tx_id)
        await websocket.close(code=4401)
        return
    queue = await event_bus.subscribe(tx_id)
    logger.info("WS subscribed tx_id=%s", tx_id)
    try:
        while True:
            try:
                event = await asyncio.wait_for(queue.get(), timeout=HEARTBEAT_SECONDS)
            except asyncio.TimeoutError:
                # Heartbeat keeps idle connections (and their dedupe sets) alive
                await websocket.send_json({"type": "heartbeat", "transaction_id": tx_id})
                continue
            await websocket.send_json(event)
    except WebSocketDisconnect:
        logger.info("WS disconnected tx_id=%s", tx_id)
    except Exception as e:
        logger.warning("WS error tx_id=%s: %s", tx_id, e)
    finally:
        await event_bus.unsubscribe(tx_id, queue)
        try:
            await websocket.close()
        except Exception:
            pass
