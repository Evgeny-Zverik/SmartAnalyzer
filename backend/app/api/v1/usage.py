from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.core.security import get_current_user
from app.db.session import get_db
from app.models.user import User
from app.schemas.usage import UsageStatusResponse
from app.services.usage import get_plan_limits, get_usage_today

router = APIRouter()


@router.get("/status", response_model=UsageStatusResponse)
def get_usage_status(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    plan = current_user.plan
    return UsageStatusResponse(
        plan=plan,
        limits=get_plan_limits(plan),
        usage_today=get_usage_today(db, current_user.id),
    )
