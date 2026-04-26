from __future__ import annotations

from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import case, func
from sqlalchemy.orm import Session

from app.core.security import get_current_user
from app.db.session import get_db
from app.models.document import Document
from app.models.document_analysis import DocumentAnalysis
from app.models.folder import Folder
from app.models.credit_transaction import CreditTransaction
from app.models.plugin_execution import PluginExecution
from app.models.usage_log import UsageLog
from app.models.user import User
from app.models.user_feature_flag import UserFeatureFlag
from app.models.user_settings import UserSettings
from app.models.workspace_enabled_plugin import WorkspaceEnabledPlugin
from app.services.usage import (
    AI_TOKEN_RUB_PER_CREDIT,
    INPUT_TOKEN_PRICE_RUB_PER_MILLION,
    OUTPUT_TOKEN_PRICE_RUB_PER_MILLION,
    calculate_token_cost_rub,
    log_credit_transaction,
)

# Mirror of CREDIT_PACKAGES in app.api.v1.billing — used to convert "purchase"
# transactions into RUB revenue.
PACKAGE_PRICE_RUB: dict[str, int] = {
    "start": 490,
    "pro": 1_490,
    "business": 3_990,
}
PACKAGE_CREDITS: dict[str, int] = {
    "start": 2_000,
    "pro": 7_000,
    "business": 20_000,
}

router = APIRouter()

ADMIN_EMAIL = "1@mail.com"

TOP_LEVEL_TOOL_SLUGS = {
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
}


def require_admin(current_user: User = Depends(get_current_user)) -> User:
    if (current_user.email or "").strip().lower() != ADMIN_EMAIL:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin access required",
        )
    return current_user


@router.post("/users/{user_id}/block")
def set_user_blocked(
    user_id: int,
    payload: dict,
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    if user_id == current_user.id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot block yourself",
        )
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found",
        )
    user.is_blocked = bool(payload.get("is_blocked"))
    db.commit()
    return {"id": user.id, "is_blocked": user.is_blocked}


@router.post("/users/{user_id}/credits")
def adjust_user_credits(
    user_id: int,
    payload: dict,
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    raw_amount = payload.get("amount")
    try:
        amount = int(raw_amount)
    except (TypeError, ValueError):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="amount must be an integer",
        )
    if amount == 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="amount must be non-zero",
        )
    if abs(amount) > 1_000_000:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="amount out of range (±1 000 000)",
        )

    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found",
        )

    if amount < 0 and user.credit_balance + amount < 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Resulting balance would be negative ({user.credit_balance + amount})",
        )

    reason_raw = payload.get("reason")
    note = (str(reason_raw).strip() if isinstance(reason_raw, str) else "")[:200] or None

    log_credit_transaction(
        db,
        user,
        amount,
        "admin_grant" if amount > 0 else "admin_debit",
        note,
    )
    db.commit()
    return {
        "user_id": user.id,
        "credit_balance": user.credit_balance,
        "amount": amount,
        "reason": note,
        "actor_id": current_user.id,
    }


@router.delete("/users/{user_id}", status_code=204)
def delete_user(
    user_id: int,
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    if user_id == current_user.id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot delete yourself",
        )
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found",
        )
    for model in (
        UsageLog,
        CreditTransaction,
        PluginExecution,
        DocumentAnalysis,
        Document,
        Folder,
        WorkspaceEnabledPlugin,
        UserFeatureFlag,
        UserSettings,
    ):
        db.query(model).filter(model.user_id == user_id).delete(
            synchronize_session=False
        )
    db.delete(user)
    db.commit()
    return None


