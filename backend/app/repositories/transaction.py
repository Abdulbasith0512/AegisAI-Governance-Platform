import uuid
import logging
from datetime import datetime, timedelta
from typing import List, Optional, Dict, Any
from sqlalchemy import select, update, desc
from sqlalchemy.orm import selectinload, joinedload
from sqlalchemy.ext.asyncio import AsyncSession
from app.models.transactions import Transaction, Device
from app.models.governance import TrustScore, PolicyCheck, Explanation, ConsensusVote, HumanReview
from app.models.agents import Prediction, AIAgent, ModelVersion
from app.models.banking import Account, Customer, Beneficiary, Merchant, Branch
from agents.supervisor import parse_supervisor_verdict

logger = logging.getLogger("aegisai.repositories.transaction")

class TransactionRepository:
    """
    Handles database operations for Transaction entities and their governance metadata.
    """
    def __init__(self, db: AsyncSession) -> None:
        self.db = db

    async def get_or_create_customer_and_account(self, customer_id: uuid.UUID) -> Account:
        """
        Retrieves a customer account, creating a mock profile if missing to prevent FK violations.
        """
        cust_res = await self.db.execute(select(Customer).where(Customer.id == customer_id))
        customer = cust_res.scalars().first()
        if not customer:
            customer = Customer(
                id=customer_id,
                first_name="Mock",
                last_name="Customer",
                email=f"mock_{customer_id.hex[:6]}@aegisai.com",
                phone="+15550199",
                risk_level="medium",
                status="active"
            )
            self.db.add(customer)
            await self.db.commit()

        acc_res = await self.db.execute(select(Account).where(Account.customer_id == customer_id))
        account = acc_res.scalars().first()
        if not account:
            account = Account(
                id=uuid.uuid4(),
                customer_id=customer_id,
                account_number=f"ACC-{uuid.uuid4().hex[:10].upper()}",
                account_type="checking",
                balance=25000.00,
                currency="USD",
                status="active"
            )
            self.db.add(account)
            await self.db.commit()
            await self.db.refresh(account)
        return account

    async def get_or_create_merchant(self, merchant_id: Optional[uuid.UUID], category_code: Optional[str] = None) -> Optional[uuid.UUID]:
        if not merchant_id:
            return None
        res = await self.db.execute(select(Merchant).where(Merchant.id == merchant_id))
        merchant = res.scalars().first()
        if not merchant:
            merchant = Merchant(
                id=merchant_id,
                merchant_code=f"MCH-{merchant_id.hex[:6].upper()}",
                name="Aegis Merchant Partner",
                category_code=category_code or "5999"
            )
            self.db.add(merchant)
            await self.db.commit()
        return merchant_id

    async def get_or_create_beneficiary(self, account_id: uuid.UUID, beneficiary_data: Optional[Dict[str, Any]]) -> Optional[uuid.UUID]:
        if not beneficiary_data:
            return None
        acc_num = beneficiary_data.get("beneficiary_account_number")
        bank_code = beneficiary_data.get("bank_code", "AEGIS")
        nickname = beneficiary_data.get("nickname", "Beneficiary Partner")
        
        res = await self.db.execute(
            select(Beneficiary).where(Beneficiary.beneficiary_account_number == acc_num)
        )
        beneficiary = res.scalars().first()
        if not beneficiary:
            beneficiary = Beneficiary(
                id=uuid.uuid4(),
                account_id=account_id,
                nickname=nickname,
                beneficiary_account_number=acc_num,
                bank_code=bank_code
            )
            self.db.add(beneficiary)
            await self.db.commit()
            await self.db.refresh(beneficiary)
        return beneficiary.id

    async def get_or_create_device(self, device_data: Optional[Dict[str, Any]]) -> Optional[uuid.UUID]:
        if not device_data:
            return None
        fingerprint = device_data.get("fingerprint")
        if not fingerprint:
            return None
            
        res = await self.db.execute(select(Device).where(Device.fingerprint == fingerprint))
        device = res.scalars().first()
        if not device:
            device = Device(
                id=uuid.uuid4(),
                fingerprint=fingerprint,
                ip_address=device_data.get("ip_address", "127.0.0.1"),
                user_agent=device_data.get("user_agent"),
                os=device_data.get("os"),
                is_emulator=device_data.get("is_emulator", False),
                location_lat=device_data.get("location_lat"),
                location_long=device_data.get("location_long")
            )
            self.db.add(device)
            await self.db.commit()
            await self.db.refresh(device)
        return device.id

    async def get_active_model_version(self, agent_name: str) -> uuid.UUID:
        """Gets or creates AIAgent & ModelVersion record in db."""
        res_a = await self.db.execute(select(AIAgent).where(AIAgent.name == agent_name))
        agent = res_a.scalars().first()
        if not agent:
            agent = AIAgent(
                id=uuid.uuid4(),
                name=agent_name,
                description=f"Agent scoring model for {agent_name}",
                status="active"
            )
            self.db.add(agent)
            await self.db.commit()
            await self.db.refresh(agent)

        res_v = await self.db.execute(
            select(ModelVersion)
            .where(ModelVersion.agent_id == agent.id)
            .order_by(desc(ModelVersion.deployed_at))
        )
        version = res_v.scalars().first()
        if not version:
            version = ModelVersion(
                id=uuid.uuid4(),
                agent_id=agent.id,
                version_string="v1.0.0",
                parameters_hash=uuid.uuid4().hex,
                accuracy_benchmark=0.96,
                is_active=True,
                hyperparameters={},
                metrics={}
            )
            self.db.add(version)
            await self.db.commit()
            await self.db.refresh(version)
        return version.id

    async def create_transaction(
        self,
        transaction_id: uuid.UUID,
        account_id: uuid.UUID,
        amount: float,
        currency: str,
        transaction_type: str,
        status: str,
        merchant_id: Optional[uuid.UUID] = None,
        device_id: Optional[uuid.UUID] = None,
        beneficiary_id: Optional[uuid.UUID] = None,
        reference_number: Optional[str] = None
    ) -> Transaction:
        tx = Transaction(
            id=transaction_id,
            account_id=account_id,
            amount=amount,
            currency=currency,
            transaction_type=transaction_type,
            status=status,
            merchant_id=merchant_id,
            device_id=device_id,
            beneficiary_id=beneficiary_id,
            reference_number=reference_number or f"TX-{uuid.uuid4().hex[:12].upper()}"
        )
        self.db.add(tx)
        await self.db.commit()
        await self.db.refresh(tx)
        return tx

    async def get_transaction_by_id(self, tx_id: uuid.UUID) -> Optional[Transaction]:
        result = await self.db.execute(
            select(Transaction)
            .where(Transaction.id == tx_id)
            .options(
                joinedload(Transaction.account).joinedload(Account.customer),
                joinedload(Transaction.device),
                joinedload(Transaction.beneficiary),
                joinedload(Transaction.merchant),
                selectinload(Transaction.predictions).selectinload(Prediction.model_version).selectinload(ModelVersion.agent),
                selectinload(Transaction.predictions).selectinload(Prediction.explanations),
                selectinload(Transaction.trust_scores),
                selectinload(Transaction.policy_checks),
                selectinload(Transaction.consensus_votes)
            )
        )
        return result.scalars().first()

    async def list_transactions(self, limit: int = 50) -> List[Transaction]:
        # Eager-load account so async callers (e.g. intercept AML context)
        # can read tx.account.customer_id without lazy-load failures.
        result = await self.db.execute(
            select(Transaction)
            .options(joinedload(Transaction.account))
            .order_by(desc(Transaction.initiated_at))
            .limit(limit)
        )
        return list(result.scalars().all())

    @staticmethod
    def _res_get(res: Any, key: str, default: Any = None) -> Any:
        if isinstance(res, dict):
            return res.get(key, default)
        return getattr(res, key, default)

    async def persist_pipeline_results(
        self,
        transaction_id: uuid.UUID,
        agent_outputs: Dict[str, Any],
        state: Dict[str, Any]
    ) -> None:
        """
        Persists predictions, consensus votes, trust scores, policies checks and human reviews.
        """
        # 1. Save Predictions for each sub-agent
        sub_agents = ["device_result", "kyc_result", "fraud_result", "aml_result", "policy_result", "explainability_result"]
        prediction_map = {}
        for key in sub_agents:
            res = state.get(key)
            if not res:
                continue
            agent_name = key.replace("_result", "-agent")
            version_id = await self.get_active_model_version(agent_name)
            
            prediction = Prediction(
                id=uuid.uuid4(),
                transaction_id=transaction_id,
                model_version_id=version_id,
                prediction_output={
                    "status": self._res_get(res, "status"),
                    "reasoning": self._res_get(res, "reasoning"),
                    "logs": self._res_get(res, "logs", []),
                },
                confidence_score=float(self._res_get(res, "confidence_score", 0.0) or 0.0),
                latency_ms=float(self._res_get(res, "execution_time", 0.0) or 0.0) * 1000
            )
            self.db.add(prediction)
            prediction_map[agent_name] = prediction.id
        
        await self.db.commit()

        # 2. Save Policy Checks
        sim_res = state.get("policy_simulation")
        if sim_res:
            for pc in sim_res.get("policies_checked", []):
                chk = PolicyCheck(
                    id=uuid.uuid4(),
                    transaction_id=transaction_id,
                    rule_id=pc.get("policy_id"),
                    status=pc.get("status"),
                    details=pc
                )
                self.db.add(chk)

        # 3. Save Trust Score
        trust_val = state.get("trust_score_value")
        if trust_val is not None:
            ts = TrustScore(
                id=uuid.uuid4(),
                transaction_id=transaction_id,
                score=trust_val,
                weights_configuration=state.get("trust_weights", {}),
                reasons=state.get("trust_reasons", {})
            )
            self.db.add(ts)

        # 4. Save Consensus Votes
        consensus_votes_data = state.get("consensus_votes")
        if consensus_votes_data:
            cv = ConsensusVote(
                id=uuid.uuid4(),
                transaction_id=transaction_id,
                decision_verdict="approve" if state.get("consensus_ratio", 1.0) >= 0.67 else "decline",
                vote_details=consensus_votes_data,
                consensus_score=state.get("consensus_ratio", 1.0)
            )
            self.db.add(cv)

        # 5. Save Explanation (Linked to Supervisor/Explainability Prediction)
        explain_pred_id = prediction_map.get("explainability-agent")
        explain_data = state.get("explanation_data")
        if explain_pred_id and explain_data:
            exp = Explanation(
                id=uuid.uuid4(),
                prediction_id=explain_pred_id,
                human_readable=explain_data["human_readable"],
                machine_readable=explain_data["machine_readable"],
                decision_timeline=explain_data["decision_timeline"],
                evidence_graph=explain_data["evidence_graph"],
                feature_importance=explain_data["feature_importance"],
                confidence_reasoning=explain_data["confidence_reasoning"],
                supporting_policies=explain_data["supporting_policies"],
                contributing_agents=explain_data["contributing_agents"],
                explainability_score=explain_data["explainability_score"],
                explanation_vector=explain_data["explanation_vector"]
            )
            self.db.add(exp)

        # 6. Save Human Review if under review.
        # Parse the structured supervisor verdict prefix (same helper as
        # the intercept endpoint) instead of substring-matching prose.
        supervisor_verdict = parse_supervisor_verdict(state.get("supervisor_result"))

        if supervisor_verdict == "under_review":
            hr = HumanReview(
                id=uuid.uuid4(),
                transaction_id=transaction_id,
                status="pending",
                assigned_at=datetime.utcnow(),
                sla_deadline=datetime.utcnow() + timedelta(hours=4)
            )
            self.db.add(hr)

        await self.db.commit()
