from datetime import datetime, timezone

from fastapi import APIRouter, Depends, Query

from app.core.security import get_current_user
from app.models.user import User
from app.schemas.analysis import (
    AnalysisDetailResponse,
    AnalysisListResponse,
    DocumentRef,
)

router = APIRouter()


@router.get("", response_model=AnalysisListResponse)
def list_analyses(
    limit: int = Query(20, ge=1, le=100),
    offset: int = Query(0, ge=0),
    tool_slug: str = Query(""),
    q: str = Query(""),
    current_user: User = Depends(get_current_user),
):
    return AnalysisListResponse(
        items=[],
        total=0,
        limit=limit,
        offset=offset,
    )


@router.get("/{analysis_id}", response_model=AnalysisDetailResponse)
def get_analysis(
    analysis_id: int,
    current_user: User = Depends(get_current_user),
):
    return AnalysisDetailResponse(
        analysis_id=analysis_id,
        tool_slug="document-analyzer",
        document=DocumentRef(document_id=0, filename=""),
        created_at=datetime.now(timezone.utc),
        result={},
    )
