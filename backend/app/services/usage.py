from __future__ import annotations

from datetime import datetime, timedelta, timezone

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.models.usage_log import UsageLog
from app.models.user import User
from app.utils.errors import raise_error

TOOL_SLUGS = (
    "document-analyzer",
    "contract-checker",
    "data-extractor",
    "tender-analyzer",
    "risk-analyzer",
    "key_points",
    "dates_deadlines",
    "risk_analyzer",
    "suggested_edits",
)

FREE_DAILY_RUNS_PER_TOOL = 50


def get_plan_limits(plan: str) -> dict[str, int | None]:
    if plan in ("pro", "enterprise"):
        return {"daily_runs_per_tool": None}
    return {"daily_runs_per_tool": FREE_DAILY_RUNS_PER_TOOL}


def _today_utc_range() -> tuple[datetime, datetime]:
    now = datetime.now(timezone.utc)
    start = now.replace(hour=0, minute=0, second=0, microsecond=0)
    end = start + timedelta(days=1)
    return start, end


def count_runs_today(db: Session, user_id: int, tool_slug: str) -> int:
    start, end = _today_utc_range()
    stmt = (
        select(func.count())
        .select_from(UsageLog)
        .where(
            UsageLog.user_id == user_id,
            UsageLog.tool_slug == tool_slug,
            UsageLog.created_at >= start,
            UsageLog.created_at < end,
        )
    )
    return db.scalar(stmt) or 0


def assert_can_run(db: Session, user: User, tool_slug: str) -> None:
    limits = get_plan_limits(user.plan)
    limit_per_day = limits.get("daily_runs_per_tool")
    if limit_per_day is None:
        return
    count = count_runs_today(db, user.id, tool_slug)
    if count >= limit_per_day:
        raise_error(
            429,
            "LIMIT_REACHED",
            "Daily limit reached for this tool.",
            {
                "tool_slug": tool_slug,
                "plan": user.plan,
                "limit_per_day": limit_per_day,
            },
        )


def log_run(db: Session, user_id: int, tool_slug: str) -> None:
    log = UsageLog(user_id=user_id, tool_slug=tool_slug)
    db.add(log)
    db.commit()


def get_usage_today(db: Session, user_id: int) -> dict[str, int]:
    start, end = _today_utc_range()
    stmt = (
        select(UsageLog.tool_slug, func.count())
        .where(
            UsageLog.user_id == user_id,
            UsageLog.created_at >= start,
            UsageLog.created_at < end,
        )
        .group_by(UsageLog.tool_slug)
    )
    rows = dict(db.execute(stmt).all())
    return {slug: rows.get(slug, 0) for slug in TOOL_SLUGS}
