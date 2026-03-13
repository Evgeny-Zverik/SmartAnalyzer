from __future__ import annotations

from typing import Any

from pydantic import BaseModel, Field

from app.plugins.contracts import (
    PluginExecutionResult,
    PluginLifecycleState,
    PluginManifest,
)
from app.schemas.tools import EditedDocumentPayload, LlmConfigOptional


class PluginAvailabilityItem(BaseModel):
    manifest: PluginManifest
    feature_key: str
    parent_feature_key: str | None = None
    available_for_plan: bool
    user_enabled: bool
    effective_enabled: bool
    blocked_reason: str | None = None


class WorkspacePluginItem(BaseModel):
    manifest: PluginManifest
    compatible: bool
    enabled: bool
    visible_overlay: bool = True
    state: PluginLifecycleState
    latest_execution_id: int | None = None
    latest_result: PluginExecutionResult | None = None


class TogglePluginRequest(BaseModel):
    enabled: bool


class RunPluginRequest(BaseModel):
    llm_config: LlmConfigOptional | None = None
    edited_document: EditedDocumentPayload | None = None


class TogglePluginResponse(BaseModel):
    plugin_id: str
    enabled: bool
    state: PluginLifecycleState


class RunPluginResponse(BaseModel):
    execution_id: int
    plugin_id: str
    state: PluginLifecycleState
    result: PluginExecutionResult | None = None


class PluginExecutionResponse(BaseModel):
    execution_id: int
    plugin_id: str
    state: PluginLifecycleState
    result: PluginExecutionResult | None = None
    error: dict[str, Any] | None = None


class WorkspacePluginResultsResponse(BaseModel):
    document_id: int
    items: list[WorkspacePluginItem] = Field(default_factory=list)


class BatchRunPluginRequest(BaseModel):
    llm_config: LlmConfigOptional | None = None
    edited_document: EditedDocumentPayload | None = None
    plugin_ids: list[str] | None = None


class BatchRunPluginResponseItem(BaseModel):
    execution_id: int
    plugin_id: str
    state: PluginLifecycleState
    result: PluginExecutionResult | None = None
    error: dict[str, Any] | None = None


class BatchRunPluginResponse(BaseModel):
    items: list[BatchRunPluginResponseItem] = Field(default_factory=list)
