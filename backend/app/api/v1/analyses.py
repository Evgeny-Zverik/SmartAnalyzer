from __future__ import annotations

import json

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.core.encryption import decrypt_str
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
from app.schemas.folder import FolderMoveRequest
from app.services.folders import ensure_user_system_folders, get_folder_for_user, resolve_analysis_folder
from app.utils.errors import raise_error

router = APIRouter()


def _decrypt_result(result_json: dict | None) -> dict | None:
    """Unwrap an encrypted analysis result envelope."""
    if not isinstance(result_json, dict):
        return result_json
    enc = result_json.get("encrypted")
    if not isinstance(enc, str):
        return result_json  # not encrypted
    try:
        return json.loads(decrypt_str(enc))
    except Exception:
        return result_json


@router.get("/recent", response_model=list[AnalysisRecentItem])
def list_recent_analyses(
    limit: int = Query(20, ge=1, le=50),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    ensure_user_system_folders(db, current_user.id)
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
    ensure_user_system_folders(db, current_user.id)
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
            folder_id=da.folder_id,
            status=da.status,
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
    ensure_user_system_folders(db, current_user.id)
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
        folder_id=da.folder_id,
        status=da.status,
        document=DocumentRef(document_id=doc.id, filename=doc.filename),
        created_at=da.created_at,
        result=_decrypt_result(da.result_json),
    )


@router.post("/{analysis_id}/move", status_code=204)
def move_analysis(
    analysis_id: int,
    body: FolderMoveRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    ensure_user_system_folders(db, current_user.id)
    analysis = (
        db.query(DocumentAnalysis)
        .filter(DocumentAnalysis.id == analysis_id, DocumentAnalysis.user_id == current_user.id)
        .first()
    )
    if not analysis:
        raise_error(404, "NOT_FOUND", "Analysis not found", {"analysis_id": analysis_id})
    folder = get_folder_for_user(db, current_user.id, body.folder_id)
    if folder.type != "user":
        raise_error(
            400,
            "INVALID_MOVE_TARGET",
            "Analyses can only be moved to user-created folders.",
            {"folder_id": body.folder_id},
        )
    analysis.folder_id = folder.id
    db.commit()
    return None
