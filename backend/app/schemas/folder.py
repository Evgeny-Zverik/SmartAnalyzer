from __future__ import annotations

from datetime import datetime
from typing import Literal

from pydantic import BaseModel


class FolderListItem(BaseModel):
    id: int
    name: str
    type: Literal["system", "user"]
    system_key: str | None
    item_count: int
    created_at: datetime


class FolderListResponse(BaseModel):
    items: list[FolderListItem]


class FolderCreateRequest(BaseModel):
    name: str


class FolderUpdateRequest(BaseModel):
    name: str


class FolderResponse(BaseModel):
    id: int
    name: str
    type: Literal["system", "user"]
    system_key: str | None
    created_at: datetime


class FolderItemsPagination(BaseModel):
    page: int
    page_size: int
    total: int


class FolderItem(BaseModel):
    id: int
    entity_type: Literal["document", "analysis"]
    title: str
    tool_slug: str | None = None
    status: str
    created_at: datetime
    document_id: int | None = None
    mime_type: str | None = None
    size_bytes: int | None = None
    folder_id: int | None = None


class FolderItemsResponse(BaseModel):
    items: list[FolderItem]
    pagination: FolderItemsPagination


class FolderMoveRequest(BaseModel):
    folder_id: int
