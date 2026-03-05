from pydantic import BaseModel


class BillingUpgradeRequest(BaseModel):
    plan: str


class BillingUpgradeResponse(BaseModel):
    plan: str
