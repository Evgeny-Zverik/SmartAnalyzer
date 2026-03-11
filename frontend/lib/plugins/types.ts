export type PluginCategory = "analysis" | "ui" | "overlay" | "action" | "composite";
export type InputType =
  | "pdf"
  | "docx"
  | "text"
  | "audio"
  | "video"
  | "spreadsheet"
  | "tender"
  | "chat";
export type UISlot =
  | "right_sidebar"
  | "left_sidebar"
  | "document_toolbar"
  | "top_banner"
  | "bottom_panel"
  | "inspector_panel"
  | "context_menu"
  | "document_overlay"
  | "floating_widget"
  | "header_actions";
export type PluginCapability =
  | "analyze"
  | "highlight"
  | "annotate"
  | "extract"
  | "summarize"
  | "transcribe"
  | "compare"
  | "suggest"
  | "timeline"
  | "toolbar_action"
  | "panel";
export type PluginLifecycleState =
  | "registered"
  | "compatible"
  | "enabled"
  | "queued"
  | "running"
  | "completed"
  | "partial"
  | "failed"
  | "disabled"
  | "locked";

export type PluginManifest = {
  id: string;
  version: string;
  name: string;
  description: string;
  category: PluginCategory;
  supported_inputs: InputType[];
  required_plan: "free" | "pro" | "enterprise";
  ui_slots: UISlot[];
  capabilities: PluginCapability[];
  output_schema_version: string;
  is_experimental?: boolean;
  auto_enable?: boolean;
};

export type ContentAnchor = {
  target_type: "document" | "audio" | "video" | "table";
  page?: number | null;
  text_range?: { start: number; end: number } | null;
  timestamp_ms?: number | null;
};

export type PluginFinding = {
  id: string;
  type: string;
  title: string;
  description?: string | null;
  severity?: "low" | "medium" | "high" | "critical" | null;
  confidence?: number | null;
  anchor?: ContentAnchor | null;
  quote?: string | null;
  suggestion?: string | null;
  metadata?: Record<string, unknown> | null;
};

export type PluginOverlay = {
  id: string;
  type: "highlight" | "underline" | "badge" | "comment" | "timestamp_marker";
  anchor: ContentAnchor;
  label?: string | null;
  severity?: "low" | "medium" | "high" | "critical" | null;
  color_token?: string | null;
  interactive?: boolean;
  finding_id?: string | null;
};

export type PluginAction = {
  id: string;
  label: string;
  slot: "document_toolbar" | "context_menu" | "right_sidebar" | "header_actions";
  action_type: "open_panel" | "toggle_overlay" | "jump_to_finding" | "export" | "rerun";
  payload?: Record<string, unknown> | null;
};

export type PluginPanel = {
  id: string;
  title: string;
  slot: "bottom_panel" | "inspector_panel" | "right_sidebar";
  panel_type: "list" | "timeline" | "transcript" | "table" | "details";
  data: Record<string, unknown>;
};

export type PluginExecutionResult = {
  plugin_id: string;
  plugin_version: string;
  status: "completed" | "partial" | "failed";
  started_at: string;
  finished_at?: string | null;
  summary?: {
    title: string;
    subtitle?: string | null;
    short_text: string;
    counters?: Array<{ key: string; label: string; value: number | string }>;
  } | null;
  metrics?: {
    duration_ms?: number | null;
    tokens_used?: number | null;
    model?: string | null;
    confidence?: number | null;
  } | null;
  findings: PluginFinding[];
  overlays?: PluginOverlay[];
  actions?: PluginAction[];
  panels?: PluginPanel[];
  raw?: Record<string, unknown> | null;
  error?: {
    code: string;
    message: string;
    details?: Record<string, unknown> | null;
  } | null;
};

export type WorkspacePluginItem = {
  manifest: PluginManifest;
  compatible: boolean;
  enabled: boolean;
  visible_overlay: boolean;
  state: PluginLifecycleState;
  latest_execution_id?: number | null;
  latest_result?: PluginExecutionResult | null;
};
