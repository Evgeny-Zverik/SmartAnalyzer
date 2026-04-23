import { apiFetch } from "@/lib/api/client";
import type { EditedDocumentRequest } from "@/lib/api/tools";
import type { WorkspacePluginItem, PluginManifest, PluginExecutionResult } from "@/lib/plugins/types";

export type PluginAvailabilityItem = {
  manifest: PluginManifest;
  feature_key: string;
  parent_feature_key: string | null;
  available_for_plan: boolean;
  user_enabled: boolean;
  effective_enabled: boolean;
  blocked_reason: string | null;
};

export async function listPlugins(): Promise<PluginAvailabilityItem[]> {
  return apiFetch<PluginAvailabilityItem[]>("/api/v1/plugins");
}

export async function getDocumentWorkspacePlugins(documentId: number): Promise<WorkspacePluginItem[]> {
  return apiFetch<WorkspacePluginItem[]>(`/api/v1/plugins/workspaces/documents/${documentId}/plugins`);
}

export async function getDocumentWorkspacePluginResults(documentId: number): Promise<{
  document_id: number;
  items: WorkspacePluginItem[];
}> {
  return apiFetch<{ document_id: number; items: WorkspacePluginItem[] }>(
    `/api/v1/plugins/workspaces/documents/${documentId}/plugin-results`
  );
}

export async function toggleDocumentWorkspacePlugin(
  documentId: number,
  pluginId: string,
  enabled: boolean
): Promise<{ plugin_id: string; enabled: boolean; state: string }> {
  return apiFetch(`/api/v1/plugins/workspaces/documents/${documentId}/plugins/${pluginId}/toggle`, {
    method: "POST",
    body: JSON.stringify({ enabled }),
  });
}

export async function runDocumentWorkspacePlugin(
  documentId: number,
  pluginId: string,
  options?: {
    editedDocument?: EditedDocumentRequest | null;
  }
): Promise<{
  execution_id: number;
  plugin_id: string;
  state: string;
  result: WorkspacePluginItem["latest_result"];
}> {
  return apiFetch(`/api/v1/plugins/workspaces/documents/${documentId}/plugins/${pluginId}/run`, {
    method: "POST",
    body: JSON.stringify({
      edited_document: options?.editedDocument ?? null,
    }),
  });
}

export type BatchRunPluginResponseItem = {
  execution_id: number;
  plugin_id: string;
  state: string;
  result: PluginExecutionResult | null;
  error: { code: string; message: string } | null;
};

export async function runAllDocumentWorkspacePlugins(
  documentId: number,
  options?: {
    editedDocument?: EditedDocumentRequest | null;
    pluginIds?: string[] | null;
    signal?: AbortSignal;
  }
): Promise<{ items: BatchRunPluginResponseItem[] }> {
  return apiFetch(`/api/v1/plugins/workspaces/documents/${documentId}/plugins/run-all`, {
    method: "POST",
    body: JSON.stringify({
      edited_document: options?.editedDocument ?? null,
      plugin_ids: options?.pluginIds ?? null,
    }),
    signal: options?.signal,
  });
}
