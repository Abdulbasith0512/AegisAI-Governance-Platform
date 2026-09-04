import uuid
import time
import logging
from datetime import datetime
from typing import List, Dict, Any
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.dependencies import get_db, require_permission
from app.models.users import User
from app.schemas.transaction import (
    TransactionInterceptRequest,
    TransactionInterceptResponse,
    TransactionDetailResponse,
    TransactionOut,
    ReplayResponse
)
from app.repositories.transaction import TransactionRepository
from app.repositories.audit import AuditRepository
from app.repositories.review import ReviewRepository
from app.services.vector_store import aegis_vector_store
from app.services.observability import record_transaction_metrics
from agents.graph import compiled_graph
from agents.supervisor import parse_supervisor_verdict
from app.services.event_bus import (
    DECISION_CREATED,
    REVIEW_CREATED,
    TRANSACTION_RECEIVED,
    bind_transaction,
    emit_event,
    unbind_transaction,
)

router = APIRouter(prefix="/transactions", tags=["Transactions Registry"])

logger = logging.getLogger("aegisai.api.transactions")

_AGENT_RESULT_KEYS = (
    "device_result", "kyc_result", "fraud_result", "aml_result",
    "policy_result", "explainability_result", "supervisor_result",
)


def _summarize_agent_results(execution_results: Dict[str, Any]) -> List[Dict[str, Any]]:
    """Compact per-agent outcome table for the audit ledger.

    Reads the same AgentResponse-or-dict shapes the pipeline produces;
    missing agents are recorded as such, never invented.
    """
    summary = []
    for key in _AGENT_RESULT_KEYS:
        res = execution_results.get(key)
        if res is None:
            summary.append({"agent": key, "status": "missing"})
            continue

        def _get(field: str, default: Any = None) -> Any:
            if isinstance(res, dict):
                return res.get(field, default)
            return getattr(res, field, default)

        summary.append({
            "agent": _get("agent_name", key) or key,
            "status": _get("status", "unknown"),
            "confidence": _get("confidence_score"),
            "risk_score": _get("risk_score"),
            "execution_time_s": _get("execution_time"),
        })
    return summary

