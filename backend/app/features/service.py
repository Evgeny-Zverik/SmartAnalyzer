from __future__ import annotations

from dataclasses import dataclass
from typing import Literal

from sqlalchemy.orm import Session

from app.features.registry import (
    FeatureModuleDefinition,
    get_feature_definition,
    get_feature_definition_for_plugin,
    get_feature_key_for_plugin,
    list_feature_definitions,
)
from app.models.user import User
from app.models.user_feature_flag import UserFeatureFlag
from app.plugins.helpers import plan_satisfies

BlockedReason = Literal["plan_locked", "parent_disabled"]


@dataclass(frozen=True)
class ResolvedFeatureState:
    key: str
    name: str
    description: str
    example: str
    kind: Literal["feature", "module"]
    parent_key: str | None
    plugin_id: str | None
    required_plan: Literal["free", "pro", "enterprise"]
    default_enabled: bool
    sort_order: int
    user_enabled: bool
    available_for_plan: bool
    parent_enabled: bool
    effective_enabled: bool
    blocked_reason: BlockedReason | None


def _load_user_feature_rows(db: Session, user_id: int) -> dict[str, UserFeatureFlag]:
    rows = db.query(UserFeatureFlag).filter(UserFeatureFlag.user_id == user_id).all()
    return {row.feature_key: row for row in rows}


def _resolve_state(
    definition: FeatureModuleDefinition,
    user_plan: str,
    rows_by_key: dict[str, UserFeatureFlag],
    cache: dict[str, ResolvedFeatureState],
) -> ResolvedFeatureState:
    cached = cache.get(definition.key)
    if cached is not None:
        return cached

    row = rows_by_key.get(definition.key)
    user_enabled = row.is_enabled if row is not None else definition.default_enabled
    available_for_plan = plan_satisfies(user_plan, definition.required_plan)
    parent_enabled = True
    blocked_reason: BlockedReason | None = None

    if definition.parent_key is not None:
        parent_definition = get_feature_definition(definition.parent_key)
        if parent_definition is None:
            raise ValueError(f"Unknown parent feature: {definition.parent_key}")
        parent_state = _resolve_state(parent_definition, user_plan, rows_by_key, cache)
        parent_enabled = parent_state.effective_enabled
        if not parent_enabled:
            blocked_reason = "parent_disabled"

    if not available_for_plan:
        blocked_reason = "plan_locked"

    effective_enabled = user_enabled and available_for_plan and parent_enabled
    resolved = ResolvedFeatureState(
        key=definition.key,
        name=definition.name,
        description=definition.description,
        example=definition.example,
        kind=definition.kind,
        parent_key=definition.parent_key,
        plugin_id=definition.plugin_id,
        required_plan=definition.required_plan,
        default_enabled=definition.default_enabled,
        sort_order=definition.sort_order,
        user_enabled=user_enabled,
        available_for_plan=available_for_plan,
        parent_enabled=parent_enabled,
        effective_enabled=effective_enabled,
        blocked_reason=blocked_reason,
    )
    cache[definition.key] = resolved
    return resolved


def get_resolved_feature_states(db: Session, user: User) -> list[ResolvedFeatureState]:
    rows_by_key = _load_user_feature_rows(db, user.id)
    cache: dict[str, ResolvedFeatureState] = {}
    return [
        _resolve_state(definition, user.plan, rows_by_key, cache)
        for definition in list_feature_definitions()
    ]


def get_resolved_feature_state(db: Session, user: User, feature_key: str) -> ResolvedFeatureState | None:
    definition = get_feature_definition(feature_key)
    if definition is None:
        return None
    rows_by_key = _load_user_feature_rows(db, user.id)
    return _resolve_state(definition, user.plan, rows_by_key, {})


def get_resolved_plugin_feature_states(db: Session, user: User) -> dict[str, ResolvedFeatureState]:
    states = get_resolved_feature_states(db, user)
    states_by_key = {state.key: state for state in states}
    plugin_states: dict[str, ResolvedFeatureState] = {
        state.plugin_id: state
        for state in states
        if state.plugin_id is not None
    }
    for plugin_id in ("risk_analyzer", "suggested_edits"):
        feature_key = get_feature_key_for_plugin(plugin_id)
        if feature_key is None:
            continue
        state = states_by_key.get(feature_key)
        if state is not None:
            plugin_states[plugin_id] = state
    return plugin_states


def set_user_feature_flag(db: Session, user: User, feature_key: str, enabled: bool) -> list[ResolvedFeatureState]:
    definition = get_feature_definition(feature_key)
    if definition is None:
        raise ValueError(f"Unknown feature: {feature_key}")

    row = (
        db.query(UserFeatureFlag)
        .filter(UserFeatureFlag.user_id == user.id, UserFeatureFlag.feature_key == feature_key)
        .first()
    )
    if row is None:
        row = UserFeatureFlag(user_id=user.id, feature_key=feature_key, is_enabled=enabled)
        db.add(row)
    else:
        row.is_enabled = enabled
    db.commit()
    return get_resolved_feature_states(db, user)


def get_resolved_feature_state_for_plugin(db: Session, user: User, plugin_id: str) -> ResolvedFeatureState | None:
    definition = get_feature_definition_for_plugin(plugin_id)
    if definition is None:
        return None
    rows_by_key = _load_user_feature_rows(db, user.id)
    return _resolve_state(definition, user.plan, rows_by_key, {})
