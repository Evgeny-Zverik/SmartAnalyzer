import os
import uuid
from pathlib import Path

from fastapi import APIRouter, Depends, File, Form, Query, UploadFile
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.security import get_current_user
from app.utils.errors import raise_error
from app.db.session import get_db
from app.models.document import Document
from app.models.user import User
from app.schemas.document import DocumentListItem, DocumentListResponse, DocumentUploadResponse
from app.schemas.folder import FolderMoveRequest
from app.services.folders import ensure_user_system_folders, get_folder_for_user, resolve_document_folder

router = APIRouter()

ALLOWED_MIME = {"application/pdf", "application/vnd.openxmlformats-officedocument.wordprocessingml.document", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"}
ALLOWED_EXTENSIONS = {".pdf", ".docx", ".xlsx"}


@router.post("/upload", response_model=DocumentUploadResponse, status_code=201)
def upload(
    file: UploadFile = File(...),
    folder_id: int | None = Form(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    ensure_user_system_folders(db, current_user.id)
    if file.content_type and file.content_type not in ALLOWED_MIME:
        raise_error(400, "BAD_REQUEST", "Unsupported file type. Use PDF, DOCX or XLSX.", {"mime_type": file.content_type})
    ext = Path(file.filename or "file").suffix.lower()
    if ext not in ALLOWED_EXTENSIONS:
        raise_error(400, "BAD_REQUEST", "Unsupported file extension. Use .pdf, .docx or .xlsx.", {"filename": file.filename or "file"})
    try:
        content = file.file.read()
    except Exception as e:
        raise_error(400, "BAD_REQUEST", "Cannot read uploaded file.", {"detail": str(e)})
    size_bytes = len(content)
    if size_bytes == 0:
        raise_error(400, "BAD_REQUEST", "Uploaded file is empty.", {})
    if size_bytes > settings.max_upload_bytes:
        raise_error(413, "PAYLOAD_TOO_LARGE", "File too large. Maximum size 20 MB.", {"max_bytes": settings.max_upload_bytes})
    safe_name = f"{current_user.id}_{uuid.uuid4().hex}{ext}"
    storage_path = os.path.join(settings.storage_path, safe_name)
    Path(settings.storage_path).mkdir(parents=True, exist_ok=True)
    try:
        with open(storage_path, "wb") as f:
            f.write(content)
    except OSError as e:
        raise_error(500, "STORAGE_ERROR", "Cannot save uploaded file.", {"detail": str(e)})
    folder = resolve_document_folder(db, current_user.id, folder_id)
    doc = Document(
        user_id=current_user.id,
        folder_id=folder.id,
        filename=file.filename or "file",
        mime_type=file.content_type or "application/octet-stream",
        size_bytes=size_bytes,
        storage_path=storage_path,
    )
    db.add(doc)
    db.commit()
    db.refresh(doc)
    return DocumentUploadResponse(
        document_id=doc.id,
        folder_id=doc.folder_id,
        filename=doc.filename,
        mime_type=doc.mime_type,
        size_bytes=doc.size_bytes,
        created_at=doc.created_at,
    )


@router.get("", response_model=DocumentListResponse)
def list_documents(
    limit: int = Query(20, ge=1, le=100),
    offset: int = Query(0, ge=0),
    q: str = Query(""),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    ensure_user_system_folders(db, current_user.id)
    qry = db.query(Document).filter(Document.user_id == current_user.id)
    if q:
        qry = qry.filter(Document.filename.ilike(f"%{q}%"))
    total = qry.count()
    rows = qry.order_by(Document.created_at.desc()).offset(offset).limit(limit).all()
    items = [
        DocumentListItem(
            document_id=r.id,
            folder_id=r.folder_id,
            filename=r.filename,
            mime_type=r.mime_type,
            size_bytes=r.size_bytes,
            created_at=r.created_at,
        )
        for r in rows
    ]
    return DocumentListResponse(items=items, total=total, limit=limit, offset=offset)


@router.post("/{document_id}/move", status_code=204)
def move_document(
    document_id: int,
    body: FolderMoveRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    ensure_user_system_folders(db, current_user.id)
    doc = db.query(Document).filter(Document.id == document_id, Document.user_id == current_user.id).first()
    if not doc:
        raise_error(404, "NOT_FOUND", "Document not found", {"document_id": document_id})
    folder = get_folder_for_user(db, current_user.id, body.folder_id)
    if folder.type != "user":
        raise_error(
            400,
            "INVALID_MOVE_TARGET",
            "Documents can only be moved to user-created folders.",
            {"folder_id": body.folder_id},
        )
    doc.folder_id = folder.id
    db.commit()
    return None
