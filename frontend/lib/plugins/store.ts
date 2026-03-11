import type { PluginExecutionResult, PluginLifecycleState, WorkspacePluginItem } from "@/lib/plugins/types";

export type PluginStoreState = {
  plugins: Record<string, WorkspacePluginItem>;
  status_by_plugin: Record<string, PluginLifecycleState>;
  enabled_by_plugin: Record<string, boolean>;
  result_by_plugin: Record<string, PluginExecutionResult | null>;
  visible_overlay_by_plugin: Record<string, boolean>;
  active_finding_id?: string;
  selected_plugin_id?: string;
  open_panel_ids: string[];
};

export type PluginStoreAction =
  | { type: "hydrate"; items: WorkspacePluginItem[] }
  | { type: "set_status"; pluginId: string; status: PluginLifecycleState }
  | { type: "set_enabled"; pluginId: string; enabled: boolean }
  | { type: "set_result"; pluginId: string; result: PluginExecutionResult | null; status: PluginLifecycleState }
  | { type: "toggle_overlay"; pluginId: string }
  | { type: "set_active_finding"; findingId?: string; pluginId?: string }
  | { type: "open_panel"; panelId: string };

export function createInitialPluginStore(): PluginStoreState {
  return {
    plugins: {},
    status_by_plugin: {},
    enabled_by_plugin: {},
    result_by_plugin: {},
    visible_overlay_by_plugin: {},
    open_panel_ids: [],
  };
}

export function pluginStoreReducer(
  state: PluginStoreState,
  action: PluginStoreAction
): PluginStoreState {
  if (action.type === "hydrate") {
    const plugins = Object.fromEntries(action.items.map((item) => [item.manifest.id, item]));
    return {
      ...state,
      plugins,
      status_by_plugin: Object.fromEntries(action.items.map((item) => [item.manifest.id, item.state])),
      enabled_by_plugin: Object.fromEntries(action.items.map((item) => [item.manifest.id, item.enabled])),
      result_by_plugin: Object.fromEntries(
        action.items.map((item) => [item.manifest.id, item.latest_result ?? null])
      ),
      visible_overlay_by_plugin: Object.fromEntries(
        action.items.map((item) => [item.manifest.id, item.visible_overlay ?? true])
      ),
      selected_plugin_id:
        state.selected_plugin_id && plugins[state.selected_plugin_id]
          ? state.selected_plugin_id
          : action.items[0]?.manifest.id,
    };
  }

  if (action.type === "set_status") {
    return {
      ...state,
      status_by_plugin: { ...state.status_by_plugin, [action.pluginId]: action.status },
    };
  }

  if (action.type === "set_enabled") {
    return {
      ...state,
      enabled_by_plugin: { ...state.enabled_by_plugin, [action.pluginId]: action.enabled },
      status_by_plugin: {
        ...state.status_by_plugin,
        [action.pluginId]: action.enabled ? "enabled" : "disabled",
      },
    };
  }

  if (action.type === "set_result") {
    return {
      ...state,
      result_by_plugin: { ...state.result_by_plugin, [action.pluginId]: action.result },
      status_by_plugin: { ...state.status_by_plugin, [action.pluginId]: action.status },
    };
  }

  if (action.type === "toggle_overlay") {
    return {
      ...state,
      visible_overlay_by_plugin: {
        ...state.visible_overlay_by_plugin,
        [action.pluginId]: !state.visible_overlay_by_plugin[action.pluginId],
      },
    };
  }

  if (action.type === "set_active_finding") {
    return {
      ...state,
      active_finding_id: action.findingId,
      selected_plugin_id: action.pluginId ?? state.selected_plugin_id,
    };
  }

  if (action.type === "open_panel") {
    return {
      ...state,
      open_panel_ids: state.open_panel_ids.includes(action.panelId)
        ? state.open_panel_ids
        : [...state.open_panel_ids, action.panelId],
    };
  }

  return state;
}
