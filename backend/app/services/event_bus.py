"""In-process transaction event bus for live execution updates.

Single uvicorn worker (see backend/Dockerfile CMD) makes in-process
delivery exact. If the deployment ever scales past one worker, replace
_publish/_subscribe internals with Redis pub/sub — the make_event envelope
and module API stay identical.

Production auth follow-up: the WS route currently relies on the same
development bypass as the REST layer. Before exposing WS publicly, validate
a JWT (e.g. ?token= or subprotocol) on connect and close with 4401.
"""

from __future__ import annotations

import asyncio
import contextvars
import logging
import uuid
from collections import defaultdict
from datetime import datetime, timezone
from typing import Any, Callable, Dict, List, Optional

logger = logging.getLogger("aegisai.events")

# Canonical execution event types emitted during one intercept run.
TRANSACTION_RECEIVED = "transaction.received"
AGENT_STARTED = "agent.started"
AGENT_COMPLETED = "agent.completed"
AGENT_FAILED = "agent.failed"
POLICY_EVALUATED = "policy.evaluated"
TRUST_CALCULATED = "trust.calculated"
DECISION_CREATED = "decision.created"
REVIEW_CREATED = "review.created"


def make_event(
    transaction_id: str,
    event_type: str,
    status: str,
    agent: Optional[str] = None,
    metadata: Optional[Dict[str, Any]] = None,
) -> Dict[str, Any]:
    """Build the canonical execution event envelope.

    Every event carries: event_id (dedupe key), transaction_id, event_type,
    timestamp (UTC ISO), agent (when applicable), status, metadata.
    """
    return {
        "event_id": uuid.uuid4().hex,
        "transaction_id": str(transaction_id),
        "event_type": event_type,
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "agent": agent,
        "status": status,
        "metadata": metadata or {},
    }


class TransactionEventBus:
    """Async fan-out keyed by transaction ID."""

    def __init__(self) -> None:
        self._subscribers: Dict[str, List[asyncio.Queue]] = defaultdict(list)
        self._lock = asyncio.Lock()

    async def publish(self, event: Dict[str, Any]) -> int:
        """Deliver to all subscribers of event['transaction_id']. Returns fan-out count."""
        tx_id = str(event.get("transaction_id", ""))
        async with self._lock:
            queues = list(self._subscribers.get(tx_id, []))
        for queue in queues:
            try:
                queue.put_nowait(event)
            except asyncio.QueueFull:
                logger.warning("Event subscriber queue full tx_id=%s; dropping event.", tx_id)
        return len(queues)

    async def subscribe(self, transaction_id: str) -> asyncio.Queue:
        """Register a personal queue; pair with unsubscribe() on disconnect."""
        queue: asyncio.Queue = asyncio.Queue(maxsize=200)
        async with self._lock:
            self._subscribers[str(transaction_id)].append(queue)
        return queue

    async def unsubscribe(self, transaction_id: str, queue: asyncio.Queue) -> None:
        async with self._lock:
            queues = self._subscribers.get(str(transaction_id), [])
            if queue in queues:
                queues.remove(queue)
            if not queues:
                self._subscribers.pop(str(transaction_id), None)


# Shared singleton: endpoint emits, WS route consumes, agents emit via state.
event_bus = TransactionEventBus()

# Type of the emit callable agents receive through graph state["_emit"].
EmitFn = Callable[[Dict[str, Any]], Any]

# Request-scoped emit binding. The intercept endpoint binds its transaction
# ID here for the duration of compiled_graph.ainvoke(); agents resolve it
# without any signature or graph-schema changes. Unset everywhere else.
_current_tx: contextvars.ContextVar[Optional[str]] = contextvars.ContextVar(
    "aegisai_tx_id", default=None
)


def bind_transaction(transaction_id: str):
    """Bind a transaction ID for the current execution context. Returns the reset token."""
    return _current_tx.set(str(transaction_id))


def unbind_transaction(token) -> None:
    """Release a binding created by bind_transaction."""
    _current_tx.reset(token)


async def emit_event(
    event_type: str,
    status: str,
    agent: Optional[str] = None,
    metadata: Optional[Dict[str, Any]] = None,
    transaction_id: Optional[str] = None,
) -> None:
    """Publish one execution event. No-ops when no transaction is bound
    (tests, scripts, other callers) — never raises into agent logic."""
    tx_id = transaction_id or _current_tx.get()
    if not tx_id:
        return
    try:
        await event_bus.publish(make_event(tx_id, event_type, status, agent, metadata))
    except Exception as e:
        logger.warning("Event publish failed tx_id=%s: %s", tx_id, e)
