import os
import uuid
from pathlib import Path

from fastapi import APIRouter, Depends, File, Query, UploadFile
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.security import get_current_user
from app.db.session import get_db
from app.models.document import Document
from app.models.user import User
from app.schemas.document import DocumentListItem, DocumentListResponse, DocumentUploadResponse

router = APIRouter()

ALLOWED_MIME = {"application/pdf", "application/vnd.openxmlformats-officedocument.wordprocessingml.document", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"}


@router.post("/upload", response_model=DocumentUploadResponse, status_code=201)
def upload(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if file.content_type and file.content_type not in ALLOWED_MIME:
        from app.utils.errors import raise_error
        raise_error(400, "BAD_REQUEST", "Unsupported file type. Use PDF, DOCX or XLSX.", {"mime_type": file.content_type})
    content = file.file.read()
    size_bytes = len(content)
    ext = Path(file.filename or "file").suffix
    safe_name = f"{current_user.id}_{uuid.uuid4().hex}{ext}"
    storage_path = os.path.join(settings.storage_path, safe_name)
    Path(settings.storage_path).mkdir(parents=True, exist_ok=True)
    with open(storage_path, "wb") as f:
        f.write(content)
    doc = Document(
        user_id=current_user.id,
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
    qry = db.query(Document).filter(Document.user_id == current_user.id)
    if q:
        qry = qry.filter(Document.filename.ilike(f"%{q}%"))
    total = qry.count()
    rows = qry.order_by(Document.created_at.desc()).offset(offset).limit(limit).all()
    items = [
        DocumentListItem(document_id=r.id, filename=r.filename, created_at=r.created_at)
        for r in rows
    ]
    return DocumentListResponse(items=items, total=total, limit=limit, offset=offset)