@router.get("/users")
def list_users(
    _: User = Depends(require_admin),
    db: Session = Depends(get_db),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=200),
    q: str | None = Query(None),
    sort: str = Query("recent"),
):
    base_query = db.query(User)
    if q:
        base_query = base_query.filter(User.email.ilike(f"%{q.strip()}%"))
    total = base_query.count()

    if sort == "activity":
        activity_subq = (
            db.query(UsageLog.user_id, func.count(UsageLog.id).label("runs"))
            .group_by(UsageLog.user_id)
            .subquery()
        )
        ordered = (
            base_query.outerjoin(activity_subq, activity_subq.c.user_id == User.id)
            .order_by(func.coalesce(activity_subq.c.runs, 0).desc(), User.created_at.desc())
        )
    else:
        ordered = base_query.order_by(User.created_at.desc())

    users = ordered.offset((page - 1) * page_size).limit(page_size).all()

    active_count = (
        db.query(func.count(func.distinct(UsageLog.user_id))).scalar() or 0
    )
    inactive_count = max(0, db.query(User).count() - int(active_count))

    user_ids = [u.id for u in users]
    usage_rows = (
        db.query(
            UsageLog.user_id,
            UsageLog.tool_slug,
            func.count(UsageLog.id).label("count"),
        )
        .filter(
            UsageLog.user_id.in_(user_ids),
            UsageLog.tool_slug.in_(TOP_LEVEL_TOOL_SLUGS),
        )
        .group_by(UsageLog.user_id, UsageLog.tool_slug)
        .all()
        if user_ids
        else []
    )
    tools_by_user: dict[int, list[dict]] = {}
    for user_id, slug, count in usage_rows:
        tools_by_user.setdefault(user_id, []).append(
            {"slug": slug, "count": int(count)}
        )
    for items in tools_by_user.values():
        items.sort(key=lambda x: x["count"], reverse=True)

    token_rows = (
        db.query(
            UsageLog.user_id,
            func.coalesce(func.sum(UsageLog.tokens_in), 0),
            func.coalesce(func.sum(UsageLog.tokens_out), 0),
            func.coalesce(func.sum(UsageLog.credits_charged), 0),
        )
        .filter(UsageLog.user_id.in_(user_ids))
        .group_by(UsageLog.user_id)
        .all()
        if user_ids
        else []
    )
    tokens_by_user: dict[int, dict[str, int]] = {
        user_id: {
            "in": int(tin or 0),
            "out": int(tout or 0),
            "credits_spent": int(credits_spent or 0),
        }
        for user_id, tin, tout, credits_spent in token_rows
    }

    last_seen_rows = (
        db.query(UsageLog.user_id, func.max(UsageLog.created_at))
        .filter(UsageLog.user_id.in_(user_ids))
        .group_by(UsageLog.user_id)
        .all()
        if user_ids
        else []
    )
    last_seen_by_user: dict[int, str] = {
        user_id: str(ts) for user_id, ts in last_seen_rows if ts is not None
    }

    return {
        "items": [
            {
                "id": u.id,
                "email": u.email,
                "plan": u.plan,
                "credit_balance": u.credit_balance,
                "is_blocked": bool(u.is_blocked),
                "created_at": str(u.created_at),
                "last_seen_at": last_seen_by_user.get(u.id),
                "tools": tools_by_user.get(u.id, []),
                "tokens_in": tokens_by_user.get(u.id, {}).get("in", 0),
                "tokens_out": tokens_by_user.get(u.id, {}).get("out", 0),
                "credits_spent": tokens_by_user.get(u.id, {}).get("credits_spent", 0),
            }
            for u in users
        ],
        "total": total,
        "page": page,
        "page_size": page_size,
        "summary": {
            "active": int(active_count),
            "inactive": int(inactive_count),
            "all": int(active_count) + int(inactive_count),
        },
    }


def _utc_now() -> datetime:
    return datetime.now(timezone.utc)


def _purchase_revenue_rub(reference: str | None, amount: int) -> float:
    """Estimate RUB revenue for a purchase transaction.

    Prefers exact package price when reference matches a known package id.
    Falls back to credits-at-list-price using the cheapest tier's rate
    so unknown packages aren't counted as zero revenue.
    """
    if reference and reference in PACKAGE_PRICE_RUB:
        return float(PACKAGE_PRICE_RUB[reference])
    # Fallback: pro-rate using "start" pack rate (cheapest credits/RUB).
    rate = PACKAGE_PRICE_RUB["start"] / PACKAGE_CREDITS["start"]
    return round(max(0, amount) * rate, 2)


