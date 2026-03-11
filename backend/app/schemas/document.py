from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel


class DocumentUploadResponse(BaseModel):
    document_id: int
    folder_id: int | None = None
    filename: str
    mime_type: str
    size_bytes: int
    created_at: datetime


class DocumentListItem(BaseModel):
    document_id: int
    folder_id: int | None = None
    mime_type: str | None = None
    size_bytes: int | None = None
    filename: str
    created_at: datetime


class DocumentListResponse(BaseModel):
    items: list[DocumentListItem]
    total: int
    limit: int
    offset: int
