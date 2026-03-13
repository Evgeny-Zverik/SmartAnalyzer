from __future__ import annotations

from sqlalchemy.orm import Session

from app.core.encryption import decrypt_transport_bytes, encrypt, encrypt_str
from app.features.service import get_resolved_feature_state
from app.models.user import User

DOCUMENT_ANALYZER_ENCRYPTION_FEATURE_KEY = "document_analyzer.encryption"


def is_document_analyzer_encryption_enabled(db: Session, user: User) -> bool:
    state = get_resolved_feature_state(db, user, DOCUMENT_ANALYZER_ENCRYPTION_FEATURE_KEY)
    return bool(state and state.effective_enabled)


def decode_uploaded_document_bytes(
    *,
    db: Session,
    user: User,
    content: bytes,
    encrypted_flag: str | None,
) -> bytes:
    # Keep compatibility with already-open clients that may still upload
    # encrypted payloads while the feature is being toggled.
    if encrypted_flag == "1":
        return decrypt_transport_bytes(content, user.id)
    return content


def encode_document_storage_bytes(
    *,
    db: Session,
    user: User,
    content: bytes,
) -> bytes:
    if not is_document_analyzer_encryption_enabled(db, user):
        return content
    return encrypt(content)


def encode_document_analysis_result(
    *,
    db: Session,
    user: User,
    raw_json: str,
) -> dict:
    if not is_document_analyzer_encryption_enabled(db, user):
        return {"raw": raw_json}
    return {"encrypted": encrypt_str(raw_json)}
