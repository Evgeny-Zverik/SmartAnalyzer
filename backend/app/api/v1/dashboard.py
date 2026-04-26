from __future__ import annotations

from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.core.security import get_current_user
from app.db.session import get_db
from app.models.credit_transaction import CreditTransaction
from app.models.document import Document
from app.models.document_analysis import DocumentAnalysis
from app.models.folder import Folder
from app.models.user import User
from app.schemas.dashboard import (
    DashboardActivityPoint,
    DashboardCounts,
    DashboardLedgerEntry,
    DashboardRecentAnalysis,
    DashboardRecentDocument,
    DashboardSummaryResponse,
    DashboardToolBreakdown,
)

router = APIRouter()


@router.get("/summary", response_model=DashboardSummaryResponse)
def get_dashboard_summary(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    user_id = current_user.id
    now = datetime.now(timezone.utc)
    today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)
    week_ago = now - timedelta(days=7)
    month_ago_date = (now - timedelta(days=29)).date()

    documents_total = db.query(func.count(Document.id)).filter(Document.user_id == user_id).scalar() or 0
    analyses_total = (
        db.query(func.count(DocumentAnalysis.id)).filter(DocumentAnalysis.user_id == user_id).scalar() or 0
    )
    folders_total = (
        db.query(func.count(Folder.id))
        .filter(Folder.user_id == user_id, Folder.type == "user")
        .scalar()
        or 0
    )
    analyses_7d = (
        db.query(func.count(DocumentAnalysis.id))
        .filter(DocumentAnalysis.user_id == user_id, DocumentAnalysis.created_at >= week_ago)
        .scalar()
        or 0
    )
    analyses_30d = (
        db.query(func.count(DocumentAnalysis.id))
        .filter(
            DocumentAnalysis.user_id == user_id,
            DocumentAnalysis.created_at >= now - timedelta(days=30),
        )
        .scalar()
        or 0
    )

    credits_spent_today = (
        db.query(func.coalesce(func.sum(-CreditTransaction.amount), 0))
        .filter(
            CreditTransaction.user_id == user_id,
            CreditTransaction.amount < 0,
            CreditTransaction.created_at >= today_start,
        )
        .scalar()
        or 0
    )
    credits_spent_7d = (
        db.query(func.coalesce(func.sum(-CreditTransaction.amount), 0))
        .filter(
            CreditTransaction.user_id == user_id,
            CreditTransaction.amount < 0,
            CreditTransaction.created_at >= week_ago,
        )
        .scalar()
        or 0
    )

    recent_analyses_rows = (
        db.query(DocumentAnalysis, Document.filename)
        .join(Document, DocumentAnalysis.document_id == Document.id)
        .filter(DocumentAnalysis.user_id == user_id)
        .order_by(DocumentAnalysis.created_at.desc())
        .limit(6)
        .all()
    )
    recent_analyses = [
        DashboardRecentAnalysis(
            analysis_id=a.id,
            tool_slug=a.tool_slug,
            status=a.status,
            document_id=a.document_id,
            filename=fn,
            created_at=a.created_at,
        )
        for a, fn in recent_analyses_rows
    ]

    analyzed_doc_ids_subq = select(DocumentAnalysis.document_id).where(
        DocumentAnalysis.user_id == user_id
    )
    pending_docs_rows = (
        db.query(Document)
        .filter(Document.user_id == user_id, ~Document.id.in_(analyzed_doc_ids_subq))
        .order_by(Document.created_at.desc())
        .limit(5)
        .all()
    )
    pending_documents = [
        DashboardRecentDocument(
            document_id=d.id,
            filename=d.filename,
            mime_type=d.mime_type,
            size_bytes=d.size_bytes,
            created_at=d.created_at,
            has_analysis=False,
        )
        for d in pending_docs_rows
    ]

    activity_rows = (
        db.query(
            func.date(DocumentAnalysis.created_at).label("day"),
            func.count(DocumentAnalysis.id).label("cnt"),
        )
        .filter(
            DocumentAnalysis.user_id == user_id,
            DocumentAnalysis.created_at >= now - timedelta(days=30),
        )
        .group_by("day")
        .all()
    )
    activity_map: dict[str, int] = {}
    for day, cnt in activity_rows:
        if hasattr(day, "isoformat"):
            key = day.isoformat()
        else:
            key = str(day)[:10]
        activity_map[key] = int(cnt)
    activity_30d: list[DashboardActivityPoint] = []
    for i in range(30):
        d = (now - timedelta(days=29 - i)).date().isoformat()
        activity_30d.append(DashboardActivityPoint(date=d, count=activity_map.get(d, 0)))

    breakdown_rows = (
        db.query(DocumentAnalysis.tool_slug, func.count(DocumentAnalysis.id))
        .filter(DocumentAnalysis.user_id == user_id)
        .group_by(DocumentAnalysis.tool_slug)
        .order_by(func.count(DocumentAnalysis.id).desc())
        .limit(6)
        .all()
    )
    tool_breakdown = [
        DashboardToolBreakdown(tool_slug=slug, count=int(cnt)) for slug, cnt in breakdown_rows
    ]

    ledger_rows = (
        db.query(CreditTransaction)
        .filter(CreditTransaction.user_id == user_id)
        .order_by(CreditTransaction.created_at.desc())
        .limit(8)
        .all()
    )
    recent_ledger = [
        DashboardLedgerEntry(
            id=t.id,
            amount=t.amount,
            balance_after=t.balance_after,
            reason=t.reason,
            reference=t.reference,
            created_at=t.created_at,
        )
        for t in ledger_rows
    ]
    _ = month_ago_date  # silence unused

    return DashboardSummaryResponse(
        plan=current_user.plan,
        credit_balance=current_user.credit_balance,
        credits_spent_today=int(credits_spent_today),
        credits_spent_7d=int(credits_spent_7d),
        counts=DashboardCounts(
            documents=int(documents_total),
            analyses=int(analyses_total),
            folders=int(folders_total),
            analyses_7d=int(analyses_7d),
            analyses_30d=int(analyses_30d),
        ),
        recent_analyses=recent_analyses,
        pending_documents=pending_documents,
        activity_30d=activity_30d,
        tool_breakdown=tool_breakdown,
        recent_ledger=recent_ledger,
    )
