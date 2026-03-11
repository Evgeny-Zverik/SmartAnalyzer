"use client";

import { useCallback, useEffect, useMemo, useReducer, useState } from "react";
import { FileText, Settings } from "lucide-react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { UploadDropzone } from "@/components/tools/UploadDropzone";
import { AdvancedAiEditor, type AdvancedAnnotation } from "@/components/tools/AdvancedAiEditor";
import {
  LLMSettingsModal,
  getLLMConfigForRequest,
  getStoredLLMConfig,
  getStoredLLMConfigForMode,
  type LLMConfig,
} from "@/components/tools/LLMSettingsModal";
import { PluginSidebar } from "@/components/plugins/PluginSidebar";
import { PluginToolbar } from "@/components/plugins/PluginToolbar";
import { PluginInspector } from "@/components/plugins/PluginInspector";
import { PluginPanels } from "@/components/plugins/PluginPanels";
import { uploadDocument } from "@/lib/api/documents";
import { prepareDocumentAnalyzer, type EditedDocumentRequest } from "@/lib/api/tools";
import { isUnauthorized, parseApiError } from "@/lib/api/errors";
import { logout } from "@/lib/api/auth";
import {
  getDocumentWorkspacePlugins,
  runDocumentWorkspacePlugin,
  toggleDocumentWorkspacePlugin,
} from "@/lib/plugins/api";
import { createInitialPluginStore, pluginStoreReducer } from "@/lib/plugins/store";
import type { PluginAction, PluginFinding, WorkspacePluginItem } from "@/lib/plugins/types";

type DocumentWorkspaceProps = {
  accepts: string[];
};

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function findingToAnnotation(finding: PluginFinding, pluginId: string): AdvancedAnnotation | null {
  const range = finding.anchor?.text_range;
  if (!range) return null;
  const annotationType = pluginId === "risk_analyzer" ? "risk" : "improvement";
  return {
    id: finding.id,
    type: annotationType,
    severity:
      finding.severity === "critical"
        ? "high"
        : (finding.severity as "low" | "medium" | "high" | undefined) ?? "medium",
    start_offset: range.start,
    end_offset: range.end,
    exact_quote: finding.quote ?? "",
    title: finding.title,
    reason: finding.description ?? "",
    suggested_rewrite: finding.suggestion ?? "",
  };
}

