"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
} from "react";
import { IBM_Plex_Sans, PT_Serif } from "next/font/google";
import {
  AlertTriangle,
  ChevronDown,
  Clock3,
  LockKeyhole,
  ScanSearch,
  ShieldCheck,
  Sparkles,
  UserRound,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { CreditCostHint } from "@/components/billing/CreditCostHint";
import { InsufficientCreditsModal } from "@/components/billing/InsufficientCreditsAlert";
import { downloadDocumentFile } from "@/lib/utils/downloadDocumentFile";
import { UploadDropzone } from "@/components/tools/UploadDropzone";
import {
  AdvancedAiEditor,
  type AdvancedAnnotation,
} from "@/components/tools/AdvancedAiEditor";
import { PluginToolbar } from "@/components/plugins/PluginToolbar";
import { PluginPanels } from "@/components/plugins/PluginPanels";
import { uploadDocument } from "@/lib/api/documents";
import {
  prepareDocumentAnalyzer,
  type EditedDocumentRequest,
} from "@/lib/api/tools";
import { getUsageStatus, type UsageStatus } from "@/lib/api/usage";
import {
  getLatestCreditBalance,
  notifyCreditsChanged,
} from "@/lib/billing/creditBus";
import { isUnauthorized, parseApiError } from "@/lib/api/errors";
import { logout } from "@/lib/api/auth";
import { getToken } from "@/lib/auth/token";
import { requestReauth } from "@/lib/auth/session";
import { isDocumentAnalyzerAnonymizationEnabled } from "@/lib/features/documentAnalyzerAnonymization";
import { isDocumentAnalyzerEncryptionEnabled } from "@/lib/features/documentAnalyzerEncryption";
import { getFallbackCreditCost } from "@/lib/config/creditCosts";
import {
  listPlugins,
  getDocumentWorkspacePlugins,
  runDocumentWorkspacePlugin,
  runAllDocumentWorkspacePlugins,
  toggleDocumentWorkspacePlugin,
  type PluginAvailabilityItem,
} from "@/lib/plugins/api";
import {
  createInitialPluginStore,
  pluginStoreReducer,
} from "@/lib/plugins/store";
import type {
  PluginAction,
  PluginFinding,
  WorkspacePluginItem,
} from "@/lib/plugins/types";

type DocumentWorkspaceProps = {
  accepts: string[];
};

const ENCRYPTION_TOOLTIP =
  "Все ваши диалоги полностью зашифрованы и недоступны даже для нас. Мы используем алгоритм шифрования AES-GCM для максимальной защиты данных.";
const ANONYMIZATION_TOOLTIP =
  "Перед обработкой мы обезличиваем чувствительные данные: имена, контакты, реквизиты и другие идентификаторы скрываются или заменяются нейтральными значениями.";
const PRIMARY_ANALYZE_BUTTON_CLASS =
  "w-full min-w-0 rounded-full bg-[#ffd43b] text-stone-950 shadow-[0_16px_44px_rgba(245,158,11,0.24)] ring-1 ring-amber-200 transition hover:bg-[#f6c343] focus:ring-amber-200 sm:w-auto sm:min-w-[220px] [font-family:var(--font-doc-body)]";
const DOCUMENT_ANALYZER_FINDINGS = [
  {
    title: "Штраф без верхнего лимита",
    text: "Пункт 7.4: 0,5% за каждый день просрочки. Стоит ограничить максимум ответственности.",
    icon: AlertTriangle,
  },
  {
    title: "Короткий срок уведомления",
    text: "Пункт 5.2: контрагента нужно предупредить всего за 3 рабочих дня.",
    icon: Clock3,
  },
  {
    title: "Односторонняя смена оплаты",
    text: "Пункт 9.1 позволяет менять порядок оплаты без отдельного согласования.",
    icon: ShieldCheck,
  },
];
const DOCUMENT_ANALYZER_FAQ = [
  [
    "Что будет в отчете?",
    "Резюме, ключевые условия, риски, сроки, штрафы и спорные формулировки с привязкой к пунктам.",
  ],
  [
    "Можно загрузить конфиденциальный договор?",
    "Перед анализом можно обезличить чувствительные данные, а диалоги защищаются AES-GCM шифрованием.",
  ],
  [
    "Сколько стоит запуск?",
    `${getFallbackCreditCost("document-analyzer")} кредитов за запуск. Итоговая стоимость показывается до анализа и зависит от выбранных проверок.`,
  ],
];

const displayFont = PT_Serif({
  subsets: ["latin", "cyrillic"],
  variable: "--font-doc-display",
  weight: ["400", "700"],
});

const bodyFont = IBM_Plex_Sans({
  subsets: ["latin", "cyrillic"],
  variable: "--font-doc-body",
  weight: ["400", "500", "600"],
});

function extractCreditError(parsed: {
  error: string;
  details: unknown;
}): { required: number | null; balance: number | null } | null {
  if (parsed.error !== "INSUFFICIENT_CREDITS") return null;
  const details = (parsed.details ?? {}) as Record<string, unknown>;
  const required =
    typeof details.required_credits === "number"
      ? details.required_credits
      : null;
  const balance =
    typeof details.credit_balance === "number" ? details.credit_balance : null;
  return { required, balance };
}

function findingToAnnotation(
  finding: PluginFinding,
  pluginId: string,
): AdvancedAnnotation | null {
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
        : ((finding.severity as "low" | "medium" | "high" | undefined) ??
          "medium"),
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
    page_breaks?: number[];
    annotations: AdvancedAnnotation[];
  } | null>(null);
  const [store, dispatch] = useReducer(
    pluginStoreReducer,
    undefined,
    createInitialPluginStore,
  );
  const [state, setState] = useState<"idle" | "preparing" | "ready" | "error">(
    "idle",
  );
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [creditError, setCreditError] = useState<{
    required: number | null;
    balance: number | null;
  } | null>(null);
  const [runningPluginId, setRunningPluginId] = useState<string | null>(null);
  const [editedDocument, setEditedDocument] =
    useState<EditedDocumentRequest | null>(null);
  const [hasEditorChanges, setHasEditorChanges] = useState(false);
  const [downloadMenuOpen, setDownloadMenuOpen] = useState(false);
  const [encryptionEnabled, setEncryptionEnabled] = useState(false);
  const [anonymizationEnabled, setAnonymizationEnabled] = useState(false);
  const [usage, setUsage] = useState<UsageStatus | null>(null);
  const analysisAbortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    let active = true;
    isDocumentAnalyzerEncryptionEnabled().then((enabled) => {
      if (active) setEncryptionEnabled(enabled);
    });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!getToken()) return;
    let active = true;
    getUsageStatus()
      .then((next) => {
        if (active) setUsage(next);
      })
      .catch(() => {
        if (active) setUsage(null);
      });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    let active = true;
    isDocumentAnalyzerAnonymizationEnabled().then((enabled) => {
      if (active) setAnonymizationEnabled(enabled);
    });
    return () => {
      active = false;
    };
  }, []);

  // Fetch available plugins on mount (before document upload)
  useEffect(() => {
    if (!getToken()) return;
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

  const hydratePlugins = useCallback(
    async (docId: number) => {
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
    },
    [store.enabled_by_plugin],
  );

  const handlePluginRun = useCallback(
    async (pluginId: string) => {
      if (!documentId) return;
      setRunningPluginId(pluginId);
      dispatch({ type: "set_status", pluginId, status: "running" });
      try {
        const response = await runDocumentWorkspacePlugin(
          documentId,
          pluginId,
          {
            editedDocument: hasEditorChanges ? editedDocument : null,
          },
        );
        dispatch({
          type: "set_result",
          pluginId,
          result: response.result ?? null,
          status: response.state as WorkspacePluginItem["state"],
        });
      } catch (error) {
        const parsed = parseApiError(error);
        dispatch({ type: "set_status", pluginId, status: "failed" });
        const credit = extractCreditError(parsed);
        if (credit) {
          setCreditError({
            required:
              Math.max(credit.required ?? 0, enabledPluginCost) ||
              credit.required,
            balance: credit.balance,
          });
          setErrorMessage(null);
        } else {
          setErrorMessage(parsed.message || "Plugin run failed.");
        }
        if (isUnauthorized(error)) {
          logout();
          requestReauth({ reason: "workspace_plugin" });
        }
      } finally {
        setRunningPluginId(null);
      }
    },
    [documentId, hasEditorChanges, editedDocument, router],
  );

  const autoRunEnabledPlugins = useCallback(
    async (
      items: WorkspacePluginItem[],
      docId: number,
      signal?: AbortSignal,
    ) => {
      const runnable = items.filter(
        (item) =>
          item.enabled &&
          item.state !== "locked" &&
          item.state !== "completed" &&
          item.state !== "running",
      );
      if (runnable.length === 0) return;

      const pluginIds = runnable.map((item) => item.manifest.id);
      for (const id of pluginIds) {
        dispatch({ type: "set_status", pluginId: id, status: "running" });
      }
      setRunningPluginId(pluginIds[0]);

      try {
        const response = await runAllDocumentWorkspacePlugins(docId, {
          editedDocument: hasEditorChanges ? editedDocument : null,
          pluginIds,
          signal,
        });
        for (const item of response.items) {
          dispatch({
            type: "set_result",
            pluginId: item.plugin_id,
            result: item.result ?? null,
            status: item.state as WorkspacePluginItem["state"],
          });
        }
      } catch (error) {
        if (signal?.aborted) return;
        const parsed = parseApiError(error);
        for (const id of pluginIds) {
          dispatch({ type: "set_status", pluginId: id, status: "failed" });
        }
        const credit = extractCreditError(parsed);
        if (credit) {
          setCreditError({
            required:
              Math.max(credit.required ?? 0, enabledPluginCost) ||
              credit.required,
            balance: credit.balance,
          });
          setErrorMessage(null);
        } else {
          setErrorMessage(parsed.message || "Plugin batch run failed.");
        }
        if (isUnauthorized(error)) {
          logout();
          requestReauth({ reason: "workspace_batch" });
        }
      } finally {
        setRunningPluginId(null);
      }
    },
    [hasEditorChanges, editedDocument, router],
  );

  const handleUploadDocument = useCallback(
    async (fileToUpload: File) => {
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
          requestReauth({ reason: "workspace_upload" });
        }
      }
    },
    [hydratePlugins, router],
  );

  const handleRunAnalysis = useCallback(async () => {
    if (!documentId) return;
    analysisAbortRef.current?.abort();
    const controller = new AbortController();
    analysisAbortRef.current = controller;
    setState("preparing");
    setErrorMessage(null);
    setCreditError(null);

    const optimisticCost = orderedItems
      .filter((item) => item.enabled && item.state !== "locked")
      .reduce(
        (sum, item) =>
          sum +
          (usage?.credit_costs?.[item.manifest.id] ??
            getFallbackCreditCost(item.manifest.id)),
        0,
      );
    const baselineBalance = usage?.credit_balance ?? getLatestCreditBalance();
    if (baselineBalance != null && optimisticCost > 0) {
      notifyCreditsChanged(Math.max(0, baselineBalance - optimisticCost));
    }

    try {
      const items = await hydratePlugins(documentId);
      if (controller.signal.aborted) return;
      await autoRunEnabledPlugins(items, documentId, controller.signal);
      if (controller.signal.aborted) return;
      setState("ready");
      if (getToken()) {
        void getUsageStatus()
          .then((next) => {
            setUsage(next);
            notifyCreditsChanged(next.credit_balance);
          })
          .catch(() => {});
      }
    } catch (error) {
      if (controller.signal.aborted) return;
      const parsed = parseApiError(error);
      const credit = extractCreditError(parsed);
      if (credit) {
        setCreditError({
          required:
            Math.max(credit.required ?? 0, enabledPluginCost) ||
            credit.required,
          balance: credit.balance,
        });
        setErrorMessage(null);
      } else {
        setErrorMessage(parsed.message || "Cannot run analysis.");
      }
      setState("error");
      if (isUnauthorized(error)) {
        logout();
        requestReauth({ reason: "workspace_analysis" });
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
    [documentId],
  );

  const orderedItems = useMemo(
    () =>
      Object.values(store.plugins).map((item) => ({
        ...item,
        enabled: store.enabled_by_plugin[item.manifest.id] ?? item.enabled,
        state: store.status_by_plugin[item.manifest.id] ?? item.state,
        latest_result:
          store.result_by_plugin[item.manifest.id] ??
          item.latest_result ??
          null,
        visible_overlay:
          store.visible_overlay_by_plugin[item.manifest.id] ??
          item.visible_overlay,
      })),
    [store],
  );

  const selectedPlugin =
    orderedItems.find(
      (item) => item.manifest.id === store.selected_plugin_id,
    ) ?? orderedItems[0];
  const selectedResult = selectedPlugin
    ? (store.result_by_plugin[selectedPlugin.manifest.id] ??
      selectedPlugin.latest_result ??
      null)
    : null;
  const selectedFinding =
    selectedResult?.findings.find(
      (finding) => finding.id === store.active_finding_id,
    ) ??
    selectedResult?.findings[0] ??
    null;
  const toolbarActions = orderedItems.flatMap((item) =>
    item.enabled && store.result_by_plugin[item.manifest.id]?.actions
      ? (store.result_by_plugin[item.manifest.id]?.actions ?? [])
      : [],
  );

  const annotations = useMemo(() => {
    const mapped: AdvancedAnnotation[] = [];
    orderedItems.forEach((item) => {
      if (!item.enabled || !store.visible_overlay_by_plugin[item.manifest.id])
        return;
      const result = store.result_by_plugin[item.manifest.id];
      result?.findings.forEach((finding) => {
        const annotation = findingToAnnotation(finding, item.manifest.id);
        if (annotation) mapped.push(annotation);
      });
    });
    return mapped;
  }, [orderedItems, store.visible_overlay_by_plugin, store.result_by_plugin]);

  const enabledPluginCost = useMemo(
    () =>
      orderedItems
        .filter((item) => item.enabled && item.state !== "locked")
        .reduce(
          (sum, item) =>
            sum +
            (usage?.credit_costs?.[item.manifest.id] ??
              getFallbackCreditCost(item.manifest.id)),
          0,
        ),
    [orderedItems, usage?.credit_costs],
  );
  const workspaceCost = enabledPluginCost || null;
  const costPhase =
    state === "preparing" ? "running" : state === "ready" ? "success" : "idle";

  const annotationPluginById = useMemo(
    () =>
      Object.fromEntries(
        annotations.map((annotation) => [annotation.id, annotation.plugin_id]),
      ),
    [annotations],
  );
  const annotationPluginByIdRef = useRef(annotationPluginById);
  useEffect(() => {
    annotationPluginByIdRef.current = annotationPluginById;
  }, [annotationPluginById]);

  const handleSelectedAnnotationChange = useCallback(
    (annotationId: string | null) => {
      dispatch({
        type: "set_active_finding",
        findingId: annotationId ?? undefined,
        pluginId: annotationId
          ? annotationPluginByIdRef.current[annotationId]
          : undefined,
      });
    },
    [],
  );

  const handleEditorDocumentChange = useCallback(
    (payload: {
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
    },
    [],
  );

  useEffect(() => {
    if (!editorData) return;
    setEditorData((prev) => (prev ? { ...prev, annotations } : prev));
  }, [annotations, editorData?.full_text]);

  const handleToolbarAction = useCallback(
    (action: PluginAction) => {
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
    },
    [handlePluginRun],
  );

  return (
    <div
      className={`${displayFont.variable} ${bodyFont.variable} relative z-0 space-y-6`}
    >
      <InsufficientCreditsModal
        open={creditError !== null}
        required={creditError?.required ?? null}
        balance={creditError?.balance ?? null}
        toolName="Анализатор документов"
        onClose={() => setCreditError(null)}
      />
      {errorMessage ? (
        <div className="rounded-[24px] border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700 [font-family:var(--font-doc-body)]">
          {errorMessage}
        </div>
      ) : null}

      {editorData ? (
        <div className="space-y-6">
          <section className="relative overflow-visible rounded-[32px] border border-stone-800 bg-stone-950 p-4 text-zinc-100 shadow-[0_30px_110px_rgba(2,6,23,0.38)] sm:p-5">
            <div className="relative flex flex-wrap items-center justify-between gap-3 border-b border-white/10 pb-4">
              <div>
                <div className="inline-flex items-center gap-2 rounded-full border border-amber-300/35 bg-[#ffd43b]/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.24em] text-[#ffd43b] [font-family:var(--font-doc-body)]">
                  <Sparkles className="h-3.5 w-3.5" />
                  AI Document Workspace
                </div>
                <h2 className="mt-3 text-3xl leading-tight tracking-[-0.03em] text-white [font-family:var(--font-doc-display)]">
                  Редактор готов к проверке
                </h2>
                <p className="mt-2 text-sm text-zinc-300 [font-family:var(--font-doc-body)]">
                  Запускайте плагины, редактируйте формулировки и выгружайте
                  итоговый документ в нужном формате.
                </p>
              </div>
              <div className="inline-flex items-center rounded-full border border-white/20 bg-white/10 px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.14em] text-zinc-200 [font-family:var(--font-doc-body)]">
                {state === "ready"
                  ? "Готово"
                  : state === "preparing"
                    ? "Выполняется анализ"
                    : "Черновик"}
              </div>
            </div>

            <div className="relative mt-4 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setDownloadMenuOpen((prev) => !prev)}
                  className="inline-flex items-center justify-center gap-1.5 rounded-[18px] border border-white/20 bg-white/10 px-3 py-2.5 text-sm font-medium text-zinc-100 transition hover:bg-white/15 focus:outline-none focus:ring-2 focus:ring-amber-300 focus:ring-offset-2 focus:ring-offset-zinc-950 [font-family:var(--font-doc-body)]"
                >
                  Скачать
                  <ChevronDown className="h-3.5 w-3.5 text-zinc-300" />
                </button>
                {downloadMenuOpen && (
                  <div className="absolute left-0 top-[calc(100%+0.5rem)] z-20 min-w-[190px] rounded-[24px] border border-zinc-700 bg-zinc-900/95 p-2 shadow-xl backdrop-blur">
                    {(["txt", "pdf", "docx"] as const).map((fmt) => (
                      <button
                        key={fmt}
                        type="button"
                        onClick={() => {
                          setDownloadMenuOpen(false);
                          const text =
                            editedDocument?.full_text ?? editorData.full_text;
                          void downloadDocumentFile(
                            text,
                            fmt,
                            "document-analyzer",
                          );
                        }}
                        className="w-full rounded-[18px] px-3 py-2 text-left text-sm text-zinc-200 transition hover:bg-white/10 [font-family:var(--font-doc-body)]"
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
                      if (
                        window.confirm(
                          "Запустить анализ заново? Текущие результаты будут заменены.",
                        )
                      ) {
                        handleRunAnalysis();
                      }
                    }}
                    className={PRIMARY_ANALYZE_BUTTON_CLASS}
                  >
                    Анализировать ещё раз
                  </Button>
                  <CreditCostHint
                    credits={workspaceCost}
                    balance={usage?.credit_balance ?? null}
                    compact
                    tone="dark"
                    phase={costPhase}
                  />
                  <Button
                    type="button"
                    onClick={() => {
                      if (
                        window.confirm(
                          "Открыть новый документ? Текущий анализ будет потерян.",
                        )
                      ) {
                        setFile(null);
                        setState("idle");
                        setDocumentId(null);
                        setEditorData(null);
                        setEditedDocument(null);
                        setHasEditorChanges(false);
                      }
                    }}
                    variant="secondary"
                    className="w-full rounded-[18px] border-white/20 bg-white/10 text-zinc-100 hover:bg-white/15 sm:w-auto [font-family:var(--font-doc-body)]"
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
                  className="w-full min-w-0 rounded-[18px] border-white/20 bg-white/10 text-zinc-100 hover:bg-white/15 sm:w-auto sm:min-w-[220px] [font-family:var(--font-doc-body)]"
                >
                  Остановить анализ
                </Button>
              ) : (
                <>
                  <Button
                    type="button"
                    onClick={handleRunAnalysis}
                    className={PRIMARY_ANALYZE_BUTTON_CLASS}
                  >
                    Анализировать документ
                  </Button>
                  <CreditCostHint
                    credits={workspaceCost}
                    balance={usage?.credit_balance ?? null}
                    compact
                    tone="dark"
                    phase={costPhase}
                  />
                </>
              )}

              {encryptionEnabled || anonymizationEnabled ? (
                <div className="flex items-center gap-2 sm:ml-auto">
                  {encryptionEnabled ? (
                    <div className="group relative inline-flex items-center">
                      <button
                        type="button"
                        aria-label={ENCRYPTION_TOOLTIP}
                        className="inline-flex h-10 w-10 items-center justify-center rounded-[18px] border border-amber-300/35 bg-[#ffd43b]/10 text-[#ffd43b] shadow-sm transition hover:bg-[#f6c343]/20"
                      >
                        <ShieldCheck className="h-[18px] w-[18px]" />
                      </button>
                      <div className="pointer-events-none absolute bottom-[calc(100%+0.75rem)] right-0 z-20 invisible w-80 max-w-[min(20rem,calc(100vw-2rem))] rounded-[24px] border border-zinc-700 bg-zinc-900 p-3 text-xs leading-5 text-zinc-300 opacity-0 shadow-xl transition duration-150 group-hover:visible group-hover:opacity-100 [font-family:var(--font-doc-body)]">
                        {ENCRYPTION_TOOLTIP}
                      </div>
                    </div>
                  ) : null}
                  {anonymizationEnabled ? (
                    <div className="group relative inline-flex items-center">
                      <button
                        type="button"
                        aria-label={ANONYMIZATION_TOOLTIP}
                        className="inline-flex h-10 w-10 items-center justify-center rounded-[18px] border border-amber-300/35 bg-[#ffd43b]/10 text-[#ffd43b] shadow-sm transition hover:bg-[#f6c343]/20"
                      >
                        <UserRound className="h-[18px] w-[18px]" />
                      </button>
                      <div className="pointer-events-none absolute bottom-[calc(100%+0.75rem)] right-0 z-20 invisible w-80 max-w-[min(20rem,calc(100vw-2rem))] rounded-[24px] border border-zinc-700 bg-zinc-900 p-3 text-xs leading-5 text-zinc-300 opacity-0 shadow-xl transition duration-150 group-hover:visible group-hover:opacity-100 [font-family:var(--font-doc-body)]">
                        {ANONYMIZATION_TOOLTIP}
                      </div>
                    </div>
                  ) : null}
                </div>
              ) : null}
            </div>
          </section>
          <PluginToolbar
            actions={toolbarActions}
            onAction={handleToolbarAction}
          />
          <section className="rounded-[30px] border border-zinc-200 bg-[linear-gradient(180deg,#ffffff,#f7f8fa)] p-2 shadow-[0_22px_70px_rgba(15,23,42,0.08)] sm:p-3">
            <AdvancedAiEditor
              data={editorData}
              selectedAnnotationId={store.active_finding_id}
              onSelectedAnnotationChange={handleSelectedAnnotationChange}
              isAnalyzing={runningPluginId !== null}
              onDocumentChange={handleEditorDocumentChange}
            />
          </section>
          {/* PluginPanels removed */}
        </div>
      ) : (
        <section
          id="upload"
          className="relative overflow-hidden rounded-[36px] border border-stone-200 bg-white p-5 text-stone-950 shadow-[0_24px_80px_rgba(28,25,23,0.08)] sm:p-7"
        >
          <div className="relative grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(360px,0.9fr)] xl:items-start">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full border border-amber-200 bg-[#fff7cc] px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.24em] text-stone-900 [font-family:var(--font-doc-body)]">
                <Sparkles className="h-3.5 w-3.5" />
                Проверка договора
              </div>
              <h2 className="mt-4 max-w-3xl text-4xl font-bold leading-[1.02] tracking-[-0.03em] text-stone-950 [font-family:var(--font-doc-body)] sm:text-5xl lg:text-6xl">
                Найдите риски, сроки и штрафы до подписания.
              </h2>
              <p className="mt-4 max-w-2xl text-sm leading-7 text-stone-600 sm:text-base [font-family:var(--font-doc-body)]">
                Загрузите PDF, DOCX или скан. SmartAnalyzer подготовит отчет с
                ключевыми условиями, спорными формулировками и ссылками на
                пункты документа.
              </p>

              <div className="mt-6 grid gap-3 sm:grid-cols-3 [font-family:var(--font-doc-body)]">
                {[
                  ["2-3 мин", "до первого результата"],
                  [accepts.join(" / ").toUpperCase(), "без ручной подготовки"],
                  [
                    `${getFallbackCreditCost("document-analyzer")} кр`,
                    "ориентир за запуск",
                  ],
                ].map(([title, value]) => (
                  <div
                    key={title}
                    className="rounded-[24px] border border-stone-200 bg-stone-50 px-4 py-4"
                  >
                    <p className="text-lg font-bold tracking-[-0.02em] text-stone-950">
                      {title}
                    </p>
                    <p className="mt-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-stone-500">
                      {value}
                    </p>
                  </div>
                ))}
              </div>

              <div className="mt-6 rounded-[32px] border border-stone-200 bg-stone-950 p-4 text-white shadow-[0_20px_60px_rgba(28,25,23,0.14)] [font-family:var(--font-doc-body)]">
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 pb-3">
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-[#ffd43b]">
                      Пример отчета
                    </p>
                    <h3 className="mt-1 text-2xl font-semibold tracking-[-0.03em] text-white">
                      Договор поставки, 18 страниц
                    </h3>
                  </div>
                  <span className="rounded-[24px] bg-[#ffd43b] px-3 py-2 text-sm font-bold text-stone-950">
                    Готово
                  </span>
                </div>
                <div className="mt-4 grid gap-3 lg:grid-cols-3">
                  {DOCUMENT_ANALYZER_FINDINGS.map(
                    ({ title, text, icon: Icon }) => (
                      <div
                        key={title}
                        className="rounded-[24px] border border-white/10 bg-white/[0.06] p-4"
                      >
                        <Icon className="h-5 w-5 text-[#ffd43b]" />
                        <p className="mt-3 text-sm font-bold text-white">
                          {title}
                        </p>
                        <p className="mt-2 text-sm leading-6 text-zinc-400">
                          {text}
                        </p>
                      </div>
                    ),
                  )}
                </div>
              </div>
            </div>

            <aside className="rounded-[32px] border border-stone-200 bg-stone-50 p-4 shadow-[0_18px_54px_rgba(15,23,42,0.08)] sm:p-5">
              <div className="flex items-start justify-between gap-3 border-b border-stone-200 pb-4 [font-family:var(--font-doc-body)]">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-amber-700">
                    Загрузка
                  </p>
                  <h3 className="mt-2 text-2xl font-semibold tracking-[-0.03em] text-stone-950">
                    Выберите файл договора
                  </h3>
                </div>
                <div className="rounded-[24px] border border-amber-200 bg-[#fff7cc] p-3 text-stone-950">
                  <ScanSearch className="h-6 w-6" />
                </div>
              </div>

              <div className="mt-5 rounded-[28px] border border-stone-200 bg-white p-2">
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
                  surface="light"
                />
              </div>

              {state === "preparing" ? (
                <p className="mt-3 rounded-[18px] border border-amber-200 bg-[#fff7cc] px-3 py-2 text-sm font-semibold text-stone-900 [font-family:var(--font-doc-body)]">
                  Подготавливаем документ к анализу...
                </p>
              ) : null}

              <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-1 [font-family:var(--font-doc-body)]">
                {[
                  {
                    title: "Обезличивание",
                    text: "Имена, контакты, реквизиты",
                    icon: UserRound,
                  },
                  {
                    title: "Шифрование",
                    text: "AES-GCM защита диалогов",
                    icon: LockKeyhole,
                  },
                ].map(({ title, text, icon: Icon }) => (
                  <div
                    key={title}
                    className="rounded-[24px] border border-stone-200 bg-white p-4"
                  >
                    <Icon className="h-5 w-5 text-amber-700" />
                    <p className="mt-3 text-sm font-bold text-stone-950">{title}</p>
                    <p className="mt-1 text-sm leading-6 text-stone-500">
                      {text}
                    </p>
                  </div>
                ))}
              </div>
            </aside>
          </div>

          <div className="relative mt-6 grid gap-3 lg:grid-cols-3 [font-family:var(--font-doc-body)]">
            {DOCUMENT_ANALYZER_FAQ.map(([question, answer]) => (
              <div
                key={question}
                className="rounded-[24px] border border-stone-200 bg-stone-50 p-4"
              >
                <p className="text-sm font-bold text-stone-950">{question}</p>
                <p className="mt-2 text-sm leading-6 text-stone-600">{answer}</p>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
