from __future__ import annotations

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.core.security import get_current_user
from app.db.session import get_db
from app.models.document import Document
from app.models.document_analysis import DocumentAnalysis
from app.models.user import User
from app.schemas.analysis import (
    AnalysisDetailResponse,
    AnalysisListItem,
    AnalysisListResponse,
    AnalysisRecentItem,
    DocumentRef,
)
from app.utils.errors import raise_error

router = APIRouter()


@router.get("/recent", response_model=list[AnalysisRecentItem])
def list_recent_analyses(
    limit: int = Query(20, ge=1, le=50),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    rows = (
        db.query(DocumentAnalysis, Document.filename)
        .join(Document, DocumentAnalysis.document_id == Document.id)
        .filter(DocumentAnalysis.user_id == current_user.id)
        .order_by(DocumentAnalysis.created_at.desc())
        .limit(limit)
        .all()
    )
    return [
        AnalysisRecentItem(
            analysis_id=da.id,
            tool_slug=da.tool_slug,
            filename=filename,
            created_at=da.created_at,
        )
        for da, filename in rows
    ]


@router.get("", response_model=AnalysisListResponse)
def list_analyses(
    limit: int = Query(20, ge=1, le=100),
    offset: int = Query(0, ge=0),
    tool_slug: str = Query(""),
    q: str = Query(""),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    qry = (
        db.query(DocumentAnalysis, Document.filename)
        .join(Document, DocumentAnalysis.document_id == Document.id)
        .filter(DocumentAnalysis.user_id == current_user.id)
    )
    if tool_slug:
        qry = qry.filter(DocumentAnalysis.tool_slug == tool_slug)
    if q:
        qry = qry.filter(Document.filename.ilike(f"%{q}%"))
    total = qry.count()
    rows = qry.order_by(DocumentAnalysis.created_at.desc()).offset(offset).limit(limit).all()
    items = [
        AnalysisListItem(
            analysis_id=da.id,
            tool_slug=da.tool_slug,
            document_id=da.document_id,
            filename=filename,
            created_at=da.created_at,
        )
        for da, filename in rows
    ]
    return AnalysisListResponse(items=items, total=total, limit=limit, offset=offset)


@router.get("/{analysis_id}", response_model=AnalysisDetailResponse)
def get_analysis(
    analysis_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    row = (
        db.query(DocumentAnalysis, Document)
        .join(Document, DocumentAnalysis.document_id == Document.id)
        .filter(DocumentAnalysis.id == analysis_id)
        .first()
    )
    if not row or row[0].user_id != current_user.id:
        raise_error(404, "NOT_FOUND", "Analysis not found", {"analysis_id": analysis_id})
    da, doc = row
    return AnalysisDetailResponse(
        analysis_id=da.id,
        tool_slug=da.tool_slug,
        document=DocumentRef(document_id=doc.id, filename=doc.filename),
        created_at=da.created_at,
        result=da.result_json,
    )
