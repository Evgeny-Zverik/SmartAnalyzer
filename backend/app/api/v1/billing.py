from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.core.security import get_current_user
from app.db.session import get_db
from app.models.user import User
from app.schemas.billing import (
    CreditPackage,
    CreditPurchaseRequest,
    CreditPurchaseResponse,
    CreditTransactionRead,
)
from app.services.usage import get_recent_credit_transactions, log_credit_transaction
from app.utils.errors import raise_error

router = APIRouter()

CREDIT_PACKAGES: dict[str, CreditPackage] = {
    "start": CreditPackage(
        id="start",
        name="Start",
        credits=2_000,
        price_rub=490,
        description=(
            "Для первых рабочих документов "
            "и нерегулярного использования."
        ),
    ),
    "pro": CreditPackage(
        id="pro",
        name="Pro",
        credits=7_000,
        price_rub=1_490,
        description=(
            "Оптимальный запас для регулярного "
            "анализа документов."
        ),
    ),
    "business": CreditPackage(
        id="business",
        name="Business",
        credits=20_000,
        price_rub=3_990,
        description=(
            "Для интенсивной работы, сравнений "
            "и больших документов."
        ),
    ),
}


@router.get("/credit-packages", response_model=list[CreditPackage])
def list_credit_packages():
    return list(CREDIT_PACKAGES.values())


@router.post("/credits/purchase", response_model=CreditPurchaseResponse)
def purchase_credits(
    body: CreditPurchaseRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    package = CREDIT_PACKAGES.get(body.package_id)
    if package is None:
        raise_error(
            400,
            "BAD_REQUEST",
            "Unknown credit package.",
            {"allowed": list(CREDIT_PACKAGES.keys())},
        )
    log_credit_transaction(db, current_user, package.credits, "purchase", package.id)
    db.commit()
    db.refresh(current_user)
    return CreditPurchaseResponse(credit_balance=current_user.credit_balance, package=package)


@router.get("/credits/transactions", response_model=list[CreditTransactionRead])
def list_credit_transactions(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return get_recent_credit_transactions(db, current_user.id)
