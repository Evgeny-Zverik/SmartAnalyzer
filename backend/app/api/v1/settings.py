from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.core.security import get_current_user
from app.db.session import get_db
from app.models.user import User
from app.models.user_settings import UserSettings

router = APIRouter()


class SettingsResponse(BaseModel):
    llm_base_url: str | None
    llm_api_key_set: bool
    llm_model: str | None
    compression_level: str | None
    analysis_mode: str | None


class SettingsUpdate(BaseModel):
    llm_base_url: str | None = None
    llm_api_key: str | None = None
    llm_model: str | None = None
    compression_level: str | None = None
    analysis_mode: str | None = None


def _to_response(row: UserSettings | None) -> SettingsResponse:
    if row is None:
        return SettingsResponse(
            llm_base_url=None,
            llm_api_key_set=False,
            llm_model=None,
            compression_level=None,
            analysis_mode=None,
        )
    return SettingsResponse(
        llm_base_url=row.llm_base_url,
        llm_api_key_set=bool(row.llm_api_key),
        llm_model=row.llm_model,
        compression_level=row.compression_level,
        analysis_mode=row.analysis_mode,
    )


@router.get("", response_model=SettingsResponse)
def get_settings(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    row = db.query(UserSettings).filter(UserSettings.user_id == current_user.id).first()
    return _to_response(row)


@router.put("", response_model=SettingsResponse)
def update_settings(
    data: SettingsUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    row = db.query(UserSettings).filter(UserSettings.user_id == current_user.id).first()
    if row is None:
        row = UserSettings(user_id=current_user.id)
        db.add(row)

    if data.llm_base_url is not None:
        row.llm_base_url = data.llm_base_url
    if data.llm_api_key is not None:
        row.llm_api_key = data.llm_api_key
    if data.llm_model is not None:
        row.llm_model = data.llm_model
    if data.compression_level is not None:
        row.compression_level = data.compression_level
    if data.analysis_mode is not None:
        row.analysis_mode = data.analysis_mode

    db.commit()
    db.refresh(row)
    return _to_response(row)
