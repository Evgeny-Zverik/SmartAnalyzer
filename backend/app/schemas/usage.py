from __future__ import annotations

from pydantic import BaseModel


class UsageStatusResponse(BaseModel):
    plan: str
    limits: dict[str, int | None]
    usage_today: dict[str, int]
