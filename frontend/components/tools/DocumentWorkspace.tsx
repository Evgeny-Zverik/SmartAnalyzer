"use client";

import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from "react";
import { ChevronDown } from "lucide-react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import {
  downloadDocumentFile,
} from "@/lib/utils/downloadDocumentFile";
import { UploadDropzone } from "@/components/tools/UploadDropzone";
import { AdvancedAiEditor, type AdvancedAnnotation } from "@/components/tools/AdvancedAiEditor";
import {
  LLMSettingsModal,
  getLLMConfigForRequest,
  getStoredLLMConfig,
  getStoredLLMConfigForMode,
  type LLMConfig,
} from "@/components/tools/LLMSettingsModal";
import { PluginToolbar } from "@/components/plugins/PluginToolbar";
import { PluginPanels } from "@/components/plugins/PluginPanels";
import { uploadDocument } from "@/lib/api/documents";
import { prepareDocumentAnalyzer, type EditedDocumentRequest } from "@/lib/api/tools";
import { isUnauthorized, parseApiError } from "@/lib/api/errors";
import { logout } from "@/lib/api/auth";
import {
  listPlugins,
  getDocumentWorkspacePlugins,
  runDocumentWorkspacePlugin,
  runAllDocumentWorkspacePlugins,
  toggleDocumentWorkspacePlugin,
  type PluginAvailabilityItem,
} from "@/lib/plugins/api";
import { createInitialPluginStore, pluginStoreReducer } from "@/lib/plugins/store";
import type { PluginAction, PluginFinding, WorkspacePluginItem } from "@/lib/plugins/types";

type DocumentWorkspaceProps = {
  accepts: string[];
};