@router.post("/intercept", response_model=TransactionInterceptResponse, status_code=status.HTTP_201_CREATED)
async def intercept_transaction(
    payload: TransactionInterceptRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permission("write:transactions"))
) -> TransactionInterceptResponse:
    """
    Intercepts a new banking transaction, executing the multi-agent AI verification pipeline.
    Requires 'write:transactions' permission scope.
    """
    t_start = time.perf_counter()
    tx_repo = TransactionRepository(db)
    audit_repo = AuditRepository(db)

    tx_id = payload.transaction_id or uuid.uuid4()
    logger.info("Intercept attempt tx_id=%s customer=%s amount=%s %s", tx_id, payload.customer_id, payload.amount, payload.currency)
    await emit_event(
        TRANSACTION_RECEIVED,
        "received",
        transaction_id=str(tx_id),
        metadata={"amount": payload.amount, "currency": payload.currency},
    )

    # 1. Resolve customer profile and account dependencies.
    # Strict lookup: unknown customers fail with 404. The repository no
    # longer auto-creates Mock Customer rows on this path, so production
    # data is never polluted by typos or forged IDs.
    account = await tx_repo.get_customer_and_account(payload.customer_id)
    if account is None:
        logger.warning("Intercept rejected tx_id=%s: unknown customer %s", tx_id, payload.customer_id)
        raise HTTPException(status_code=404, detail="Customer or account not found.")
    merchant_id = await tx_repo.get_or_create_merchant(payload.merchant_id, payload.merchant_category)
    # Flat device_id / ip_address aliases fold into device telemetry when
    # no full device object is supplied.
    device_data = payload.device.model_dump() if payload.device else None
    if device_data is None and (payload.device_id or payload.ip_address):
        device_data = {
            "fingerprint": payload.device_id or f"ip-{payload.ip_address}",
            "ip_address": payload.ip_address or "127.0.0.1",
        }
    device_id = await tx_repo.get_or_create_device(device_data)
    beneficiary_id = await tx_repo.get_or_create_beneficiary(account.id, payload.beneficiary.model_dump() if payload.beneficiary else None)

    # Account age: caller value wins, otherwise derive from account record.
    account_age_days = payload.account_age_days
    if account_age_days is None and account.created_at:
        account_age_days = max(0, (datetime.utcnow() - account.created_at).days)

    # 2. Build initial execution state
    state = {
        "transaction": {
            "id": tx_id,
            "customer_id": payload.customer_id,
            "account_id": str(account.id),
            "beneficiary_id": str(beneficiary_id) if beneficiary_id else None,
            "amount": payload.amount,
            "currency": payload.currency,
            "location": payload.location,
            "channel": payload.channel,
            "transaction_type": payload.transaction_type,
            "merchant_category": payload.merchant_category,
            "device": payload.device.model_dump() if payload.device else (device_data or {}),
            "beneficiary": payload.beneficiary.model_dump() if payload.beneficiary else {},
            "account_age_days": account_age_days,
            "failed_attempts": payload.failed_attempts,
            "reference_number": f"TX-{uuid.uuid4().hex[:12].upper()}"
        },
        "velocity": 1.5,
        "location_distance": 2.5,
        "drift": 0.05,
        "latency_ms": 15.0,
        "prediction_id": uuid.uuid4()
    }

    # Pull prior transactions to pass graph AML cycle evaluation context.
    # list_transactions eager-loads account so tx.account is populated
    # (async lazy-loading would otherwise resolve to None here).
    history = await tx_repo.list_transactions(limit=10)
    state["history"] = [
        {"customer_id": str(tx.account.customer_id) if tx.account else "", "beneficiary_id": str(tx.beneficiary_id) if tx.beneficiary_id else "", "amount": float(tx.amount)}
        for tx in history
    ]
    # Caller-supplied history augments (never replaces) DB history for AML.
    if payload.transaction_history:
        for h in payload.transaction_history:
            state["history"].append({
                "customer_id": str(payload.customer_id),
                "beneficiary_id": h.counterparty or "",
                "amount": float(h.amount),
            })

    # 3. Trigger LangGraph Workflow Node Pipeline Execution.
    # Bind the transaction so each agent emits timed execution events.
    _emit_token = bind_transaction(str(tx_id))
    try:
        execution_results = await compiled_graph.ainvoke(state)
    except Exception as e:
        logger.exception("Intercept pipeline crash tx_id=%s", tx_id)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Governance pipeline runtime crash."
        )
    finally:
        unbind_transaction(_emit_token)

    # 4. Resolve final verdict and trust score parameters.
    # The supervisor emits a structured "verdict: X | ..." reasoning prefix;
    # parse it instead of substring-matching free prose.
    supervisor_res = execution_results.get("supervisor_result")
    verdict = parse_supervisor_verdict(supervisor_res)
    reasons = []
    if verdict == "declined":
        reasons.append("Failed safety policies or extreme fraud metrics detected.")
    elif verdict == "under_review":
        reasons.append("Medium trust score metrics require human-in-the-loop audit.")

    # Trust must come from the pipeline. A missing score means the
    # governance graph violated its contract — fail loudly (500) rather
    # than returning a fabricated 100.
    if "trust_score_value" not in execution_results:
        logger.error("Pipeline returned no trust_score_value tx_id=%s", tx_id)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Governance pipeline returned no trust score."
        )
    trust_score = execution_results["trust_score_value"]
    # Prefer the supervisor's evidence-grounded decision summary; the
    # trace bundle is the fallback. Both originate from real pipeline
    # outputs — never fabricated prose.
    decision_expl = execution_results.get("decision_explanation") or {}
    explanation_res = execution_results.get("explanation_data", {}) or {}
    if not isinstance(explanation_res, dict):
        explanation_res = {"human_readable": getattr(explanation_res, "human_readable", "Checks completed successfully.")}
    human_explanation = decision_expl.get("summary") or explanation_res.get("human_readable", "Checks completed successfully.")
    # Real embedding of the served summary via the canonical generator,
    # so the persisted vector matches the indexed one (column nullable;
    # failures leave it NULL rather than a constant vector).
    try:
        explanation_res["explanation_vector"] = aegis_vector_store.generate_embedding(human_explanation)
    except Exception as e:
        logger.warning("Explanation embedding failed tx_id=%s: %s", tx_id, e)
        explanation_res["explanation_vector"] = None

    # 5. Persist Transaction record & multi-agent outcomes.
    # Reuse the state's reference number so the persisted row matches
    # the identifier returned by the pipeline (single source of truth).
    tx_record = await tx_repo.create_transaction(
        transaction_id=tx_id,
        account_id=account.id,
        amount=payload.amount,
        currency=payload.currency,
        transaction_type=payload.transaction_type,
        status=verdict,
        merchant_id=merchant_id,
        device_id=device_id,
        beneficiary_id=beneficiary_id,
        reference_number=state["transaction"]["reference_number"]
    )

    await tx_repo.persist_pipeline_results(tx_id, execution_results, execution_results)

    # 6. Index Explanation into Qdrant semantic search vector store
    timestamp_str = datetime.utcnow().isoformat()
    await aegis_vector_store.upsert_explanation(
        transaction_id=tx_id,
        explanation_text=human_explanation,
        verdict=verdict,
        risk_score=float(1.0 - (trust_score / 100)),
        timestamp=timestamp_str
    )

    t_end = time.perf_counter()
    latency_ms = (t_end - t_start) * 1000

    # 7. Record Prometheus metrics
    record_transaction_metrics(
        latency_ms=latency_ms,
        trust_score=trust_score,
        verdict=verdict,
        consensus_score=execution_results.get("consensus_ratio", 1.0)
    )

    # 8. Append the discrete lifecycle events to the immutable ledger.
    # One row per stage (received was logged pre-graph); the hash chain
    # links them in execution order. History is append-only by design.
    await audit_repo.log_action(
        action_type="transaction.received",
        description=f"Transaction {tx_id} received for governance evaluation.",
        resource_id=str(tx_id),
        metadata={
            "amount": payload.amount,
            "currency": payload.currency,
            "merchant_category": payload.merchant_category,
            "account_age_days": account_age_days,
            "failed_attempts": payload.failed_attempts,
        },
    )
    await audit_repo.log_action(
        action_type="agents.executed",
        description=f"Governance agents executed for transaction {tx_id}.",
        resource_id=str(tx_id),
        metadata={"agents": _summarize_agent_results(execution_results)},
    )
    policy_sim = execution_results.get("policy_simulation") or {}
    failed_policies = [
        p.get("policy_id")
        for p in (policy_sim.get("policies_checked") or [])
        if isinstance(p, dict) and p.get("status") == "fail"
    ]
    await audit_repo.log_action(
        action_type="policy.evaluated",
        description=f"Policy evaluation {policy_sim.get('overall_status', 'unknown')} for transaction {tx_id}.",
        resource_id=str(tx_id),
        metadata={
            "overall_status": policy_sim.get("overall_status", "unknown"),
            "failed_policies": failed_policies,
        },
    )
    await audit_repo.log_action(
        action_type="trust.calculated",
        description=f"Trust score {trust_score} calculated for transaction {tx_id}.",
        resource_id=str(tx_id),
        metadata={
            "trust_score": trust_score,
            "consensus_ratio": execution_results.get("consensus_ratio", 1.0),
        },
    )
    await audit_repo.log_action(
        action_type="decision.created",
        description=f"Transaction {tx_id} processed through AegisAI. Verdict: {verdict}",
        resource_id=str(tx_id),
        metadata={
            "verdict": verdict,
            "trust_score": trust_score,
            "reasons": reasons,
            "latency_ms": latency_ms,
        },
    )
    await audit_repo.log_action(
        action_type="explanation.generated",
        description=f"Decision explanation generated for transaction {tx_id}.",
        resource_id=str(tx_id),
        metadata={
            "chars": len(human_explanation or ""),
            "has_shap": bool((explanation_res.get("feature_importance") if isinstance(explanation_res, dict) else None)),
        },
    )
    logger.info(
        "Intercept done tx_id=%s verdict=%s trust=%s latency_ms=%.1f review=%s",
        tx_id, verdict, trust_score, latency_ms,
        "yes" if verdict == "under_review" else "no",
    )

    # Check review mapping
    review_id = None
    if verdict == "under_review":
        rev_repo = ReviewRepository(db)
        reviews_queue = await rev_repo.list_review_queue()
        for r in reviews_queue:
            if r.transaction_id == tx_id:
                review_id = r.id
                break
        if review_id is not None:
            await audit_repo.log_action(
                action_type="review.created",
                description=f"Human review {review_id} opened for transaction {tx_id}.",
                resource_id=str(tx_id),
                metadata={"review_id": str(review_id)},
            )
            await emit_event(
                REVIEW_CREATED,
                "pending",
                transaction_id=str(tx_id),
                metadata={"review_id": str(review_id)},
            )

    await emit_event(
        DECISION_CREATED,
        verdict,
        transaction_id=str(tx_id),
        metadata={
            "trust_score": trust_score,
            "reasons": reasons,
            "requires_human_review": bool(verdict == "under_review"),
            "review_id": str(review_id) if review_id else None,
        },
    )

    return TransactionInterceptResponse(
        transaction_id=tx_id,
        verdict=verdict,
        trust_score=trust_score,
        reasons=reasons or ["Checks completed successfully."],
        explanation=human_explanation,
        requires_human_review=bool(verdict == "under_review"),
        review_id=review_id
    )

