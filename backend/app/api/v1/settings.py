from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.core.encryption import encrypt_str
from app.core.security import get_current_user
from app.db.session import get_db
from app.features.service import get_resolved_feature_states, set_user_feature_flag
from app.models.user import User
from app.models.user_settings import UserSettings
from app.plugins.helpers import plan_satisfies
from app.utils.errors import raise_error

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


class FeatureModuleState(BaseModel):
    key: str
    name: str
    description: str
    example: str
    kind: str
    parent_key: str | None = None
    plugin_id: str | None = None
    required_plan: str
    default_enabled: bool
    user_enabled: bool
    available_for_plan: bool
    parent_enabled: bool
    effective_enabled: bool
    blocked_reason: str | None = None


class FeatureModuleUpdate(BaseModel):
    enabled: bool


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


def _serialize_feature_states(db: Session, user: User) -> list[FeatureModuleState]:
    return [
        FeatureModuleState(
            key=item.key,
            name=item.name,
            description=item.description,
            example=item.example,
            kind=item.kind,
            parent_key=item.parent_key,
            plugin_id=item.plugin_id,
            required_plan=item.required_plan,
            default_enabled=item.default_enabled,
            user_enabled=item.user_enabled,
            available_for_plan=item.available_for_plan,
            parent_enabled=item.parent_enabled,
            effective_enabled=item.effective_enabled,
            blocked_reason=item.blocked_reason,
        )
        for item in get_resolved_feature_states(db, user)
    ]


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
        row.llm_api_key = encrypt_str(data.llm_api_key) if data.llm_api_key else ""
    if data.llm_model is not None:
        row.llm_model = data.llm_model
    if data.compression_level is not None:
        row.compression_level = data.compression_level
    if data.analysis_mode is not None:
        row.analysis_mode = data.analysis_mode

    db.commit()
    db.refresh(row)
    return _to_response(row)


@router.get("/features", response_model=list[FeatureModuleState])
def get_feature_modules(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return _serialize_feature_states(db, current_user)


@router.put("/features/{feature_key}", response_model=list[FeatureModuleState])
def update_feature_module(
    feature_key: str,
    data: FeatureModuleUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    states_before = {item.key: item for item in get_resolved_feature_states(db, current_user)}
    current_state = states_before.get(feature_key)
    if current_state is None:
        raise_error(404, "FEATURE_NOT_FOUND", "Feature module not found", {"feature_key": feature_key})
    if data.enabled and not plan_satisfies(current_user.plan, current_state.required_plan):
        raise_error(
            403,
            "FEATURE_LOCKED",
            "Feature module requires a higher plan.",
            {"feature_key": feature_key},
        )

    set_user_feature_flag(db, current_user, feature_key, data.enabled)
    return _serialize_feature_states(db, current_user)
