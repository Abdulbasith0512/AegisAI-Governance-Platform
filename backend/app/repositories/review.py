import uuid
from typing import List, Optional
from datetime import datetime
from sqlalchemy import select, update
from sqlalchemy.orm import selectinload, joinedload
from sqlalchemy.ext.asyncio import AsyncSession
from app.models.governance import HumanReview, TrustScore, Explanation, PolicyCheck
from app.models.agents import Prediction
from app.models.transactions import Transaction
from app.models.banking import Account, Customer
from app.models.users import User

class ReviewRepository:
    """
    Handles database operations for case reviews management.
    """
    def __init__(self, db: AsyncSession) -> None:
        self.db = db

    async def list_review_queue(self, limit: int = 50) -> List[HumanReview]:
        """
        Retrieves pending and escalated cases for the review queue, joining
        transaction and customer relationships.
        """
        result = await self.db.execute(
            select(HumanReview)
            .where(HumanReview.status.in_(["pending", "escalated"]))
            .options(
                joinedload(HumanReview.transaction)
                .joinedload(Transaction.account)
                .joinedload(Account.customer),
                joinedload(HumanReview.reviewer)
            )
            .order_by(HumanReview.assigned_at.desc())
            .limit(limit)
        )
        return list(result.scalars().all())

    async def list_review_history(self, limit: int = 50) -> List[HumanReview]:
        """
        Retrieves resolved case audits (approved or rejected).
        """
        result = await self.db.execute(
            select(HumanReview)
            .where(HumanReview.status.in_(["approved", "rejected"]))
            .options(
                joinedload(HumanReview.transaction)
                .joinedload(Transaction.account)
                .joinedload(Account.customer),
                joinedload(HumanReview.reviewer)
            )
            .order_by(HumanReview.reviewed_at.desc())
            .limit(limit)
        )
        return list(result.scalars().all())

    async def get_detailed_review(self, review_id: uuid.UUID) -> Optional[HumanReview]:
        """
        Eagerly loads all connected telemetry relationships for the Evidence Viewer.

        The review record carries transaction_id / status / comments /
        reviewer / assigned_at / reviewed_at / sla_deadline on its own row;
        the original AI decision (trust score, agent predictions, SHAP
        evidence, policy checks) is reconstructed from the immutable
        trust_scores / predictions+explanations / policy_checks relations
        plus the audit ledger — no snapshot columns, so no migration needed
        and the AI evidence can never be overwritten by a verdict.
        """
        result = await self.db.execute(
            select(HumanReview)
            .where(HumanReview.id == review_id)
            .options(
                joinedload(HumanReview.transaction)
                .joinedload(Transaction.account)
                .joinedload(Account.customer),
                joinedload(HumanReview.reviewer),
                # Eagerly load trust, policy, and prediction explanations
                joinedload(HumanReview.transaction).selectinload(Transaction.trust_scores),
                joinedload(HumanReview.transaction).selectinload(Transaction.policy_checks),
                joinedload(HumanReview.transaction).selectinload(Transaction.predictions)
                .selectinload(Prediction.explanations)
            )
        )
        return result.scalars().first()

    async def assign_reviewer(self, review_id: uuid.UUID, reviewer_id: uuid.UUID) -> Optional[HumanReview]:
        """
        Assigns an auditor user profile to a review case.
        """
        review = await self.db.get(HumanReview, review_id)
        if not review:
            return None
        
        review.reviewer_id = reviewer_id
        await self.db.commit()
        await self.db.refresh(review)
        return review

    async def submit_review_verdict(
        self,
        review_id: uuid.UUID,
        status: str,
        comments: str,
        reviewer_id: Optional[uuid.UUID] = None
    ) -> Optional[HumanReview]:
        """
        Logs case verdict ("approved", "rejected", "escalated") and updates corresponding transaction statuses.

        Stamp-if-empty: reviewer_id is recorded only when the case has no
        reviewer yet, so explicit assignments are never clobbered while the
        deciding identity is always preserved.
        """
        # Fetch detailed review
        review = await self.get_detailed_review(review_id)
        if not review:
            return None

        review.status = status
        review.comments = comments
        review.reviewed_at = datetime.utcnow()
        if reviewer_id is not None and review.reviewer_id is None:
            review.reviewer_id = reviewer_id

        # Update core transaction status matching auditor decision
        if review.transaction:
            if status == "approved":
                review.transaction.status = "approved"
                review.transaction.completed_at = datetime.utcnow()
            elif status == "rejected":
                review.transaction.status = "declined"
                review.transaction.completed_at = datetime.utcnow()
            elif status == "escalated":
                review.transaction.status = "under_review"

        await self.db.commit()
        await self.db.refresh(review)
        return review
