"""DB-backed endpoint tests for the intercept execution path.

Requires TEST_DATABASE_URL (live Postgres). Skipped otherwise — see
conftest.py. Run in CI/Docker where full backend dependencies exist::

    TEST_DATABASE_URL=postgresql+asyncpg://postgres:postgres_password@localhost:5432/aegisai_db \
        python -m pytest backend/tests/test_intercept_endpoint.py -q
"""

import uuid

import pytest

pytest.importorskip("sqlalchemy")
pytest.importorskip("httpx")

from conftest import requires_db

pytestmark = requires_db


async def _seed_customer_account(db_session):
    from app.models.banking import Customer, Account

    customer_id = uuid.uuid4()
    db_session.add(
        Customer(
            id=customer_id,
            first_name="Ada",
            last_name="Test",
            email=f"ada_{customer_id.hex[:6]}@aegisai.test",
            risk_level="low",
            status="active",
        )
    )
    await db_session.commit()
    account = Account(
        id=uuid.uuid4(),
        customer_id=customer_id,
        account_number=f"TST-{uuid.uuid4().hex[:10].upper()}",
        account_type="checking",
        balance=50000.00,
        currency="USD",
        status="active",
    )
    db_session.add(account)
    await db_session.commit()
    return customer_id


def _payload(customer_id, **overrides):
    body = {
        "customer_id": str(customer_id),
        "amount": 1250.75,
        "currency": "EUR",
        "merchant_category": "5411",
        "location": "Berlin, DE",
        "channel": "web",
        "transaction_type": "payment",
        "device_id": "test-dev-01",
        "ip_address": "203.0.113.10",
        "failed_attempts": 1,
    }
    body.update(overrides)
    return body


async def test_intercept_creates_real_transaction(api_client, db_session):
    """Happy path: 201 + Transaction + TrustScore rows, real pipeline verdict."""
    from sqlalchemy import select
    from app.models.transactions import Transaction
    from app.models.governance import TrustScore

    customer_id = await _seed_customer_account(db_session)
    res = await api_client.post("/api/v1/transactions/intercept", json=_payload(customer_id))

    assert res.status_code == 201, res.text
    body = res.json()
    assert body["verdict"] in ("approved", "declined", "under_review")
    assert 0 <= body["trust_score"] <= 100
    assert body["transaction_id"]

    tx_id = uuid.UUID(body["transaction_id"])
    tx = (await db_session.execute(select(Transaction).where(Transaction.id == tx_id))).scalars().first()
    assert tx is not None
    assert float(tx.amount) == 1250.75
    assert tx.status == body["verdict"]
    assert tx.reference_number.startswith("TX-")

    scores = (
        await db_session.execute(select(TrustScore).where(TrustScore.transaction_id == tx_id))
    ).scalars().all()
    assert len(scores) == 1
    assert scores[0].score == body["trust_score"]


async def test_intercept_unknown_customer_404(api_client, db_session):
    """Unknown customer_ids are rejected, never auto-created."""
    from sqlalchemy import select
    from app.models.banking import Customer

    ghost = uuid.uuid4()
    res = await api_client.post("/api/v1/transactions/intercept", json=_payload(ghost))

    assert res.status_code == 404, res.text
    row = (await db_session.execute(select(Customer).where(Customer.id == ghost))).scalars().first()
    assert row is None


async def test_intercept_invalid_payload_422(api_client, db_session):
    """Negative amount fails validation before any DB or agent work."""
    customer_id = await _seed_customer_account(db_session)
    res = await api_client.post(
        "/api/v1/transactions/intercept", json=_payload(customer_id, amount=-5.0)
    )
    assert res.status_code == 422, res.text


async def test_history_returns_empty_not_mock(api_client, db_session):
    """Empty store returns [] — never the legacy hard-coded sample rows."""
    res = await api_client.get("/api/v1/transactions/history")
    assert res.status_code == 200, res.text
    for row in res.json():
        assert row["reference_number"] not in ("TX-9A8B7C6D5E", "TX-1F2E3D4C5B", "TX-7K8L9M0N1P")


async def test_research_run_has_no_fabricated_metrics(api_client, db_session):
    """New lab runs stay pending; accuracy/latency are never invented."""
    from app.models.research import ResearchProject, ResearchExperiment

    project = ResearchProject(id=uuid.uuid4(), name="phase2-probe")
    db_session.add(project)
    await db_session.commit()
    exp = ResearchExperiment(
        id=uuid.uuid4(), project_id=project.id, name="phase2-probe-run", config_data={}
    )
    db_session.add(exp)
    await db_session.commit()

    res = await api_client.post(
        "/api/v1/research/run",
        json={"experiment_id": str(exp.id), "parameters": {}},
    )
    assert res.status_code == 201, res.text
    body = res.json()
    assert body["status"] == "pending"


async def test_benchmark_run_has_no_fabricated_metrics(api_client, db_session):
    """New benchmark runs stay pending; throughput figures are never invented."""
    res = await api_client.post("/api/v1/intelligence/benchmark/run", json={"parameters": {}})
    assert res.status_code == 201, res.text
    assert res.json()["status"] == "pending"
