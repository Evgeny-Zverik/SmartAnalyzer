from __future__ import annotations

from datetime import datetime
from typing import Any, Literal

from pydantic import BaseModel, Field

PluginCategory = Literal["analysis", "ui", "overlay", "action", "composite"]
InputType = Literal["pdf", "docx", "text", "audio", "video", "spreadsheet", "tender", "chat"]
PluginCapability = Literal[
    "analyze",
    "highlight",
    "annotate",
    "extract",
    "summarize",
    "transcribe",
    "compare",
    "suggest",
    "timeline",
    "toolbar_action",
    "panel",
]
UISlot = Literal[
    "right_sidebar",
    "left_sidebar",
    "document_toolbar",
    "top_banner",
    "bottom_panel",
    "inspector_panel",
    "context_menu",
    "document_overlay",
    "floating_widget",
    "header_actions",
]
PluginLifecycleState = Literal[
    "registered",
    "compatible",
    "enabled",
    "queued",
    "running",
    "completed",
    "partial",
    "failed",
    "disabled",
    "locked",
]
PluginExecutionStatus = Literal["completed", "partial", "failed"]


class PluginManifest(BaseModel):
    id: str
    version: str
    name: str
    description: str
    category: PluginCategory
    supported_inputs: list[InputType]
    required_plan: Literal["free", "pro", "enterprise"]
    ui_slots: list[UISlot]
    capabilities: list[PluginCapability]
    output_schema_version: str
    is_experimental: bool = False
    auto_enable: bool = False


class ContentAnchor(BaseModel):
    target_type: Literal["document", "audio", "video", "table"]
    page: int | None = None
    text_range: dict[str, int] | None = None
    bounding_box: dict[str, float] | None = None
    timestamp_ms: int | None = None
    row_id: str | None = None
    cell_id: str | None = None


class PluginSummaryCounter(BaseModel):
    key: str
    label: str
    value: int | str


class PluginSummary(BaseModel):
    title: str
    subtitle: str | None = None
    short_text: str
    counters: list[PluginSummaryCounter] = Field(default_factory=list)


class PluginMetrics(BaseModel):
    duration_ms: int | None = None
    tokens_used: int | None = None
    model: str | None = None
    confidence: float | None = None


class PluginError(BaseModel):
    code: str
    message: str
    details: dict[str, Any] | None = None


class PluginFinding(BaseModel):
    id: str
    type: str
    title: str
    description: str | None = None
    severity: Literal["low", "medium", "high", "critical"] | None = None
    confidence: float | None = None
    anchor: ContentAnchor | None = None
    quote: str | None = None
    suggestion: str | None = None
    metadata: dict[str, Any] | None = None


class PluginOverlay(BaseModel):
    id: str
    type: Literal["highlight", "underline", "badge", "comment", "timestamp_marker"]
    anchor: ContentAnchor
    label: str | None = None
    severity: Literal["low", "medium", "high", "critical"] | None = None
    color_token: str | None = None
    interactive: bool = False
    finding_id: str | None = None


class PluginAction(BaseModel):
    id: str
    label: str
    slot: Literal["document_toolbar", "context_menu", "right_sidebar", "header_actions"]
    action_type: Literal["open_panel", "toggle_overlay", "jump_to_finding", "export", "rerun"]
    payload: dict[str, Any] | None = None


class PluginPanel(BaseModel):
    id: str
    title: str
    slot: Literal["bottom_panel", "inspector_panel", "right_sidebar"]
    panel_type: Literal["list", "timeline", "transcript", "table", "details"]
    data: dict[str, Any]


class PluginExecutionResult(BaseModel):
    plugin_id: str
    plugin_version: str
    status: PluginExecutionStatus
    started_at: datetime
    finished_at: datetime | None = None
    summary: PluginSummary | None = None
    metrics: PluginMetrics | None = None
    findings: list[PluginFinding] = Field(default_factory=list)
    overlays: list[PluginOverlay] = Field(default_factory=list)
    actions: list[PluginAction] = Field(default_factory=list)
    panels: list[PluginPanel] = Field(default_factory=list)
    raw: dict[str, Any] | None = None
    error: PluginError | None = None

