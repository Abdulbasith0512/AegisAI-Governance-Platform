"""WebSocket stream of live transaction execution events.

Route: WS /ws/transactions/{tx_id}

Streams the canonical envelopes from app.services.event_bus for one
transaction: transaction.received, agent.started/completed/failed,
policy.evaluated, trust.calculated, decision.created, review.created.

Auth follows the REST development bypass (no token required while
ENVIRONMENT=development). Production follow-up: validate a JWT on
connect (?token= or subprotocol) and close with 4401 when invalid.
"""

import asyncio
import logging

from fastapi import APIRouter, WebSocket, WebSocketDisconnect

from app.services.event_bus import event_bus

logger = logging.getLogger("aegisai.api.ws")

router = APIRouter(tags=["Execution Stream"])

HEARTBEAT_SECONDS = 20


@router.websocket("/ws/transactions/{tx_id}")
async def transaction_execution_stream(websocket: WebSocket, tx_id: str) -> None:
    """Stream execution events for one transaction until disconnect."""
    await websocket.accept()
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
