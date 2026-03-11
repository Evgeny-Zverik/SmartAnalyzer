from __future__ import annotations

from sqlalchemy.orm import Session

from fastapi import APIRouter, Depends, Query, status

from app.core.security import get_current_user
from app.db.session import get_db
from app.models.document import Document
from app.models.document_analysis import DocumentAnalysis
from app.models.folder import Folder
from app.models.user import User
from app.schemas.folder import (
    FolderCreateRequest,
    FolderItemsPagination,
    FolderItemsResponse,
    FolderItem,
    FolderListItem,
    FolderListResponse,
    FolderResponse,
    FolderUpdateRequest,
)
from app.services.folders import (
    ALL_DOCUMENTS_SYSTEM_KEY,
    SYSTEM_KEY_TO_TOOL_SLUG,
    ensure_user_system_folders,
    get_folder_for_user,
    is_tool_system_folder,
)
from app.utils.errors import raise_error

router = APIRouter()


def _folder_item_count(db: Session, folder: Folder) -> int:
    if folder.system_key == ALL_DOCUMENTS_SYSTEM_KEY:
        docs_count = db.query(Document).filter(Document.user_id == folder.user_id).count()
        analyses_count = (
            db.query(DocumentAnalysis).filter(DocumentAnalysis.user_id == folder.user_id).count()
        )
        return docs_count + analyses_count

    if is_tool_system_folder(folder):
        tool_slug = SYSTEM_KEY_TO_TOOL_SLUG.get(folder.system_key or "")
        return (
            db.query(DocumentAnalysis)
            .filter(
                DocumentAnalysis.user_id == folder.user_id,
                DocumentAnalysis.tool_slug == tool_slug,
            )
            .count()
        )

    docs_count = (
        db.query(Document)
        .filter(Document.user_id == folder.user_id, Document.folder_id == folder.id)
        .count()
    )
    analyses_count = (
        db.query(DocumentAnalysis)
        .filter(DocumentAnalysis.user_id == folder.user_id, DocumentAnalysis.folder_id == folder.id)
        .count()
    )
    return docs_count + analyses_count


@router.get("", response_model=FolderListResponse)
def list_folders(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    folders = ensure_user_system_folders(db, current_user.id)
    ordered = sorted(
        folders,
        key=lambda folder: (
            0 if folder.type == "system" else 1,
            folder.created_at,
            folder.id,
        ),
    )
    return FolderListResponse(
        items=[
            FolderListItem(
                id=folder.id,
                name=folder.name,
                type=folder.type,
                system_key=folder.system_key,
                item_count=_folder_item_count(db, folder),
                created_at=folder.created_at,
            )
            for folder in ordered
        ]
    )


@router.post("", response_model=FolderResponse, status_code=status.HTTP_201_CREATED)
def create_folder(
    body: FolderCreateRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    name = body.name.strip()
    if not name:
        raise_error(400, "BAD_REQUEST", "Folder name is required", {})
    folder = Folder(user_id=current_user.id, name=name, slug=None, type="user", system_key=None)
    db.add(folder)
    db.commit()
    db.refresh(folder)
    return FolderResponse(
        id=folder.id,
        name=folder.name,
        type=folder.type,
        system_key=folder.system_key,
        created_at=folder.created_at,
    )


@router.patch("/{folder_id}", response_model=FolderResponse)
def update_folder(
    folder_id: int,
    body: FolderUpdateRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    folder = get_folder_for_user(db, current_user.id, folder_id)
    if folder.type != "user":
        raise_error(400, "BAD_REQUEST", "System folders cannot be renamed", {"folder_id": folder_id})
    name = body.name.strip()
    if not name:
        raise_error(400, "BAD_REQUEST", "Folder name is required", {})
    folder.name = name
    db.commit()
    db.refresh(folder)
    return FolderResponse(
        id=folder.id,
        name=folder.name,
        type=folder.type,
        system_key=folder.system_key,
        created_at=folder.created_at,
    )


@router.delete("/{folder_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_folder(
    folder_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    folder = get_folder_for_user(db, current_user.id, folder_id)
    if folder.type != "user":
        raise_error(400, "BAD_REQUEST", "System folders cannot be deleted", {"folder_id": folder_id})
    has_documents = (
        db.query(Document)
        .filter(Document.user_id == current_user.id, Document.folder_id == folder.id)
        .first()
    )
    has_analyses = (
        db.query(DocumentAnalysis)
        .filter(DocumentAnalysis.user_id == current_user.id, DocumentAnalysis.folder_id == folder.id)
        .first()
    )
    if has_documents or has_analyses:
        raise_error(
            409,
            "FOLDER_NOT_EMPTY",
            "Folder is not empty. Move items before deleting it.",
            {"folder_id": folder_id},
        )
    db.delete(folder)
    db.commit()
    return None


@router.get("/{folder_id}/items", response_model=FolderItemsResponse)
def list_folder_items(
    folder_id: int,
    q: str = Query(""),
    type: str = Query(""),
    status_value: str = Query("", alias="status"),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    folder = get_folder_for_user(db, current_user.id, folder_id)
    query_text = q.strip().lower()
    item_type = type.strip().lower()

    items: list[FolderItem] = []

    include_documents = item_type in ("", "document")
    include_analyses = item_type in ("", "analysis")

    if include_documents and not is_tool_system_folder(folder):
        docs_query = db.query(Document).filter(Document.user_id == current_user.id)
        if folder.system_key != ALL_DOCUMENTS_SYSTEM_KEY:
            docs_query = docs_query.filter(Document.folder_id == folder.id)
        documents = docs_query.order_by(Document.created_at.desc()).all()
        for document in documents:
            if query_text and query_text not in document.filename.lower():
                continue
            items.append(
                FolderItem(
                    id=document.id,
                    entity_type="document",
                    title=document.filename,
                    status="uploaded",
                    created_at=document.created_at,
                    mime_type=document.mime_type,
                    size_bytes=document.size_bytes,
                    folder_id=document.folder_id,
                )
            )

    if include_analyses:
        analyses_query = (
            db.query(DocumentAnalysis, Document.filename)
            .join(Document, DocumentAnalysis.document_id == Document.id)
            .filter(DocumentAnalysis.user_id == current_user.id)
        )
        if folder.system_key == ALL_DOCUMENTS_SYSTEM_KEY:
            pass
        elif is_tool_system_folder(folder):
            analyses_query = analyses_query.filter(
                DocumentAnalysis.tool_slug == SYSTEM_KEY_TO_TOOL_SLUG.get(folder.system_key or "", "")
            )
        else:
            analyses_query = analyses_query.filter(DocumentAnalysis.folder_id == folder.id)
        analyses = analyses_query.order_by(DocumentAnalysis.created_at.desc()).all()
        for analysis, filename in analyses:
            if query_text and query_text not in filename.lower():
                continue
            if status_value and analysis.status != status_value:
                continue
            items.append(
                FolderItem(
                    id=analysis.id,
                    entity_type="analysis",
                    title=filename,
                    tool_slug=analysis.tool_slug,
                    status=analysis.status,
                    created_at=analysis.created_at,
                    document_id=analysis.document_id,
                    folder_id=analysis.folder_id,
                )
            )

    items.sort(key=lambda item: item.created_at, reverse=True)
    total = len(items)
    start = (page - 1) * page_size
    end = start + page_size
    return FolderItemsResponse(
        items=items[start:end],
        pagination=FolderItemsPagination(page=page, page_size=page_size, total=total),
    )
