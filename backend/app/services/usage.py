from __future__ import annotations

from datetime import datetime, timedelta, timezone
from math import ceil

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.models.credit_transaction import CreditTransaction
from app.models.usage_log import UsageLog
from app.models.user import User
from app.services import token_counter
from app.utils.errors import raise_error

TOOL_SLUGS = (
    "document-analyzer",
    "contract-checker",
    "data-extractor",
    "tender-analyzer",
    "risk-analyzer",
    "handwriting-recognition",
    "legal-style-translator",
    "legal-text-simplifier",
    "spelling-checker",
    "foreign-language-translator",
    "legal-document-design-review",
    "key_points",
    "dates_deadlines",
    "risk_analyzer",
    "suggested_edits",
)

CREDIT_COSTS: dict[str, int] = {
    "document-analyzer": 80,
    "data-extractor": 160,
    "handwriting-recognition": 40,
    "legal-text-simplifier": 50,
    "spelling-checker": 30,
    "tender-analyzer": 120,
    "risk-analyzer": 120,
    "contract-checker": 120,
    "legal-style-translator": 60,
    "foreign-language-translator": 60,
    "legal-document-design-review": 140,
    "key_points": 30,
    "dates_deadlines": 30,
    "risk_analyzer": 60,
    "suggested_edits": 60,
}

DEFAULT_CREDIT_COST = 50
INPUT_TOKEN_PRICE_RUB_PER_MILLION = 36
OUTPUT_TOKEN_PRICE_RUB_PER_MILLION = 149
AI_TOKEN_RUB_PER_CREDIT = 0.08


def get_credit_cost(tool_slug: str) -> int:
    return CREDIT_COSTS.get(tool_slug, DEFAULT_CREDIT_COST)


def calculate_token_cost_rub(tokens_in: int, tokens_out: int) -> float:
    return (
        tokens_in * INPUT_TOKEN_PRICE_RUB_PER_MILLION
        + tokens_out * OUTPUT_TOKEN_PRICE_RUB_PER_MILLION
    ) / 1_000_000


def get_token_metered_credit_cost(tokens_in: int, tokens_out: int) -> int:
    token_cost_rub = calculate_token_cost_rub(tokens_in, tokens_out)
    if token_cost_rub <= 0:
        return 0
    return max(1, ceil(token_cost_rub / AI_TOKEN_RUB_PER_CREDIT))


def get_run_credit_cost(tool_slug: str, tokens_in: int, tokens_out: int) -> int:
    return max(
        get_credit_cost(tool_slug),
        get_token_metered_credit_cost(tokens_in, tokens_out),
    )


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
    cost = get_credit_cost(tool_slug)
    if user.credit_balance < cost:
        raise_error(
            429,
            "INSUFFICIENT_CREDITS",
            "Недостаточно кредитов для запуска инструмента.",
            {
                "tool_slug": tool_slug,
                "required_credits": cost,
                "credit_balance": user.credit_balance,
            },
        )


def log_credit_transaction(
    db: Session,
    user: User,
    amount: int,
    reason: str,
    reference: str | None = None,
    *,
    document_id: int | None = None,
    pages: int | None = None,
) -> CreditTransaction:
    user.credit_balance += amount
    transaction = CreditTransaction(
        user_id=user.id,
        amount=amount,
        balance_after=user.credit_balance,
        reason=reason,
        reference=reference,
        document_id=document_id,
        pages=pages,
    )
    db.add(transaction)
    return transaction


def log_run(
    db: Session,
    user: User,
    tool_slug: str,
    *,
    document_id: int | None = None,
    pages: int | None = None,
) -> None:
    base_cost = get_credit_cost(tool_slug)
    if user.credit_balance < base_cost:
        assert_can_run(db, user, tool_slug)
    tokens_in, tokens_out = token_counter.pop()
    cost = get_run_credit_cost(tool_slug, tokens_in, tokens_out)
    log_credit_transaction(
        db,
        user,
        -cost,
        "tool_run",
        tool_slug,
        document_id=document_id,
        pages=pages,
    )
    log = UsageLog(
        user_id=user.id,
        tool_slug=tool_slug,
        tokens_in=tokens_in,
        tokens_out=tokens_out,
        credits_charged=cost,
    )
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


def get_recent_credit_transactions(
    db: Session,
    user_id: int,
    limit: int = 20,
) -> list[CreditTransaction]:
    return (
        db.query(CreditTransaction)
        .filter(CreditTransaction.user_id == user_id)
        .order_by(CreditTransaction.created_at.desc(), CreditTransaction.id.desc())
        .limit(limit)
        .all()
    )
