from datetime import datetime

from pydantic import BaseModel


class CreditPackage(BaseModel):
    id: str
    name: str
    credits: int
    price_rub: int
    description: str


class CreditPurchaseRequest(BaseModel):
    package_id: str


class CreditPurchaseResponse(BaseModel):
    credit_balance: int
    package: CreditPackage


class CreditTransactionRead(BaseModel):
    id: int
    amount: int
    balance_after: int
    reason: str
    reference: str | None
    document_id: int | None = None
    document_name: str | None = None
    pages: int | None = None
    created_at: datetime

    model_config = {"from_attributes": True}
