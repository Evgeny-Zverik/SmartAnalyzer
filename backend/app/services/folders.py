from __future__ import annotations

from dataclasses import dataclass

from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.models.folder import Folder
from app.utils.errors import raise_error

ALL_DOCUMENTS_SYSTEM_KEY = "all_documents"


@dataclass(frozen=True)
class SystemFolderDefinition:
    system_key: str
    name: str
    tool_slug: str | None = None


SYSTEM_FOLDER_DEFINITIONS: tuple[SystemFolderDefinition, ...] = (
    SystemFolderDefinition(system_key=ALL_DOCUMENTS_SYSTEM_KEY, name="Все документы"),
    SystemFolderDefinition(
        system_key="tool_document_analyzer",
        name="Анализатор документов",
        tool_slug="document-analyzer",
    ),
    SystemFolderDefinition(
        system_key="tool_contract_checker",
        name="Проверка договоров",
        tool_slug="contract-checker",
    ),
    SystemFolderDefinition(
        system_key="tool_data_extractor",
        name="Извлечение данных",
        tool_slug="data-extractor",
    ),
    SystemFolderDefinition(
        system_key="tool_tender_analyzer",
        name="Обзор судебной практики",
        tool_slug="tender-analyzer",
    ),
    SystemFolderDefinition(
        system_key="tool_handwriting_recognition",
        name="Распознавание рукописных документов",
        tool_slug="handwriting-recognition",
    ),
    SystemFolderDefinition(
        system_key="tool_risk_analyzer",
        name="Анализатор рисков",
        tool_slug="risk-analyzer",
    ),
)

TOOL_SLUG_TO_SYSTEM_KEY = {
    definition.tool_slug: definition.system_key
    for definition in SYSTEM_FOLDER_DEFINITIONS
    if definition.tool_slug
}
SYSTEM_KEY_TO_TOOL_SLUG = {
    definition.system_key: definition.tool_slug
    for definition in SYSTEM_FOLDER_DEFINITIONS
    if definition.tool_slug
}


def ensure_user_system_folders(db: Session, user_id: int) -> list[Folder]:
    existing = {
        folder.system_key: folder
        for folder in db.query(Folder)
        .filter(Folder.user_id == user_id, Folder.type == "system", Folder.deleted_at.is_(None))
        .all()
        if folder.system_key
    }
    created = False
    for definition in SYSTEM_FOLDER_DEFINITIONS:
        if definition.system_key in existing:
            continue
        folder = Folder(
            user_id=user_id,
            name=definition.name,
            slug=definition.system_key,
            type="system",
            system_key=definition.system_key,
        )
        db.add(folder)
        created = True
    if created:
        try:
            db.commit()
        except IntegrityError:
            # Parallel requests can try to create the same system folders.
            # Roll back and return the rows that won the race.
            db.rollback()
    return (
        db.query(Folder)
        .filter(Folder.user_id == user_id, Folder.deleted_at.is_(None))
        .order_by(Folder.type.asc(), Folder.created_at.asc(), Folder.id.asc())
        .all()
    )


def get_folder_for_user(db: Session, user_id: int, folder_id: int) -> Folder:
    folder = (
        db.query(Folder)
        .filter(Folder.id == folder_id, Folder.user_id == user_id, Folder.deleted_at.is_(None))
        .first()
    )
    if not folder:
        raise_error(404, "NOT_FOUND", "Folder not found", {"folder_id": folder_id})
    return folder


def get_all_documents_folder(db: Session, user_id: int) -> Folder:
    ensure_user_system_folders(db, user_id)
    folder = (
        db.query(Folder)
        .filter(
            Folder.user_id == user_id,
            Folder.system_key == ALL_DOCUMENTS_SYSTEM_KEY,
            Folder.deleted_at.is_(None),
        )
        .first()
    )
    if not folder:
        raise_error(500, "FOLDER_SETUP_ERROR", "All documents folder is missing", {})
    return folder


def resolve_document_folder(db: Session, user_id: int, folder_id: int | None) -> Folder:
    if folder_id is None:
        return get_all_documents_folder(db, user_id)
    folder = get_folder_for_user(db, user_id, folder_id)
    if folder.type == "system" and folder.system_key != ALL_DOCUMENTS_SYSTEM_KEY:
        raise_error(
            400,
            "BAD_REQUEST",
            "Documents can only be stored in 'Все документы' or user folders.",
            {"folder_id": folder_id, "system_key": folder.system_key},
        )
    return folder


def resolve_analysis_folder(
    db: Session, user_id: int, folder_id: int | None, tool_slug: str, fallback_folder_id: int | None = None
) -> Folder:
    target_folder_id = folder_id if folder_id is not None else fallback_folder_id
    if target_folder_id is None:
        return get_all_documents_folder(db, user_id)
    folder = get_folder_for_user(db, user_id, target_folder_id)
    if folder.type == "user" or folder.system_key == ALL_DOCUMENTS_SYSTEM_KEY:
        return folder
    allowed_tool_slug = SYSTEM_KEY_TO_TOOL_SLUG.get(folder.system_key or "")
    if allowed_tool_slug != tool_slug:
        raise_error(
            400,
            "BAD_REQUEST",
            "This system folder only accepts analyses for its own tool.",
            {
                "folder_id": target_folder_id,
                "system_key": folder.system_key,
                "tool_slug": tool_slug,
            },
        )
    return folder


def is_tool_system_folder(folder: Folder) -> bool:
    return folder.type == "system" and folder.system_key not in (None, ALL_DOCUMENTS_SYSTEM_KEY)
