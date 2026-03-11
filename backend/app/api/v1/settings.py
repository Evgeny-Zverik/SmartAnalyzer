from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.core.security import get_current_user
from app.db.session import get_db
from app.models.user import User
from app.models.user_settings import UserSettings
from app.schemas.settings import UserSettingsRead, UserSettingsUpdate

router = APIRouter()


def _get_or_create(db: Session, user_id: int) -> UserSettings:
    row = db.query(UserSettings).filter(UserSettings.user_id == user_id).first()
    if not row:
        row = UserSettings(user_id=user_id)
        db.add(row)
        db.commit()
        db.refresh(row)
    return row


def _to_read(row: UserSettings) -> UserSettingsRead:
    return UserSettingsRead(
        llm_base_url=row.llm_base_url,
        llm_api_key_set=bool(row.llm_api_key),
        llm_model=row.llm_model,
        compression_level=row.compression_level,
        analysis_mode=row.analysis_mode,
    )


@router.get("", response_model=UserSettingsRead)
def get_settings(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    row = _get_or_create(db, current_user.id)
    return _to_read(row)


@router.put("", response_model=UserSettingsRead)
def update_settings(
    body: UserSettingsUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    row = _get_or_create(db, current_user.id)
    if body.llm_base_url is not None:
        row.llm_base_url = body.llm_base_url or None
    if body.llm_api_key is not None:
        row.llm_api_key = body.llm_api_key or None
    if body.llm_model is not None:
        row.llm_model = body.llm_model or None
    if body.compression_level is not None:
        row.compression_level = body.compression_level or None
    if body.analysis_mode is not None:
        row.analysis_mode = body.analysis_mode or None
    db.commit()
    db.refresh(row)
    return _to_read(row)
