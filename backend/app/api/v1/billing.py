from fastapi import APIRouter, Depends

from app.core.security import get_current_user
from app.models.user import User
from app.schemas.billing import BillingUpgradeRequest, BillingUpgradeResponse

router = APIRouter()


@router.post("/upgrade", response_model=BillingUpgradeResponse)
def upgrade(body: BillingUpgradeRequest, current_user: User = Depends(get_current_user)):
    return BillingUpgradeResponse(plan=body.plan)
