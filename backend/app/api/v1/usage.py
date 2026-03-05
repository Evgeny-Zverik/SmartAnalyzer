from fastapi import APIRouter, Depends

from app.core.security import get_current_user
from app.models.user import User
from app.schemas.usage import UsageStatusResponse

router = APIRouter()


@router.get("/status", response_model=UsageStatusResponse)
def get_usage_status(current_user: User = Depends(get_current_user)):
    return UsageStatusResponse(
        plan="free",
        limits={"daily_runs_per_tool": 3},
        usage_today={
            "document-analyzer": 0,
            "contract-checker": 0,
            "data-extractor": 0,
            "tender-analyzer": 0,
            "risk-analyzer": 0,
        },
    )