@router.get("/revenue")
def revenue_dashboard(
    _: User = Depends(require_admin),
    db: Session = Depends(get_db),
    days: int = Query(30, ge=1, le=730),
):
    now = _utc_now()
    period_start = now - timedelta(days=days)

    # ---------------- Purchases (revenue) ----------------
    purchase_q = db.query(CreditTransaction).filter(CreditTransaction.reason == "purchase")
    all_purchases = purchase_q.all()

    lifetime_revenue = 0.0
    lifetime_credits_issued = 0
    paying_user_ids: set[int] = set()
    by_package: dict[str, dict] = {}
    for tx in all_purchases:
        rub = _purchase_revenue_rub(tx.reference, tx.amount)
        lifetime_revenue += rub
        lifetime_credits_issued += int(tx.amount or 0)
        paying_user_ids.add(int(tx.user_id))
        pkg_id = tx.reference if tx.reference in PACKAGE_PRICE_RUB else (tx.reference or "custom")
        slot = by_package.setdefault(pkg_id, {"count": 0, "revenue_rub": 0.0, "credits": 0})
        slot["count"] += 1
        slot["revenue_rub"] += rub
        slot["credits"] += int(tx.amount or 0)

    # Period purchases
    period_purchases = [tx for tx in all_purchases if tx.created_at and tx.created_at >= period_start]
    period_revenue = sum(_purchase_revenue_rub(tx.reference, tx.amount) for tx in period_purchases)
    period_credits_issued = sum(int(tx.amount or 0) for tx in period_purchases)
    period_paying_users = {int(tx.user_id) for tx in period_purchases}

    # By day
    by_day: dict[str, dict] = {}
    for tx in period_purchases:
        d = tx.created_at.astimezone(timezone.utc).date().isoformat()
        slot = by_day.setdefault(d, {"date": d, "revenue_rub": 0.0, "purchases": 0, "credits": 0})
        slot["revenue_rub"] += _purchase_revenue_rub(tx.reference, tx.amount)
        slot["purchases"] += 1
        slot["credits"] += int(tx.amount or 0)
    by_day_list = [by_day[k] for k in sorted(by_day.keys())]

    # Top spenders (lifetime revenue per user)
    spend_by_user: dict[int, float] = {}
    credits_by_user: dict[int, int] = {}
    purchases_by_user: dict[int, int] = {}
    for tx in all_purchases:
        uid = int(tx.user_id)
        spend_by_user[uid] = spend_by_user.get(uid, 0.0) + _purchase_revenue_rub(tx.reference, tx.amount)
        credits_by_user[uid] = credits_by_user.get(uid, 0) + int(tx.amount or 0)
        purchases_by_user[uid] = purchases_by_user.get(uid, 0) + 1

    top_ids = sorted(spend_by_user.keys(), key=lambda uid: spend_by_user[uid], reverse=True)[:25]
    user_rows = (
        db.query(User.id, User.email, User.plan, User.credit_balance, User.created_at)
        .filter(User.id.in_(top_ids))
        .all()
        if top_ids
        else []
    )
    user_by_id = {row[0]: row for row in user_rows}
    top_spenders = [
        {
            "user_id": uid,
            "email": user_by_id[uid][1] if uid in user_by_id else f"#{uid}",
            "plan": user_by_id[uid][2] if uid in user_by_id else None,
            "credit_balance": int(user_by_id[uid][3]) if uid in user_by_id else 0,
            "created_at": str(user_by_id[uid][4]) if uid in user_by_id else None,
            "revenue_rub": round(spend_by_user[uid], 2),
            "credits_purchased": credits_by_user[uid],
            "purchases": purchases_by_user[uid],
        }
        for uid in top_ids
    ]

    # Recent purchases
    recent_q = (
        db.query(CreditTransaction, User.email)
        .join(User, User.id == CreditTransaction.user_id)
        .filter(CreditTransaction.reason == "purchase")
        .order_by(CreditTransaction.created_at.desc())
        .limit(50)
        .all()
    )
    recent_purchases = [
        {
            "id": tx.id,
            "user_id": int(tx.user_id),
            "email": email,
            "package": tx.reference,
            "credits": int(tx.amount or 0),
            "revenue_rub": round(_purchase_revenue_rub(tx.reference, tx.amount), 2),
            "created_at": str(tx.created_at),
        }
        for tx, email in recent_q
    ]

    # ---------------- Credit balance / spend ----------------
    spend_rows = (
        db.query(
            func.coalesce(func.sum(case((CreditTransaction.amount < 0, -CreditTransaction.amount), else_=0)), 0),
            func.coalesce(
                func.sum(
                    case(
                        (
                            (CreditTransaction.amount > 0)
                            & (CreditTransaction.reason != "purchase"),
                            CreditTransaction.amount,
                        ),
                        else_=0,
                    )
                ),
                0,
            ),
        )
        .one()
    )
    lifetime_credits_spent = int(spend_rows[0] or 0)
    lifetime_bonus_issued = int(spend_rows[1] or 0)

    period_spend_rows = (
        db.query(
            func.coalesce(func.sum(case((CreditTransaction.amount < 0, -CreditTransaction.amount), else_=0)), 0),
        )
        .filter(CreditTransaction.created_at >= period_start)
        .one()
    )
    period_credits_spent = int(period_spend_rows[0] or 0)

    outstanding_balance = int(db.query(func.coalesce(func.sum(User.credit_balance), 0)).scalar() or 0)

    # ---------------- Tool usage / token costs ----------------
    tool_rows = (
        db.query(
            UsageLog.tool_slug,
            func.count(UsageLog.id),
            func.coalesce(func.sum(UsageLog.tokens_in), 0),
            func.coalesce(func.sum(UsageLog.tokens_out), 0),
            func.coalesce(func.sum(UsageLog.credits_charged), 0),
        )
        .group_by(UsageLog.tool_slug)
        .all()
    )
    by_tool_lifetime = []
    lifetime_tokens_in = 0
    lifetime_tokens_out = 0
    lifetime_token_cost_rub = 0.0
    for slug, runs, tin, tout, charged in tool_rows:
        tin = int(tin or 0)
        tout = int(tout or 0)
        cost_rub = calculate_token_cost_rub(tin, tout)
        lifetime_tokens_in += tin
        lifetime_tokens_out += tout
        lifetime_token_cost_rub += cost_rub
        by_tool_lifetime.append(
            {
                "tool_slug": slug,
                "runs": int(runs or 0),
                "tokens_in": tin,
                "tokens_out": tout,
                "credits_charged": int(charged or 0),
                "token_cost_rub": round(cost_rub, 2),
                "credit_revenue_rub": round(int(charged or 0) * AI_TOKEN_RUB_PER_CREDIT, 2),
            }
        )
    by_tool_lifetime.sort(key=lambda r: r["credits_charged"], reverse=True)

    period_tool_rows = (
        db.query(
            UsageLog.tool_slug,
            func.count(UsageLog.id),
            func.coalesce(func.sum(UsageLog.tokens_in), 0),
            func.coalesce(func.sum(UsageLog.tokens_out), 0),
            func.coalesce(func.sum(UsageLog.credits_charged), 0),
        )
        .filter(UsageLog.created_at >= period_start)
        .group_by(UsageLog.tool_slug)
        .all()
    )
    period_tokens_in = 0
    period_tokens_out = 0
    period_token_cost_rub = 0.0
    period_credits_charged = 0
    for slug, runs, tin, tout, charged in period_tool_rows:
        tin = int(tin or 0)
        tout = int(tout or 0)
        period_tokens_in += tin
        period_tokens_out += tout
        period_token_cost_rub += calculate_token_cost_rub(tin, tout)
        period_credits_charged += int(charged or 0)

    # ---------------- Users / cohort ----------------
    total_users = db.query(User).count()
    active_user_ids = {
        uid for (uid,) in db.query(UsageLog.user_id).distinct().all()
    }
    active_users_count = len(active_user_ids)

    period_active_user_ids = {
        uid
        for (uid,) in db.query(UsageLog.user_id)
        .filter(UsageLog.created_at >= period_start)
        .distinct()
        .all()
    }
    period_active_users_count = len(period_active_user_ids)

    plan_rows = (
        db.query(User.plan, func.count(User.id))
        .group_by(User.plan)
        .all()
    )
    by_plan = [{"plan": p or "free", "users": int(c)} for p, c in plan_rows]

    cohort_rows = (
        db.query(func.date(User.created_at), func.count(User.id))
        .filter(User.created_at >= period_start)
        .group_by(func.date(User.created_at))
        .all()
    )
    new_users_by_day = [
        {"date": str(d), "new_users": int(c)} for d, c in cohort_rows
    ]
    new_users_by_day.sort(key=lambda r: r["date"])

    # ---------------- Aggregates ----------------
    paying_users_count = len(paying_user_ids)
    arppu_lifetime = (lifetime_revenue / paying_users_count) if paying_users_count else 0.0
    arpu_lifetime = (lifetime_revenue / total_users) if total_users else 0.0
    arppu_period = (period_revenue / len(period_paying_users)) if period_paying_users else 0.0

    gross_margin_lifetime = lifetime_revenue - lifetime_token_cost_rub
    gross_margin_period = period_revenue - period_token_cost_rub
    margin_pct_lifetime = (gross_margin_lifetime / lifetime_revenue * 100) if lifetime_revenue else 0.0
    margin_pct_period = (gross_margin_period / period_revenue * 100) if period_revenue else 0.0

    return {
        "period": {
            "days": days,
            "from": period_start.isoformat(),
            "to": now.isoformat(),
        },
        "totals_lifetime": {
            "revenue_rub": round(lifetime_revenue, 2),
            "purchases": len(all_purchases),
            "paying_users": paying_users_count,
            "total_users": total_users,
            "active_users": active_users_count,
            "arppu_rub": round(arppu_lifetime, 2),
            "arpu_rub": round(arpu_lifetime, 2),
            "paying_conversion_pct": round((paying_users_count / total_users * 100) if total_users else 0.0, 2),
            "credits_issued": lifetime_credits_issued,
            "credits_spent": lifetime_credits_spent,
            "credits_bonus_issued": lifetime_bonus_issued,
            "credits_outstanding": outstanding_balance,
            "tokens_in": lifetime_tokens_in,
            "tokens_out": lifetime_tokens_out,
            "token_cost_rub": round(lifetime_token_cost_rub, 2),
            "gross_margin_rub": round(gross_margin_lifetime, 2),
            "gross_margin_pct": round(margin_pct_lifetime, 2),
        },
        "totals_period": {
            "revenue_rub": round(period_revenue, 2),
            "purchases": len(period_purchases),
            "paying_users": len(period_paying_users),
            "active_users": period_active_users_count,
            "arppu_rub": round(arppu_period, 2),
            "credits_issued": period_credits_issued,
            "credits_spent": period_credits_spent,
            "credits_charged": period_credits_charged,
            "tokens_in": period_tokens_in,
            "tokens_out": period_tokens_out,
            "token_cost_rub": round(period_token_cost_rub, 2),
            "gross_margin_rub": round(gross_margin_period, 2),
            "gross_margin_pct": round(margin_pct_period, 2),
        },
        "by_package": [
            {
                "package_id": pkg_id,
                "name": pkg_id.title() if pkg_id in PACKAGE_PRICE_RUB else pkg_id,
                "price_rub": PACKAGE_PRICE_RUB.get(pkg_id),
                "count": v["count"],
                "revenue_rub": round(v["revenue_rub"], 2),
                "credits": v["credits"],
            }
            for pkg_id, v in sorted(by_package.items(), key=lambda kv: kv[1]["revenue_rub"], reverse=True)
        ],
        "by_day": by_day_list,
        "top_spenders": top_spenders,
        "recent_purchases": recent_purchases,
        "by_tool_lifetime": by_tool_lifetime,
        "by_plan": by_plan,
        "new_users_by_day": new_users_by_day,
        "pricing": {
            "input_token_rub_per_million": INPUT_TOKEN_PRICE_RUB_PER_MILLION,
            "output_token_rub_per_million": OUTPUT_TOKEN_PRICE_RUB_PER_MILLION,
            "rub_per_credit": AI_TOKEN_RUB_PER_CREDIT,
            "packages": [
                {
                    "id": pkg_id,
                    "price_rub": price,
                    "credits": PACKAGE_CREDITS[pkg_id],
                    "rub_per_credit": round(price / PACKAGE_CREDITS[pkg_id], 4),
                }
                for pkg_id, price in PACKAGE_PRICE_RUB.items()
            ],
        },
    }
