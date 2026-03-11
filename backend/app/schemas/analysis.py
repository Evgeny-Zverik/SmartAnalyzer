from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel


class DocumentRef(BaseModel):
    document_id: int
    filename: str


class AnalysisListItem(BaseModel):
    analysis_id: int
    tool_slug: str
    document_id: int
    folder_id: int | None = None
    status: str = "completed"
    filename: str
    created_at: datetime


class AnalysisListResponse(BaseModel):
    items: list[AnalysisListItem]
    total: int
    limit: int
    offset: int


class AnalysisRecentItem(BaseModel):
    analysis_id: int
    tool_slug: str
    filename: str
    created_at: datetime


class AnalysisDetailResponse(BaseModel):
    analysis_id: int
    tool_slug: str
    folder_id: int | None = None
    status: str = "completed"
    document: DocumentRef
    created_at: datetime
    result: dict
