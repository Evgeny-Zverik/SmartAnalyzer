import { apiFetch } from "@/lib/api/client";
import type { EditedDocumentRequest, LLMConfigRequest } from "@/lib/api/tools";
import type { WorkspacePluginItem, PluginManifest } from "@/lib/plugins/types";

export type PluginAvailabilityItem = {
  manifest: PluginManifest;
  available_for_plan: boolean;
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
    llmConfig?: LLMConfigRequest | null;
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
      llm_config: options?.llmConfig ?? null,
      edited_document: options?.editedDocument ?? null,
    }),
  });
}