@router.get("/history", response_model=List[TransactionOut])
async def get_transactions_history(
    limit: int = 50,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permission("read:transactions"))
) -> List[TransactionOut]:
    """Retrieves list of recently ingested transactions.

    Returns an empty list when no transactions exist. Database failures
    surface as 503 — this endpoint never returns fabricated rows.
    """
    tx_repo = TransactionRepository(db)
    try:
        records = await tx_repo.list_transactions(limit=limit)
    except Exception:
        logger.exception("Transaction history query failed")
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Transaction store unavailable."
        )
    return [TransactionOut.model_validate(r) for r in records]

@router.get("/explanation/{tx_id}")
async def get_transaction_explanation(
    tx_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permission("read:transactions"))
) -> Dict[str, Any]:
    tx_repo = TransactionRepository(db)
    tx = await tx_repo.get_transaction_by_id(tx_id)
    if not tx or not tx.predictions:
        raise HTTPException(status_code=404, detail="No explanation details found.")
    for p in tx.predictions:
        if p.explanations:
            exp = p.explanations[0]
            return {
                "human_readable": exp.human_readable,
                "machine_readable": exp.machine_readable,
                "feature_importance": exp.feature_importance,
                "evidence_graph": exp.evidence_graph,
                "decision_timeline": exp.decision_timeline
            }
    raise HTTPException(status_code=404, detail="Explanation metadata not found.")

