from pydantic import BaseModel


class UsageStatusResponse(BaseModel):
    plan: str
    limits: dict[str, int]
    usage_today: dict[str, int]