function findingToAnnotation(finding: PluginFinding, pluginId: string): AdvancedAnnotation | null {
  const range = finding.anchor?.text_range;
  if (!range) return null;
  const annotationType = pluginId === "risk_analyzer" ? "risk" : "improvement";
  return {
    id: finding.id,
    plugin_id: pluginId,
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
  const [downloadMenuOpen, setDownloadMenuOpen] = useState(false);
  const analysisAbortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    setLlmConfig(getStoredLLMConfig());
  }, []);

  // Fetch available plugins on mount (before document upload)
  useEffect(() => {
    listPlugins()
      .then((available) => {
        const staticItems: WorkspacePluginItem[] = available.map((p) => ({
          manifest: p.manifest,
          compatible: true,
          enabled: p.effective_enabled,
          visible_overlay: true,
          state: p.available_for_plan ? "registered" : "locked",
          latest_execution_id: null,
          latest_result: null,
        }));
        dispatch({ type: "hydrate", items: staticItems });
      })
      .catch(() => {});
  }, []);

  const currentMode = llmConfig?.mode ?? "local";
  const setLlmMode = useCallback((mode: "local" | "api") => {
    setLlmConfig(getStoredLLMConfigForMode(mode));
  }, []);

  const hydratePlugins = useCallback(async (docId: number) => {
    const items = await getDocumentWorkspacePlugins(docId);
    // Merge pre-upload toggle choices into workspace items
    const mergedItems = items.map((item) => {
      const preUploadEnabled = store.enabled_by_plugin[item.manifest.id];
      if (preUploadEnabled !== undefined) {
        return { ...item, enabled: preUploadEnabled };
      }
      return item;
    });
    dispatch({ type: "hydrate", items: mergedItems });
    return mergedItems;
  }, [store.enabled_by_plugin]);

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
    async (items: WorkspacePluginItem[], docId: number, signal?: AbortSignal) => {
      const runnable = items.filter(
        (item) =>
          item.enabled &&
          item.state !== "locked" &&
          item.state !== "completed" &&
          item.state !== "running"
      );
      if (runnable.length === 0) return;

      const pluginIds = runnable.map((item) => item.manifest.id);
      for (const id of pluginIds) {
        dispatch({ type: "set_status", pluginId: id, status: "running" });
      }
      setRunningPluginId(pluginIds[0]);

      try {
        const response = await runAllDocumentWorkspacePlugins(docId, {
          llmConfig: getLLMConfigForRequest(llmConfig),
          editedDocument: hasEditorChanges ? editedDocument : null,
          pluginIds,
          signal,
        });
        for (const item of response.items) {
          dispatch({
            type: "set_result",
            pluginId: item.plugin_id,
            result: item.result ?? null,
            status: (item.state as WorkspacePluginItem["state"]),
          });
        }
      } catch (error) {
        if (signal?.aborted) return;
        const parsed = parseApiError(error);
        for (const id of pluginIds) {
          dispatch({ type: "set_status", pluginId: id, status: "failed" });
        }
        setErrorMessage(parsed.message || "Plugin batch run failed.");
        if (isUnauthorized(error)) {
          logout();
          router.replace("/login");
        }
      } finally {
        setRunningPluginId(null);
      }
    },
    [llmConfig, hasEditorChanges, editedDocument, router]
  );

  const handleUploadDocument = useCallback(async (fileToUpload: File) => {
    setState("preparing");
    setErrorMessage(null);
    try {
      const uploadRes = await uploadDocument(fileToUpload);
      setDocumentId(uploadRes.document_id);
      const prepared = await prepareDocumentAnalyzer(uploadRes.document_id);
      setEditorData(prepared.advanced_editor);
      await hydratePlugins(uploadRes.document_id);
      setState("idle");
    } catch (error) {
      const parsed = parseApiError(error);
      setErrorMessage(parsed.message || "Cannot upload document.");
      setState("error");
      if (isUnauthorized(error)) {
        logout();
        router.replace("/login");
      }
    }
  }, [hydratePlugins, router]);

  const handleRunAnalysis = useCallback(async () => {
    if (!documentId) return;
    analysisAbortRef.current?.abort();
    const controller = new AbortController();
    analysisAbortRef.current = controller;
    setState("preparing");
    setErrorMessage(null);
    try {
      const items = await hydratePlugins(documentId);
      if (controller.signal.aborted) return;
      await autoRunEnabledPlugins(items, documentId, controller.signal);
      if (controller.signal.aborted) return;
      setState("ready");
    } catch (error) {
      if (controller.signal.aborted) return;
      const parsed = parseApiError(error);
      setErrorMessage(parsed.message || "Cannot run analysis.");
      setState("error");
      if (isUnauthorized(error)) {
        logout();
        router.replace("/login");
      }
    }
  }, [documentId, hydratePlugins, autoRunEnabledPlugins, router]);

  const handlePluginToggle = useCallback(
    async (pluginId: string, enabled: boolean) => {
      // Before document upload, toggle locally only
      if (!documentId) {
        dispatch({ type: "set_enabled", pluginId, enabled });
        return;
      }
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

  const annotationPluginById = useMemo(
    () => Object.fromEntries(annotations.map((annotation) => [annotation.id, annotation.plugin_id])),
    [annotations]
  );

  const handleSelectedAnnotationChange = useCallback(
    (annotationId: string | null) => {
      dispatch({
        type: "set_active_finding",
        findingId: annotationId ?? undefined,
        pluginId: annotationId ? annotationPluginById[annotationId] : undefined,
      });
    },
    [annotationPluginById]
  );

  const handleEditorDocumentChange = useCallback((payload: {
    full_text: string;
    rich_content: Record<string, unknown>;
    source_format: string;
    is_dirty: boolean;
  }) => {
    setEditedDocument({
      full_text: payload.full_text,
      rich_content: payload.rich_content,
      source_format: payload.source_format,
    });
    setHasEditorChanges(payload.is_dirty);
  }, []);

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
        <div className="space-y-6">
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative">
              <button
                type="button"
                onClick={() => setDownloadMenuOpen((prev) => !prev)}
                className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-sm font-medium text-gray-700 transition focus:outline-none focus:ring-2 focus:ring-gray-400 focus:ring-offset-2"
              >
                Скачать
                <ChevronDown className="h-3.5 w-3.5 text-gray-400" />
              </button>
              {downloadMenuOpen && (
                <div className="absolute left-0 top-[calc(100%+0.5rem)] z-20 min-w-[180px] rounded-2xl border border-gray-200 bg-white p-2 shadow-xl">
                  {(["txt", "pdf", "docx"] as const).map((fmt) => (
                    <button
                      key={fmt}
                      type="button"
                      onClick={() => {
                        setDownloadMenuOpen(false);
                        const text = editedDocument?.full_text ?? editorData.full_text;
                        void downloadDocumentFile(text, fmt, "document-analyzer");
                      }}
                      className="w-full rounded-xl px-3 py-2 text-left text-sm text-gray-700 transition"
                    >
                      Скачать как {fmt.toUpperCase()}
                    </button>
                  ))}
                </div>
              )}
            </div>
            {state === "ready" ? (
              <>
                <Button
                  type="button"
                  onClick={() => {
                    if (window.confirm("Запустить анализ заново? Текущие результаты будут заменены.")) {
                      handleRunAnalysis();
                    }
                  }}
                  className="min-w-[220px]"
                >
                  Анализировать ещё раз
                </Button>
                <Button
                  type="button"
                  onClick={() => {
                    if (window.confirm("Открыть новый документ? Текущий анализ будет потерян.")) {
                      setFile(null);
                      setState("idle");
                      setDocumentId(null);
                      setEditorData(null);
                      setEditedDocument(null);
                      setHasEditorChanges(false);
                    }
                  }}
                  variant="secondary"
                >
                  Новый документ
                </Button>
              </>
            ) : state === "preparing" ? (
              <Button
                type="button"
                onClick={() => {
                  analysisAbortRef.current?.abort();
                  analysisAbortRef.current = null;
                  setState("idle");
                  setRunningPluginId(null);
                  setErrorMessage(null);
                }}
                variant="secondary"
                className="min-w-[220px]"
              >
                Остановить анализ
              </Button>
            ) : (
              <Button
                type="button"
                onClick={handleRunAnalysis}
                className="min-w-[220px]"
              >
                Анализировать документ
              </Button>
            )}
            <div className="relative inline-flex items-center">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg border border-gray-200 bg-white text-gray-500 cursor-default">
                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect width="18" height="11" x="3" y="11" rx="2" ry="2" />
                  <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                </svg>
              </div>
            </div>
          </div>
          <PluginToolbar actions={toolbarActions} onAction={handleToolbarAction} />
          <AdvancedAiEditor
            data={editorData}
            selectedAnnotationId={store.active_finding_id}
            onSelectedAnnotationChange={handleSelectedAnnotationChange}
            isAnalyzing={runningPluginId !== null}
            onDocumentChange={handleEditorDocumentChange}
          />
          {/* PluginPanels removed */}
        </div>
      ) : (
        <UploadDropzone
          acceptedExtensions={accepts}
          file={file}
          onFileChange={(nextFile) => {
            setFile(nextFile);
            setDocumentId(null);
            setEditorData(null);
            setEditedDocument(null);
            setHasEditorChanges(false);
            if (nextFile) {
              void handleUploadDocument(nextFile);
            } else {
              setState("idle");
            }
          }}
          compact
          showFileCard={false}
        />
      )}
    </div>
  );
}
