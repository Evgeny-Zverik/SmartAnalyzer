from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.core.security import get_current_user
from app.db.session import get_db
from app.models.document import Document
from app.models.document_analysis import DocumentAnalysis
from app.models.folder import Folder
from app.models.plugin_execution import PluginExecution
from app.models.usage_log import UsageLog
from app.models.user import User
from app.models.user_feature_flag import UserFeatureFlag
from app.models.user_settings import UserSettings
from app.models.workspace_enabled_plugin import WorkspaceEnabledPlugin

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
        )
        .filter(UsageLog.user_id.in_(user_ids))
        .group_by(UsageLog.user_id)
        .all()
        if user_ids
        else []
    )
    tokens_by_user: dict[int, dict[str, int]] = {
        user_id: {"in": int(tin or 0), "out": int(tout or 0)}
        for user_id, tin, tout in token_rows
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
                "is_blocked": bool(u.is_blocked),
                "created_at": str(u.created_at),
                "last_seen_at": last_seen_by_user.get(u.id),
                "tools": tools_by_user.get(u.id, []),
                "tokens_in": tokens_by_user.get(u.id, {}).get("in", 0),
                "tokens_out": tokens_by_user.get(u.id, {}).get("out", 0),
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
