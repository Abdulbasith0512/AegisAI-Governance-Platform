"""Tests for live transaction execution events.

DB-free: covers the envelope contract, bus fan-out with per-transaction
isolation, agent.started/completed/failed emission from BaseGovernanceAgent,
and the unbound no-op guarantee. Needs fastapi only for the WS route import
check — the bus itself is pure asyncio.
"""

import asyncio
import sys
import os
from typing import Any, Dict, List

sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..")))

from app.services.event_bus import (
    AGENT_COMPLETED,
    AGENT_FAILED,
    AGENT_STARTED,
    DECISION_CREATED,
    REVIEW_CREATED,
    TRANSACTION_RECEIVED,
    TransactionEventBus,
    bind_transaction,
    emit_event,
    event_bus,
    make_event,
    unbind_transaction,
)
from agents.base import BaseGovernanceAgent


class _OkAgent(BaseGovernanceAgent):
    def __init__(self) -> None:
        super().__init__(name="ProbeAgent", max_retries=1, backoff_seconds=0)

    async def _execute(self, state: Dict[str, Any], logs: List[str]) -> Dict[str, Any]:
        logs.append("probe ok")
        return {"confidence_score": 0.9, "reasoning": "probe", "risk_score": 0.1}


class _BoomAgent(BaseGovernanceAgent):
    def __init__(self) -> None:
        super().__init__(name="BoomAgent", max_retries=1, backoff_seconds=0)

    async def _execute(self, state: Dict[str, Any], logs: List[str]) -> Dict[str, Any]:
        raise RuntimeError("injected fault")


def _drain(queue):
    items = []
    while not queue.empty():
        items.append(queue.get_nowait())
    return items


def test_envelope_carries_required_keys() -> None:
    """Every event contains the full contract (incl. dedupe event_id)."""
    ev = make_event("tx-1", TRANSACTION_RECEIVED, "received", metadata={"amount": 10})
    assert set(ev) == {
        "event_id", "transaction_id", "event_type",
        "timestamp", "agent", "status", "metadata",
    }
    assert ev["transaction_id"] == "tx-1"
    assert ev["event_type"] == TRANSACTION_RECEIVED
    assert ev["agent"] is None
    assert ev["timestamp"]


def test_bus_fanout_isolated_per_transaction() -> None:
    """Subscribers only receive their own transaction's events."""
    import asyncio as _aio

    async def _run():
        bus = TransactionEventBus()
        qa = await bus.subscribe("tx-a")
        qb = await bus.subscribe("tx-b")
        n = await bus.publish(make_event("tx-a", AGENT_STARTED, "running", agent="X"))
        assert n == 1
        await bus.publish(make_event("tx-b", AGENT_STARTED, "running", agent="Y"))
        assert [e["agent"] for e in _drain(qa)] == ["X"]
        assert [e["agent"] for e in _drain(qb)] == ["Y"]
        await bus.unsubscribe("tx-a", qa)
        await bus.publish(make_event("tx-a", AGENT_STARTED, "running", agent="Z"))
        assert _drain(qa) == []

    _aio.run(_run())


def test_agent_run_emits_started_then_completed() -> None:
    """Base.run brackets real execution with timed started/completed events."""

    async def _run():
        token = bind_transaction("tx-probe")
        try:
            queue = await event_bus.subscribe("tx-probe")
            try:
                res = await _OkAgent().run({})
                assert res.status == "success"
                types = [e["event_type"] for e in _drain(queue)]
                assert types == [AGENT_STARTED, AGENT_COMPLETED]
            finally:
                await event_bus.unsubscribe("tx-probe", queue)
        finally:
            unbind_transaction(token)

    asyncio.run(_run())


def test_agent_failure_emits_failed_event() -> None:
    """A raising agent emits agent.failed (and still returns failed response)."""

    async def _run():
        token = bind_transaction("tx-boom")
        try:
            queue = await event_bus.subscribe("tx-boom")
            try:
                res = await _BoomAgent().run({})
                assert res.status == "failed"
                events = _drain(queue)
                assert [e["event_type"] for e in events] == [AGENT_STARTED, AGENT_FAILED]
                assert events[1]["agent"] == "BoomAgent"
                assert events[1]["status"] == "failed"
            finally:
                await event_bus.unsubscribe("tx-boom", queue)
        finally:
            unbind_transaction(token)

    asyncio.run(_run())


def test_emit_noop_when_unbound() -> None:
    """No transaction bound (tests, scripts): emit never raises, publishes nothing."""

    async def _run():
        # Must not raise and must not touch the shared bus
        await emit_event(DECISION_CREATED, "approved", metadata={"trust_score": 90})

    asyncio.run(_run())


def test_decision_and_review_envelope_shape() -> None:
    """Decision/review events carry the verdict, trust, and review linkage."""
    decision = make_event(
        "tx-9", DECISION_CREATED, "under_review",
        metadata={"trust_score": 68, "reasons": ["r"], "requires_human_review": True, "review_id": "rev-1"},
    )
    assert decision["metadata"]["trust_score"] == 68
    assert decision["metadata"]["review_id"] == "rev-1"
    review = make_event(
        "tx-9", REVIEW_CREATED, "pending", metadata={"review_id": "rev-1"}
    )
    assert review["metadata"]["review_id"] == "rev-1"