export function DocumentWorkspace({ accepts }: DocumentWorkspaceProps) {
  const router = useRouter();
  const [file, setFile] = useState<File | null>(null);
  const [documentId, setDocumentId] = useState<number | null>(null);
  const [editorData, setEditorData] = useState<{
    full_text: string;
    rich_content?: Record<string, unknown> | null;
    source_format?: string | null;
    annotations: AdvancedAnnotation[];
  } | null>(null);
  const [store, dispatch] = useReducer(pluginStoreReducer, undefined, createInitialPluginStore);
  const [state, setState] = useState<"idle" | "preparing" | "ready" | "error">("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [runningPluginId, setRunningPluginId] = useState<string | null>(null);
  const [llmConfig, setLlmConfig] = useState<LLMConfig | null>(null);
  const [llmModalOpen, setLlmModalOpen] = useState(false);
  const [editedDocument, setEditedDocument] = useState<EditedDocumentRequest | null>(null);
  const [hasEditorChanges, setHasEditorChanges] = useState(false);

  useEffect(() => {
    setLlmConfig(getStoredLLMConfig());
  }, []);

  const currentMode = llmConfig?.mode ?? "local";
  const setLlmMode = useCallback((mode: "local" | "api") => {
    setLlmConfig(getStoredLLMConfigForMode(mode));
  }, []);

  const hydratePlugins = useCallback(async (docId: number) => {
    const items = await getDocumentWorkspacePlugins(docId);
    dispatch({ type: "hydrate", items });
    return items;
  }, []);

  const handlePluginRun = useCallback(
    async (pluginId: string) => {
      if (!documentId) return;
      setRunningPluginId(pluginId);
      dispatch({ type: "set_status", pluginId, status: "running" });
      try {
        const response = await runDocumentWorkspacePlugin(documentId, pluginId, {
          llmConfig: getLLMConfigForRequest(llmConfig),
          editedDocument: hasEditorChanges ? editedDocument : null,
        });
        dispatch({
          type: "set_result",
          pluginId,
          result: response.result ?? null,
          status: response.state as WorkspacePluginItem["state"],
        });
      } catch (error) {
        const parsed = parseApiError(error);
        dispatch({ type: "set_status", pluginId, status: "failed" });
        setErrorMessage(parsed.message || "Plugin run failed.");
        if (isUnauthorized(error)) {
          logout();
          router.replace("/login");
        }
      } finally {
        setRunningPluginId(null);
      }
    },
    [documentId, llmConfig, hasEditorChanges, editedDocument, router]
  );

  const autoRunEnabledPlugins = useCallback(
    async (items: WorkspacePluginItem[]) => {
      const runnable = items.filter(
        (item) =>
          item.enabled &&
          item.state !== "locked" &&
          item.state !== "completed" &&
          item.state !== "running"
      );
      for (const item of runnable) {
        // Sequential startup keeps UI states deterministic in the current MVP.
        // eslint-disable-next-line no-await-in-loop
        await handlePluginRun(item.manifest.id);
      }
    },
    [handlePluginRun]
  );

  const handlePrepareWorkspace = useCallback(async () => {
    if (!file) return;
    setState("preparing");
    setErrorMessage(null);
    try {
      if (documentId && editorData) {
        const items = await hydratePlugins(documentId);
        setState("ready");
        await autoRunEnabledPlugins(items);
        return;
      }
      const uploadRes = await uploadDocument(file);
      setDocumentId(uploadRes.document_id);
      const prepared = await prepareDocumentAnalyzer(uploadRes.document_id);
      setEditorData(prepared.advanced_editor);
      const items = await hydratePlugins(uploadRes.document_id);
      setState("ready");
      await autoRunEnabledPlugins(items);
    } catch (error) {
      const parsed = parseApiError(error);
      setErrorMessage(parsed.message || "Cannot prepare workspace.");
      setState("error");
      if (isUnauthorized(error)) {
        logout();
        router.replace("/login");
      }
    }
  }, [file, documentId, editorData, hydratePlugins, autoRunEnabledPlugins, router]);

  const handlePluginToggle = useCallback(
    async (pluginId: string, enabled: boolean) => {
      if (!documentId) return;
      try {
        await toggleDocumentWorkspacePlugin(documentId, pluginId, enabled);
        dispatch({ type: "set_enabled", pluginId, enabled });
      } catch (error) {
        const parsed = parseApiError(error);
        setErrorMessage(parsed.message || "Cannot toggle plugin.");
      }
    },
    [documentId]
  );

  const orderedItems = useMemo(
    () =>
      Object.values(store.plugins).map((item) => ({
        ...item,
        enabled: store.enabled_by_plugin[item.manifest.id] ?? item.enabled,
        state: store.status_by_plugin[item.manifest.id] ?? item.state,
        latest_result: store.result_by_plugin[item.manifest.id] ?? item.latest_result ?? null,
        visible_overlay: store.visible_overlay_by_plugin[item.manifest.id] ?? item.visible_overlay,
      })),
    [store]
  );

  const selectedPlugin = orderedItems.find((item) => item.manifest.id === store.selected_plugin_id) ?? orderedItems[0];
  const selectedResult = selectedPlugin ? store.result_by_plugin[selectedPlugin.manifest.id] ?? selectedPlugin.latest_result ?? null : null;
  const selectedFinding =
    selectedResult?.findings.find((finding) => finding.id === store.active_finding_id) ??
    selectedResult?.findings[0] ??
    null;
  const toolbarActions = orderedItems.flatMap((item) =>
    item.enabled && store.result_by_plugin[item.manifest.id]?.actions
      ? store.result_by_plugin[item.manifest.id]?.actions ?? []
      : []
  );

  const annotations = useMemo(() => {
    const mapped: AdvancedAnnotation[] = [];
    orderedItems.forEach((item) => {
      if (!item.enabled || !store.visible_overlay_by_plugin[item.manifest.id]) return;
      const result = store.result_by_plugin[item.manifest.id];
      result?.findings.forEach((finding) => {
        const annotation = findingToAnnotation(finding, item.manifest.id);
        if (annotation) mapped.push(annotation);
      });
    });
    return mapped;
  }, [orderedItems, store.visible_overlay_by_plugin, store.result_by_plugin]);

  useEffect(() => {
    if (!editorData) return;
    setEditorData((prev) => (prev ? { ...prev, annotations } : prev));
  }, [annotations, editorData?.full_text]);

  const handleToolbarAction = useCallback((action: PluginAction) => {
    const pluginId = String(action.payload?.plugin_id || "");
    if (action.action_type === "toggle_overlay" && pluginId) {
      dispatch({ type: "toggle_overlay", pluginId });
      return;
    }
    if (action.action_type === "open_panel") {
      const panelId = String(action.payload?.panel_id || action.id);
      dispatch({ type: "open_panel", panelId });
      return;
    }
    if (action.action_type === "rerun" && pluginId) {
      void handlePluginRun(pluginId);
    }
  }, [handlePluginRun]);

  return (
    <div className="space-y-6">
      <section className="rounded-3xl border border-gray-200 bg-white p-4 shadow-sm sm:p-5">
        <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_auto] xl:items-center">
          <div className="flex min-w-0 items-center gap-3">
            <div className="rounded-2xl bg-gray-100 p-2 text-gray-500">
              <FileText className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                {file ? "Workspace input" : "Upload document"}
              </p>
              <p className="truncate text-sm font-medium text-gray-900">
                {file ? file.name : "Выберите документ для modular workspace"}
              </p>
              <p className="text-xs text-gray-500">
                {file ? `${formatSize(file.size)} · ${accepts.join(", ")}` : `Поддерживаются: ${accepts.join(", ")}`}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3 xl:justify-end">
            <div
              className="flex shrink-0 rounded-xl border border-gray-300 bg-gray-100 p-0.5"
              role="group"
              aria-label="Режим LLM"
            >
              <button
                type="button"
                onClick={() => setLlmMode("local")}
                className={`rounded-lg px-3 py-2 text-sm font-medium whitespace-nowrap transition ${
                  currentMode === "local" ? "bg-white text-gray-900 shadow-sm" : "text-gray-600 hover:text-gray-900"
                }`}
              >
                Свой сервер
              </button>
              <button
                type="button"
                onClick={() => setLlmMode("api")}
                className={`rounded-lg px-3 py-2 text-sm font-medium whitespace-nowrap transition ${
                  currentMode === "api" ? "bg-white text-gray-900 shadow-sm" : "text-gray-600 hover:text-gray-900"
                }`}
              >
                API
              </button>
            </div>
            <button
              type="button"
              onClick={() => setLlmModalOpen(true)}
              className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-gray-300 bg-white text-gray-600 hover:bg-gray-50"
              title="Настройки LLM"
              aria-label="Настройки LLM"
            >
              <Settings className="h-5 w-5" />
            </button>
            <Button
              type="button"
              onClick={handlePrepareWorkspace}
              disabled={!file || state === "preparing"}
              className="min-w-[220px]"
            >
              {state === "preparing" ? "Подготавливаем workspace..." : hasEditorChanges ? "Пересобрать workspace" : "Открыть workspace"}
            </Button>
          </div>
        </div>
        <div className="mt-4">
          <UploadDropzone
            acceptedExtensions={accepts}
            file={file}
            onFileChange={(nextFile) => {
              setFile(nextFile);
              setState(nextFile ? "ready" : "idle");
              setDocumentId(null);
              setEditorData(null);
              setEditedDocument(null);
              setHasEditorChanges(false);
              dispatch({ type: "hydrate", items: [] });
            }}
            compact
            showFileCard={false}
          />
        </div>
      </section>

      <LLMSettingsModal
        isOpen={llmModalOpen}
        onClose={() => setLlmModalOpen(false)}
        initialConfig={llmConfig}
        onSave={setLlmConfig}
      />

      {errorMessage ? (
        <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {errorMessage}
        </div>
      ) : null}

      {editorData ? (
        <div className="grid gap-6 2xl:grid-cols-[minmax(0,1fr)_340px]">
          <div className="space-y-6">
            <PluginToolbar actions={toolbarActions} onAction={handleToolbarAction} />
            <AdvancedAiEditor
              data={{ ...editorData, annotations }}
              selectedAnnotationId={store.active_finding_id}
              onSelectedAnnotationChange={(annotationId) =>
                dispatch({
                  type: "set_active_finding",
                  findingId: annotationId ?? undefined,
                  pluginId: selectedPlugin?.manifest.id,
                })
              }
              isAnalyzing={runningPluginId !== null}
              onDocumentChange={(payload) => {
                setEditedDocument({
                  full_text: payload.full_text,
                  rich_content: payload.rich_content,
                  source_format: payload.source_format,
                });
                setHasEditorChanges(payload.is_dirty);
              }}
            />
            <PluginPanels
              panels={selectedResult?.panels ?? []}
              findings={selectedResult?.findings ?? []}
              activeFindingId={store.active_finding_id}
              onSelectFinding={(finding) =>
                dispatch({
                  type: "set_active_finding",
                  findingId: finding.id,
                  pluginId: selectedPlugin?.manifest.id,
                })
              }
            />
          </div>

          <div className="space-y-6">
            <PluginSidebar
              items={orderedItems}
              selectedPluginId={selectedPlugin?.manifest.id}
              runningPluginId={runningPluginId}
              onSelect={(pluginId) => dispatch({ type: "set_active_finding", pluginId })}
              onToggle={handlePluginToggle}
              onRun={handlePluginRun}
            />
            <PluginInspector finding={selectedFinding} />
          </div>
        </div>
      ) : (
        <div className="rounded-3xl border border-dashed border-gray-300 bg-gray-50 p-8 text-sm text-gray-500">
          После загрузки документа workspace соберет совместимые плагины, включит базовые модули и начнет их независимый запуск.
        </div>
      )}
    </div>
  );
}