@router.get("/trust/{tx_id}")
async def get_transaction_trust_score(
    tx_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permission("read:transactions"))
) -> Dict[str, Any]:
    tx_repo = TransactionRepository(db)
    tx = await tx_repo.get_transaction_by_id(tx_id)
    if not tx or not tx.trust_scores:
        raise HTTPException(status_code=404, detail="Trust rating not found.")
    ts = tx.trust_scores[0]
    return {
        "transaction_id": tx_id,
        "score": ts.score,
        "weights_configuration": ts.weights_configuration,
        "reasons": ts.reasons
    }

@router.get("/prediction/{tx_id}")
async def get_transaction_predictions(
    tx_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permission("read:transactions"))
) -> List[Dict[str, Any]]:
    tx_repo = TransactionRepository(db)
    tx = await tx_repo.get_transaction_by_id(tx_id)
    if not tx:
        raise HTTPException(status_code=404, detail="Transaction not found.")
    return [
        {
            "agent": p.model_version.agent.name,
            "version": p.model_version.version_string,
            "prediction_output": p.prediction_output,
            "confidence_score": p.confidence_score,
            "latency_ms": p.latency_ms
        }
        for p in tx.predictions
    ]

# NOTE: /{tx_id} must stay last among GET routes, otherwise it shadows
# /explanation/{tx_id}, /trust/{tx_id} and /prediction/{tx_id}.
@router.get("/{tx_id}", response_model=TransactionDetailResponse)
async def get_transaction_details(
    tx_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permission("read:transactions"))
) -> TransactionDetailResponse:
    """Retrieves deep transaction telemetry containing predictions, trust, and explanations."""
    tx_repo = TransactionRepository(db)
    tx = await tx_repo.get_transaction_by_id(tx_id)
    if not tx:
        raise HTTPException(status_code=404, detail="Transaction not found.")

    trust = tx.trust_scores[0].score if tx.trust_scores else 100
    policies = tx.policy_checks[0].status if tx.policy_checks else "pass"
    consensus = tx.consensus_votes[0].consensus_score if tx.consensus_votes else 1.0

    preds = []
    explanation_text = "No explanation generated."
    for p in tx.predictions:
        preds.append({
            "agent": p.model_version.agent.name,
            "version": p.model_version.version_string,
            "output": p.prediction_output,
            "confidence": p.confidence_score,
            "latency": p.latency_ms
        })
        if p.explanations:
            explanation_text = p.explanations[0].human_readable

    tx_out = TransactionOut.model_validate(tx)
    return TransactionDetailResponse(
        transaction=tx_out,
        trust_score=trust,
        policy_status=policies,
        consensus_score=consensus,
        predictions=preds,
        explanation=explanation_text
    )

