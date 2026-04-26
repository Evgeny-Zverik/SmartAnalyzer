from __future__ import annotations

from pydantic import BaseModel


class UsageStatusResponse(BaseModel):
    plan: str
    credit_balance: int
    credit_costs: dict[str, int]
    usage_today: dict[str, int]
