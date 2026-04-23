from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, status
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


def require_admin(current_user: User = Depends(get_current_user)) -> User:
    if (current_user.email or "").strip().lower() != ADMIN_EMAIL:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin access required",
        )
    return current_user


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
):
    users = db.query(User).order_by(User.created_at.desc()).all()

    usage_rows = (
        db.query(
            UsageLog.user_id,
            UsageLog.tool_slug,
            func.count(UsageLog.id).label("count"),
        )
        .group_by(UsageLog.user_id, UsageLog.tool_slug)
        .all()
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
        .group_by(UsageLog.user_id)
        .all()
    )
    tokens_by_user: dict[int, dict[str, int]] = {
        user_id: {"in": int(tin or 0), "out": int(tout or 0)}
        for user_id, tin, tout in token_rows
    }

    last_seen_rows = (
        db.query(UsageLog.user_id, func.max(UsageLog.created_at))
        .group_by(UsageLog.user_id)
        .all()
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
                "created_at": str(u.created_at),
                "last_seen_at": last_seen_by_user.get(u.id),
                "tools": tools_by_user.get(u.id, []),
                "tokens_in": tokens_by_user.get(u.id, {}).get("in", 0),
                "tokens_out": tokens_by_user.get(u.id, {}).get("out", 0),
            }
            for u in users
        ],
        "total": len(users),
    }
