from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.core.security import get_current_user
from app.db.session import get_db
from app.models.user import User
from app.schemas.billing import BillingUpgradeRequest, BillingUpgradeResponse
from app.utils.errors import raise_error

router = APIRouter()


@router.post("/upgrade", response_model=BillingUpgradeResponse)
def upgrade(
    body: BillingUpgradeRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if body.plan not in ("pro",):
        raise_error(400, "BAD_REQUEST", "Only 'pro' plan is available for upgrade", {"allowed": ["pro"]})
    current_user.plan = body.plan
    db.commit()
    db.refresh(current_user)
    return BillingUpgradeResponse(plan=current_user.plan)