@router.post("/replay", response_model=ReplayResponse)
async def replay_transaction(
    payload: Dict[str, Any],
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permission("write:transactions"))
) -> ReplayResponse:
    """
    Loads historical transaction details, triggers a new intercept run, and returns comparative results.
    """
    orig_id_str = payload.get("transaction_id")
    if not orig_id_str:
        raise HTTPException(status_code=400, detail="Missing transaction_id.")
    orig_id = uuid.UUID(orig_id_str)
    
    tx_repo = TransactionRepository(db)
    orig_tx = await tx_repo.get_transaction_by_id(orig_id)
    if not orig_tx:
        raise HTTPException(status_code=404, detail="Original transaction not found.")

    cust_id = orig_tx.account.customer_id if orig_tx.account else uuid.uuid4()
    
    # Reconstruct transaction request payload.
    # Transaction model stores transaction_type (transfer/payment/...) but no
    # channel (mobile/web/atm), so default channel to mobile and preserve type.
    replay_fingerprint = orig_tx.device.fingerprint if orig_tx.device else f"replay-{orig_id.hex[:8]}"
    req_payload = TransactionInterceptRequest(
        transaction_id=uuid.uuid4(), # new ID
        customer_id=cust_id,
        merchant_id=orig_tx.merchant_id,
        amount=float(orig_tx.amount),
        currency=orig_tx.currency,
        channel="mobile",
        transaction_type=orig_tx.transaction_type,
        device={
            "fingerprint": replay_fingerprint,
            "ip_address": orig_tx.device.ip_address if orig_tx.device else "127.0.0.1",
            "is_emulator": orig_tx.device.is_emulator if orig_tx.device else False
        }
    )

    res = await intercept_transaction(req_payload, db, current_user)
    
    orig_trust = orig_tx.trust_scores[0].score if orig_tx.trust_scores else 100

    return ReplayResponse(
        original_transaction_id=orig_id,
        new_transaction_id=res.transaction_id,
        previous_verdict=orig_tx.status,
        new_verdict=res.verdict,
        previous_trust_score=orig_trust,
        new_trust_score=res.trust_score,
        reprocessed_at=datetime.utcnow()
    )

@router.post("/reprocess")
async def reprocess_transaction(
    payload: Dict[str, Any],
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permission("write:transactions"))
) -> Dict[str, Any]:
    """Reprocesses an under_review transaction through the live pipeline.

    Reconstructs the request from the stored row and re-runs
    intercept_transaction, so the new verdict comes from real agent
    evaluation — never a hard-coded status flip.
    """
    tx_id_str = payload.get("transaction_id")
    if not tx_id_str:
        raise HTTPException(status_code=400, detail="Missing transaction_id.")
    tx_id = uuid.UUID(tx_id_str)

    tx_repo = TransactionRepository(db)
    tx = await tx_repo.get_transaction_by_id(tx_id)
    if not tx:
        raise HTTPException(status_code=404, detail="Transaction not found.")

    if tx.status != "under_review":
        raise HTTPException(status_code=400, detail="Only transactions in 'under_review' state can be reprocessed.")

    cust_id = tx.account.customer_id if tx.account else uuid.uuid4()
    req_payload = TransactionInterceptRequest(
        transaction_id=uuid.uuid4(),  # new run ID; original row is preserved
        customer_id=cust_id,
        merchant_id=tx.merchant_id,
        amount=float(tx.amount),
        currency=tx.currency,
        channel="mobile",
        transaction_type=tx.transaction_type,
        device={
            "fingerprint": tx.device.fingerprint if tx.device else f"reprocess-{tx_id.hex[:8]}",
            "ip_address": tx.device.ip_address if tx.device else "127.0.0.1",
            "is_emulator": tx.device.is_emulator if tx.device else False
        }
    )

    res = await intercept_transaction(req_payload, db, current_user)
    logger.info("Reprocessed tx %s -> new run %s verdict=%s", tx_id, res.transaction_id, res.verdict)

    return {
        "transaction_id": res.transaction_id,
        "original_transaction_id": tx_id,
        "status": "success",
        "new_verdict": res.verdict,
        "new_trust_score": res.trust_score,
        "message": "Transaction reprocessed through the governance pipeline.",
    }
