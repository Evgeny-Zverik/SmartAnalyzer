"use client";

import { useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import {
  useState,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  type ReactNode,
} from "react";
import {
  FileText,
  GitCompareArrows,
  ScanSearch,
  ShieldCheck,
  Sparkles,
  UserRound,
} from "lucide-react";
import type { Tool } from "@/lib/config/tools";
import {
  prepareDocumentAnalyzer,
  runToolAnalysis,
  streamDocumentAnalyzer,
  type AnalysisStage,
  type DocumentAnalyzerRunResponse,
  type EditedDocumentRequest,
} from "@/lib/api/tools";
import {
  parseApiError,
  isLimitReached,
  isUnauthorized,
} from "@/lib/api/errors";
import { logout } from "@/lib/api/auth";
import { uploadDocument } from "@/lib/api/documents";
import { ToolShell } from "@/components/tools/ToolShell";
import { UploadDropzone } from "@/components/tools/UploadDropzone";
import { SecureUploadHero } from "@/components/tools/SecureUploadHero";
import { Button } from "@/components/ui/Button";
import { CreditCostHint } from "@/components/billing/CreditCostHint";
import { getFeatureModules, getPublicFeatureModules } from "@/lib/api/settings";
import {
  getFeatureKeyForTool,
  isToolEnabled,
} from "@/lib/features/toolFeatureGate";
import {
  downloadDocumentFile,
  type DownloadDocumentFormat,
} from "@/lib/utils/downloadDocumentFile";
import { requestReauth } from "@/lib/auth/session";
import { getToken } from "@/lib/auth/token";
import { getUsageStatus, type UsageStatus } from "@/lib/api/usage";
import { getFallbackCreditCost } from "@/lib/config/creditCosts";

const ResultsPanel = dynamic(
  () =>
    import("@/components/tools/ResultsPanel").then((mod) => mod.ResultsPanel),
  { ssr: false },
);
const AdvancedAiEditor = dynamic(
  () =>
    import("@/components/tools/AdvancedAiEditor").then(
      (mod) => mod.AdvancedAiEditor,
    ),
  { ssr: false },
);
const CaseLawChatWorkspace = dynamic(
  () =>
    import("@/components/tools/CaseLawChatWorkspace").then(
      (mod) => mod.CaseLawChatWorkspace,
    ),
  { ssr: false },
);
const DocumentWorkspace = dynamic(
  () =>
    import("@/components/tools/DocumentWorkspace").then(
      (mod) => mod.DocumentWorkspace,
    ),
  { ssr: false },
);

type ToolState = "idle" | "ready" | "loading" | "success" | "error";
type DocumentTab = "summary" | "advanced";
const SECURE_HERO_TOOL_SLUGS = new Set([
  "legal-text-simplifier",
  "spelling-checker",
  "foreign-language-translator",
  "legal-document-design-review",
  "legal-style-translator",
]);
const SECURE_HERO_HEADINGS: Record<string, ReactNode> = {
  "legal-text-simplifier": (
    <>
      Загрузите документ
      <br />и запустите пересказ
    </>
  ),
  "spelling-checker": (
    <>
      Загрузите документ
      <br />и запустите проверку
    </>
  ),
  "foreign-language-translator": (
    <>
      Загрузите документ
      <br />и запустите перевод
    </>
  ),
  "legal-document-design-review": (
    <>
      Загрузите документ
      <br />и запустите дизайн-проверку
    </>
  ),
  "legal-style-translator": (
    <>
      Загрузите документ
      <br />и запустите перевод на юридический
    </>
  ),
};
const ENCRYPTION_TOOLTIP =
  "Все ваши диалоги полностью зашифрованы и недоступны даже для нас. Мы используем алгоритм шифрования AES-GCM для максимальной защиты данных.";
const ANONYMIZATION_TOOLTIP =
  "Перед обработкой мы обезличиваем чувствительные данные: имена, контакты, реквизиты и другие идентификаторы скрываются или заменяются нейтральными значениями.";
function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function getFileExtension(name: string): string {
  const index = name.lastIndexOf(".");
  return index >= 0 ? name.slice(index + 1).toLowerCase() : "";
}

function getHelpfulLlmMessage(parsed: {
  error: string;
  message: string;
  details: unknown;
}): string {
  if (parsed.error === "LLM_UNAVAILABLE") {
    return parsed.message;
  }
  if (parsed.error === "LLM_MODEL_NOT_FOUND") {
    return parsed.message;
  }
  if (parsed.error === "LLM_BAD_BASE_URL") {
    return parsed.message;
  }
  if (parsed.error === "LLM_AUTH_ERROR") {
    return parsed.message;
  }
  if (parsed.error === "CONFIG_ERROR") {
    return parsed.message;
  }
  if (parsed.error === "LLM_ERROR" && parsed.message) {
    return parsed.message;
  }
  return parsed.message;
}

function isAbortError(error: unknown): boolean {
  return error instanceof DOMException
    ? error.name === "AbortError"
    : error instanceof Error && error.name === "AbortError";
}

function mergeStreamAnnotations(
  prev: Record<string, unknown> | null,
  annotations: DocumentAnalyzerRunResponse["result"]["advanced_editor"]["annotations"],
): Record<string, unknown> | null {
  if (!prev) return prev;
  const advanced = (prev.advanced_editor as
    | {
        full_text: string;
        rich_content?: Record<string, unknown> | null;
        source_format?: string | null;
        annotations?: DocumentAnalyzerRunResponse["result"]["advanced_editor"]["annotations"];
      }
    | undefined) ?? { full_text: "", annotations: [] };

  const existing = advanced.annotations ?? [];
  const seen = new Set(existing.map((item) => item.id));
  const merged = [...existing];
  annotations.forEach((item) => {
    if (seen.has(item.id)) return;
    merged.push(item);
    seen.add(item.id);
  });

  return {
    ...prev,
    advanced_editor: {
      ...advanced,
      annotations: merged,
    },
  };
}

function PrepareEditorLoader() {
  return (
    <div className="overflow-hidden rounded-[32px] border border-gray-200 bg-gradient-to-br from-white via-amber-50/40 to-gray-50 shadow-sm">
      <div className="border-b border-gray-200 px-6 py-5">
        <div className="flex items-center gap-4">
          <div className="relative h-12 w-12 rounded-2xl bg-amber-100">
            <div className="absolute inset-2 rounded-full border-[3px] border-[#ffd43b] border-t-transparent animate-spin" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-gray-900">
              Подготавливаем AI-редактор
            </h3>
            <p className="mt-1 text-sm text-gray-600">
              Извлекаем текст и собираем документную поверхность перед полной
              AI-разметкой.
            </p>
          </div>
        </div>
      </div>
      <div className="grid gap-6 p-6 xl:grid-cols-[minmax(0,1fr)_320px]">
        <div className="rounded-[28px] border border-gray-200 bg-white px-10 py-12 shadow-[0_25px_80px_rgba(15,23,42,0.08)]">
          <div className="space-y-5">
            <div className="h-8 w-2/5 animate-pulse rounded-full bg-gray-100" />
            <div className="h-4 w-3/4 animate-pulse rounded-full bg-gray-100" />
            <div className="h-4 w-5/6 animate-pulse rounded-full bg-gray-100" />
            <div className="h-4 w-4/6 animate-pulse rounded-full bg-gray-100" />
            <div className="pt-4 space-y-4">
              <div className="h-4 w-full animate-pulse rounded-full bg-gray-100" />
              <div className="h-4 w-full animate-pulse rounded-full bg-gray-100" />
              <div className="h-4 w-11/12 animate-pulse rounded-full bg-gray-100" />
              <div className="h-4 w-full animate-pulse rounded-full bg-gray-100" />
              <div className="h-4 w-10/12 animate-pulse rounded-full bg-gray-100" />
              <div className="h-4 w-full animate-pulse rounded-full bg-gray-100" />
            </div>
          </div>
        </div>
        <div className="space-y-6">
          <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
            <div className="h-5 w-32 animate-pulse rounded-full bg-gray-100" />
            <div className="mt-5 h-24 animate-pulse rounded-2xl bg-gray-50" />
          </div>
          <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
            <div className="h-5 w-40 animate-pulse rounded-full bg-gray-100" />
            <div className="mt-5 space-y-3">
              <div className="h-20 animate-pulse rounded-2xl bg-gray-50" />
              <div className="h-20 animate-pulse rounded-2xl bg-gray-50" />
              <div className="h-20 animate-pulse rounded-2xl bg-gray-50" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export function ToolPageClient({ tool }: { tool: Tool }) {
  const router = useRouter();

  const [featureAccessReady, setFeatureAccessReady] = useState(
    () => getFeatureKeyForTool(tool.slug) === null,
  );
  const [featureAllowed, setFeatureAllowed] = useState(true);

  const [state, setState] = useState<ToolState>("idle");
  const [file, setFile] = useState<File | null>(null);
  const [compareFile, setCompareFile] = useState<File | null>(null);
  const [result, setResult] = useState<Record<string, unknown> | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [showUpgradeCta, setShowUpgradeCta] = useState(false);
  const [spellingExportText, setSpellingExportText] = useState("");
  const [downloadMenuOpen, setDownloadMenuOpen] = useState(false);
  const [stage, setStage] = useState<AnalysisStage | null>(null);
  const [elapsedSec, setElapsedSec] = useState(0);
  const [documentTab, setDocumentTab] = useState<DocumentTab>("summary");
  const [documentId, setDocumentId] = useState<number | null>(null);
  const [compareDocumentId, setCompareDocumentId] = useState<number | null>(
    null,
  );
  const [editedDocument, setEditedDocument] =
    useState<EditedDocumentRequest | null>(null);
  const [hasEditorChanges, setHasEditorChanges] = useState(false);
  const [usage, setUsage] = useState<UsageStatus | null>(null);
  const advancedEditorData = useMemo(
    () =>
      (result?.advanced_editor as {
        full_text: string;
        rich_content?: Record<string, unknown> | null;
        source_format?: string | null;
        annotations: Array<{
          id: string;
          type: "risk" | "improvement";
          severity: "low" | "medium" | "high";
          start_offset: number;
          end_offset: number;
          exact_quote: string;
          title: string;
          reason: string;
          suggested_rewrite: string;
        }>;
      }) ?? { full_text: "", annotations: [] },
    [result?.advanced_editor],
  );
  const isCompareTool = tool.slug === "data-extractor";
  const isDataExtractorPage = tool.slug === "data-extractor";
  const isComparisonPairReady = isCompareTool && !!file && !!compareFile;
  const showCompactComparisonHeader =
    isDataExtractorPage &&
    !!file &&
    !!compareFile &&
    (state === "loading" || state === "success" || state === "error");
  const isIntroCollapsed = isDataExtractorPage
    ? false
    : (!!file || !!compareFile) &&
      (state === "loading" || state === "success" || state === "error");
  const analysisAbortRef = useRef<AbortController | null>(null);
  const isSpellingCheckerPage = tool.slug === "spelling-checker";
  const isLegalTextSimplifierPage = tool.slug === "legal-text-simplifier";
  const isSecureHeroTool = SECURE_HERO_TOOL_SLUGS.has(tool.slug);
  const isSecureHeroLanding =
    isSecureHeroTool && (state === "idle" || state === "ready");
  const actionHint = isCompareTool
    ? file && compareFile
      ? state === "loading"
        ? "Идет сравнение двух документов. Можно остановить процесс в любой момент."
        : state === "success"
          ? ""
          : "Слева загрузите первый документ, справа второй. После этого запустите сравнение."
      : "Нужно загрузить два документа: базовый слева и документ для сравнения справа."
    : file
      ? state === "loading"
        ? "Идет анализ документа. Можно остановить процесс в любой момент."
        : tool.slug === "document-analyzer" && hasEditorChanges
          ? "Документ изменен. Можно отправить текущую отредактированную версию на повторный анализ."
          : state === "success"
            ? ""
            : "Панель закреплена, чтобы можно было быстро запустить анализ при скролле."
      : "Сначала загрузите файл. После выбора документа панель превратится в рабочую строку.";
  const toolCreditCost =
    usage?.credit_costs?.[tool.slug] ?? getFallbackCreditCost(tool.slug);
  const costPhase =
    state === "loading" ? "running" : state === "success" ? "success" : "idle";
  const costHint = (
    <CreditCostHint
      credits={toolCreditCost}
      balance={usage?.credit_balance ?? null}
      compact
      tone="light"
      phase={costPhase}
    />
  );
  const darkCostHint = (
    <CreditCostHint
      credits={toolCreditCost}
      balance={usage?.credit_balance ?? null}
      compact
      tone="dark"
      phase={costPhase}
    />
  );

  const refreshUsage = useCallback(() => {
    if (!getToken()) return;
    void getUsageStatus()
      .then(setUsage)
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!downloadMenuOpen) return;

    const handlePointerDown = (event: MouseEvent) => {
      const target = event.target as HTMLElement | null;
      if (!target) return;
      if (target.closest("[data-download-menu='true']")) return;
      setDownloadMenuOpen(false);
    };

    window.addEventListener("mousedown", handlePointerDown);
    return () => window.removeEventListener("mousedown", handlePointerDown);
  }, [downloadMenuOpen]);

  useEffect(() => {
    if (!getToken()) return;
    let cancelled = false;
    getUsageStatus()
      .then((next) => {
        if (!cancelled) setUsage(next);
      })
      .catch(() => {
        if (!cancelled) setUsage(null);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const featureKey = getFeatureKeyForTool(tool.slug);
    if (!featureKey) {
      setFeatureAllowed(true);
      setFeatureAccessReady(true);
      return;
    }

    let cancelled = false;
    const fetchFeatureModules = getToken()
      ? getFeatureModules
      : getPublicFeatureModules;

    fetchFeatureModules()
      .then((modules) => {
        if (cancelled) return;
        const allowed = isToolEnabled(tool.slug, modules);
        setFeatureAllowed(allowed);
        setFeatureAccessReady(true);
        if (!allowed) {
          router.replace("/tools");
        }
      })
      .catch((error) => {
        if (cancelled) return;
        if (isUnauthorized(error)) {
          getPublicFeatureModules()
            .then((modules) => {
              if (cancelled) return;
              const allowed = isToolEnabled(tool.slug, modules);
              setFeatureAllowed(allowed);
              setFeatureAccessReady(true);
              if (!allowed) {
                router.replace("/tools");
              }
            })
            .catch(() => {
              if (cancelled) return;
              if (getToken()) {
                logout();
                requestReauth({ reason: "feature_access" });
                return;
              }
              setFeatureAllowed(true);
              setFeatureAccessReady(true);
            });
          return;
        }
        setFeatureAllowed(true);
        setFeatureAccessReady(true);
      });

    return () => {
      cancelled = true;
    };
  }, [router, tool.slug]);

  const handleFileChange = useCallback(
    (f: File | null) => {
      setFile(f);
      setState(f || compareFile ? "ready" : "idle");
      setResult(null);
      setErrorMessage(null);
      setDocumentTab("summary");
      setDocumentId(null);
      setCompareDocumentId(null);
      setEditedDocument(null);
      setHasEditorChanges(false);
    },
    [compareFile],
  );

  const handleCompareFileChange = useCallback(
    (f: File | null) => {
      setCompareFile(f);
      setState(file || f ? "ready" : "idle");
      setResult(null);
      setErrorMessage(null);
      setDocumentTab("summary");
      setCompareDocumentId(null);
    },
    [file],
  );

  const handleAdvancedEditorDocumentChange = useCallback(
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
    if (state !== "loading") return;
    const id = setInterval(() => {
      setElapsedSec((prev) => prev + 1);
    }, 1000);
    return () => clearInterval(id);
  }, [state]);

  const handleAnalyze = useCallback(async () => {
    if (!file) return;
    if (isCompareTool && !compareFile) return;
    analysisAbortRef.current?.abort();
    const controller = new AbortController();
    analysisAbortRef.current = controller;
    setState("loading");
    setStage(null);
    setElapsedSec(0);
    setErrorMessage(null);
    setResult(null);
    setShowUpgradeCta(false);
    try {
      if (tool.slug === "document-analyzer") {
        let currentDocumentId = documentId;

        if (!currentDocumentId) {
          setStage("upload");
          const uploadRes = await uploadDocument(file, {
            signal: controller.signal,
          });
          currentDocumentId = uploadRes.document_id;
          setDocumentId(currentDocumentId);

          setStage("analyze");
          const prepared = await prepareDocumentAnalyzer(
            currentDocumentId,
            controller.signal,
          );
          setResult({
            summary: "",
            key_points: [],
            risks: [],
            important_dates: [],
            advanced_editor: prepared.advanced_editor,
          });
          setDocumentTab("advanced");
        } else if (hasEditorChanges && editedDocument) {
          setResult((prev) => ({
            ...(prev ?? {
              summary: "",
              key_points: [],
              risks: [],
              important_dates: [],
            }),
            advanced_editor: {
              full_text: editedDocument.full_text,
              rich_content: editedDocument.rich_content,
              source_format: editedDocument.source_format,
              annotations: [],
            },
          }));
          setDocumentTab("advanced");
        }

        await streamDocumentAnalyzer(
          currentDocumentId,
          controller.signal,
          hasEditorChanges ? editedDocument : null,
          (event) => {
            if (event.type === "progress") {
              setStage(event.stage);
              return;
            }
            if (event.type === "annotations_batch") {
              setStage("review");
              setResult((prev) =>
                mergeStreamAnnotations(prev, event.annotations),
              );
              return;
            }
            if (event.type === "final") {
              setStage("done");
              setResult(event.result as unknown as Record<string, unknown>);
              setDocumentTab("advanced");
              setHasEditorChanges(false);
              setState("success");
              refreshUsage();
              return;
            }
            if (event.type === "error") {
              throw new Error(event.message || "Streaming analysis failed.");
            }
          },
        );
      } else if (tool.slug === "data-extractor") {
        let currentDocumentId = documentId;
        let currentCompareDocumentId = compareDocumentId;

        setStage("upload");
        if (!currentDocumentId) {
          const uploadRes = await uploadDocument(file, {
            signal: controller.signal,
          });
          currentDocumentId = uploadRes.document_id;
          setDocumentId(currentDocumentId);
        }
        if (!currentCompareDocumentId && compareFile) {
          const uploadRes = await uploadDocument(compareFile, {
            signal: controller.signal,
          });
          currentCompareDocumentId = uploadRes.document_id;
          setCompareDocumentId(currentCompareDocumentId);
        }
        if (!currentCompareDocumentId) {
          throw new Error("Second document is required for comparison.");
        }

        setStage("analyze");
        const analysis = await runToolAnalysis(
          tool.slug,
          file,
          (s) => {
            setStage(s);
          },
          controller.signal,
          {
            existingDocumentId: currentDocumentId,
            compareDocumentId: currentCompareDocumentId,
          },
        );
        setResult(analysis.result as Record<string, unknown>);
        setState("success");
        refreshUsage();
      } else {
        const analysis = await runToolAnalysis(
          tool.slug,
          file,
          (s) => {
            setStage(s);
          },
          controller.signal,
        );
        setResult(analysis.result as Record<string, unknown>);
        if (analysis.documentId) {
          setDocumentId(analysis.documentId);
        }
        setState("success");
        refreshUsage();
      }
    } catch (e) {
      if (isAbortError(e)) {
        setState(file ? "ready" : "idle");
        setStage(null);
        setElapsedSec(0);
        setErrorMessage(null);
        setShowUpgradeCta(false);
        return;
      }
      if (isUnauthorized(e)) {
        logout();
        requestReauth({ reason: "tool_analysis" });
        return;
      }
      const limitReached = isLimitReached(e);
      const parsed = parseApiError(e);
      let message = parsed.message;
      if (limitReached) {
        message = "Daily limit reached. Upgrade to Pro.";
      } else if (parsed.status === 413) {
        message = "File too large. Maximum size 20 MB.";
      } else if (parsed.status === 400 && parsed.error === "BAD_REQUEST") {
        if (tool.slug === "data-extractor") {
          message =
            message || "Невозможно прочитать один из документов для сравнения.";
        } else {
          message = message || "Cannot read text from document.";
        }
      } else if (parsed.status === 500) {
        if (
          parsed.error === "LLM_UNAVAILABLE" ||
          parsed.error === "LLM_MODEL_NOT_FOUND" ||
          parsed.error === "LLM_BAD_BASE_URL" ||
          parsed.error === "LLM_AUTH_ERROR" ||
          parsed.error === "CONFIG_ERROR" ||
          parsed.error === "LLM_ERROR"
        ) {
          message = getHelpfulLlmMessage(parsed);
        } else if (tool.slug === "data-extractor") {
          message =
            message || "Сравнение документов не удалось. Попробуйте еще раз.";
        } else {
          message = message || "Analysis failed. Try again.";
        }
      }
      setErrorMessage(message);
      setShowUpgradeCta(limitReached);
      setState("error");
    } finally {
      if (analysisAbortRef.current === controller) {
        analysisAbortRef.current = null;
      }
    }
  }, [
    file,
    compareFile,
    isCompareTool,
    tool.slug,
    router,
    documentId,
    compareDocumentId,
    editedDocument,
    hasEditorChanges,
    refreshUsage,
  ]);

  const handleAbortAnalysis = useCallback(() => {
    analysisAbortRef.current?.abort();
    analysisAbortRef.current = null;
  }, []);

  useEffect(() => {
    return () => {
      analysisAbortRef.current?.abort();
    };
  }, []);

  if (!featureAccessReady) {
    return (
      <ToolShell tool={tool}>
        <div className="flex min-h-[40vh] items-center justify-center">
          <p className="text-sm text-gray-500">
            Проверяем доступность инструмента...
          </p>
        </div>
      </ToolShell>
    );
  }

  if (!featureAllowed) {
    return null;
  }

  if (tool.slug === "document-analyzer") {
    return (
      <ToolShell tool={tool}>
        <DocumentWorkspace accepts={tool.mvp.accepts} />
      </ToolShell>
    );
  }

  if (tool.slug === "tender-analyzer") {
    return (
      <ToolShell tool={tool}>
        <CaseLawChatWorkspace tool={tool} />
      </ToolShell>
    );
  }

  return (
    <ToolShell
      tool={tool}
      metaAction={
        file || compareFile ? (
          <Button
            type="button"
            variant="secondary"
            onClick={() => {
              if (state === "loading") {
                handleAbortAnalysis();
              }
              handleFileChange(null);
              if (isCompareTool) {
                handleCompareFileChange(null);
              }
              setState("idle");
              setResult(null);
              setErrorMessage(null);
              setDocumentId(null);
              setCompareDocumentId(null);
            }}
            className="whitespace-nowrap"
          >
            {isCompareTool ? "Сменить файлы" : "Сменить файл"}
          </Button>
        ) : null
      }
    >
      <div className="space-y-8">
        {!isIntroCollapsed &&
          (isDataExtractorPage ? (
            showCompactComparisonHeader ? (
              <section className="overflow-hidden rounded-[30px] border border-stone-300 bg-[radial-gradient(circle_at_top,_rgba(255,255,255,0.96),_rgba(243,240,232,0.96)_60%,_rgba(235,229,219,0.98))] p-4 shadow-[0_24px_80px_rgba(28,25,23,0.12)] sm:p-5">
                <div className="grid gap-3 xl:grid-cols-[minmax(0,1fr)_240px] xl:items-center">
                  <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] md:items-center">
                    <div className="min-w-0 rounded-[24px] border border-amber-200 bg-white/85 px-4 py-4">
                      <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-amber-700">
                        Документ слева
                      </p>
                      <p className="mt-2 truncate text-sm font-medium text-stone-900">
                        {file ? file.name : "Файл не выбран"}
                      </p>
                      <p className="mt-1 text-xs text-stone-500">
                        {file
                          ? `${formatSize(file.size)} · .${getFileExtension(file.name) || "file"}`
                          : `Поддерживаются: ${tool.mvp.accepts.join(", ")}`}
                      </p>
                    </div>

                    <div className="hidden justify-center md:flex">
                      <div
                        className={`flex items-center gap-3 rounded-full border px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.24em] transition-all duration-500 ${
                          isComparisonPairReady
                            ? "border-amber-300/30 bg-amber-400/10 text-amber-700 shadow-[0_0_24px_rgba(253,224,71,0.14)]"
                            : "border-stone-300 bg-white/70 text-stone-500"
                        }`}
                      >
                        <span>Левая</span>
                        <div className="relative h-px w-12 overflow-hidden rounded-full bg-gradient-to-r from-amber-300 via-stone-300 to-amber-300">
                          {isComparisonPairReady ? (
                            <div className="absolute inset-y-0 left-0 w-6 animate-[pulse_1.4s_ease-in-out_infinite] bg-white/80 blur-[2px]" />
                          ) : null}
                        </div>
                        <span>
                          {isComparisonPairReady ? "Готово" : "Ожидание"}
                        </span>
                        <div className="relative h-px w-12 overflow-hidden rounded-full bg-gradient-to-r from-amber-300 via-stone-300 to-amber-300">
                          {isComparisonPairReady ? (
                            <div className="absolute inset-y-0 right-0 w-6 animate-[pulse_1.4s_ease-in-out_infinite] bg-white/80 blur-[2px]" />
                          ) : null}
                        </div>
                        <span>Правая</span>
                      </div>
                    </div>

                    <div className="min-w-0 rounded-[24px] border border-amber-200 bg-white/85 px-4 py-4">
                      <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-amber-700">
                        Документ справа
                      </p>
                      <p className="mt-2 truncate text-sm font-medium text-stone-900">
                        {compareFile ? compareFile.name : "Файл не выбран"}
                      </p>
                      <p className="mt-1 text-xs text-stone-500">
                        {compareFile
                          ? `${formatSize(compareFile.size)} · .${getFileExtension(compareFile.name) || "file"}`
                          : `Поддерживаются: ${tool.mvp.accepts.join(", ")}`}
                      </p>
                    </div>
                  </div>

                  <Button
                    type="button"
                    variant={state === "success" ? "secondary" : "primary"}
                    disabled={!file || !compareFile || state === "success"}
                    onClick={
                      state === "loading" ? handleAbortAnalysis : handleAnalyze
                    }
                    className={`w-full ${
                      state === "success"
                        ? "border border-amber-300/30 bg-amber-400/10 text-stone-900"
                        : "bg-[#ffd43b] text-stone-950 hover:bg-[#ffd43b]"
                    }`}
                  >
                    {state === "loading"
                      ? "Остановить сравнение"
                      : state === "success"
                        ? "Проанализировано"
                        : "Сравнить документы"}
                  </Button>
                  <div className="xl:justify-self-end">{costHint}</div>
                </div>
              </section>
            ) : (
              <section className="relative overflow-hidden rounded-[36px] border border-stone-300 bg-[radial-gradient(circle_at_top_left,_rgba(255,255,255,0.92),_rgba(246,240,229,0.96)_52%,_rgba(232,225,214,0.98))] p-5 shadow-[0_30px_120px_rgba(28,25,23,0.14)] sm:p-7">
                <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(120deg,rgba(24,24,27,0.03),transparent_28%,rgba(245,158,11,0.07)_72%,rgba(24,24,27,0.06))]" />
                <div className="pointer-events-none absolute -right-16 top-10 h-40 w-40 rounded-full bg-amber-200/20 blur-3xl" />
                <div className="pointer-events-none absolute bottom-0 left-1/3 h-px w-1/2 bg-gradient-to-r from-transparent via-stone-500/30 to-transparent" />

                <div className="relative grid gap-6 xl:grid-cols-[minmax(0,1.2fr)_420px]">
                  <div className="space-y-6">
                    <div className="flex flex-wrap items-center gap-3">
                      <span className="inline-flex items-center gap-2 rounded-full border border-stone-400/40 bg-white/75 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.28em] text-stone-700">
                        <GitCompareArrows className="h-3.5 w-3.5" />
                        Пространство сравнения
                      </span>
                      <span className="inline-flex items-center gap-2 rounded-full bg-stone-900 px-3 py-1 text-[11px] font-medium uppercase tracking-[0.24em] text-stone-100">
                        <Sparkles className="h-3.5 w-3.5" />
                        AI-сравнение
                      </span>
                    </div>

                    <div className="max-w-3xl">
                      <h2 className="max-w-2xl text-3xl font-semibold leading-[1.05] tracking-[-0.04em] text-stone-900 sm:text-5xl">
                        Сцена сравнения для двух версий одного смысла.
                      </h2>
                      <p className="mt-4 max-w-2xl text-sm leading-7 text-stone-700 sm:text-base">
                        Загружайте базовый документ и новую редакцию. Страница
                        соберет общее, выделит смысловые расхождения и покажет,
                        насколько оба файла действительно связаны между собой.
                      </p>
                    </div>

                    <div className="grid gap-4 md:grid-cols-3">
                      {[
                        [
                          "1",
                          "Загрузите пару",
                          "Поддерживаются PDF и DOCX, чтобы сравнивать версии договора, приложения или политики.",
                        ],
                        [
                          "2",
                          "Запустите анализ",
                          "Инструмент строит компактную карту совпадений, различий и общей связи между двумя документами.",
                        ],
                        [
                          "3",
                          "Заберите вывод",
                          "Результат сразу готов для просмотра и обсуждения.",
                        ],
                      ].map(([step, title, text]) => (
                        <div
                          key={step}
                          className="rounded-[28px] border border-stone-300/80 bg-white/70 p-4 backdrop-blur sm:p-5"
                        >
                          <div className="mb-4 inline-flex h-10 w-10 items-center justify-center rounded-full border border-stone-400/30 bg-stone-900 text-sm font-semibold text-stone-50">
                            {step}
                          </div>
                          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-stone-500">
                            {title}
                          </p>
                          <p className="mt-3 text-sm leading-6 text-stone-700">
                            {text}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="relative overflow-hidden rounded-[30px] border border-stone-700/80 bg-stone-950 p-4 text-stone-50 shadow-[0_30px_80px_rgba(28,25,23,0.32)] sm:p-5">
                    <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(245,158,11,0.2),transparent_42%)]" />
                    <div className="relative space-y-5">
                      <div className="flex items-start justify-between gap-3 border-b border-white/10 pb-4">
                        <div>
                          <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-amber-300/90">
                            Зона загрузки
                          </p>
                          <h3 className="mt-2 text-2xl font-semibold tracking-[-0.04em] text-white">
                            Загрузите две стороны сравнения
                          </h3>
                        </div>
                        <div className="rounded-2xl border border-white/10 bg-white/5 p-3 text-amber-300">
                          <ScanSearch className="h-6 w-6" />
                        </div>
                      </div>

                      <div className="grid gap-4">
                        <div className="space-y-2">
                          <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-stone-400">
                            Документ слева
                          </p>
                          <div className="rounded-[26px] border border-white/10 bg-white/[0.03] p-2">
                            <UploadDropzone
                              acceptedExtensions={tool.mvp.accepts}
                              file={file}
                              onFileChange={handleFileChange}
                              compact
                              showFileCard={false}
                              variant="comparison"
                              comparisonTone="left"
                            />
                          </div>
                        </div>

                        <div className="space-y-2">
                          <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-stone-400">
                            Документ справа
                          </p>
                          <div className="rounded-[26px] border border-white/10 bg-white/[0.03] p-2">
                            <UploadDropzone
                              acceptedExtensions={tool.mvp.accepts}
                              file={compareFile}
                              onFileChange={handleCompareFileChange}
                              compact
                              showFileCard={false}
                              variant="comparison"
                              comparisonTone="right"
                            />
                          </div>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-3 border-t border-white/10 pt-4 text-xs text-stone-300">
                        <div className="rounded-2xl bg-white/[0.04] p-3">
                          <p className="uppercase tracking-[0.2em] text-stone-500">
                            Форматы
                          </p>
                          <p className="mt-2 text-sm text-stone-100">
                            {tool.mvp.accepts.join(" / ").toUpperCase()}
                          </p>
                        </div>
                        <div className="rounded-2xl bg-white/[0.04] p-3">
                          <p className="uppercase tracking-[0.2em] text-stone-500">
                            Фокус
                          </p>
                          <p className="mt-2 text-sm text-stone-100">
                            Формулировки, сроки, обязательства
                          </p>
                        </div>
                      </div>

                      <div className="border-t border-white/10 pt-4">
                        <Button
                          type="button"
                          variant={
                            state === "success" ? "secondary" : "primary"
                          }
                          disabled={
                            !file || !compareFile || state === "success"
                          }
                          onClick={
                            state === "loading"
                              ? handleAbortAnalysis
                              : handleAnalyze
                          }
                          className={`w-full ${
                            state === "success"
                              ? "border border-amber-300/30 bg-amber-400/10 text-amber-100"
                              : "bg-[#ffd43b] text-stone-950 hover:bg-amber-300"
                          }`}
                        >
                          {state === "loading"
                            ? isDataExtractorPage
                              ? "Остановить сравнение"
                              : "Остановить анализ"
                            : state === "success"
                              ? "Проанализировано"
                              : "Сравнить документы"}
                        </Button>
                        <div className="mt-3 flex justify-center">
                          {darkCostHint}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </section>
            )
          ) : isLegalTextSimplifierPage && isSecureHeroLanding ? (
            <section className="relative overflow-hidden rounded-[34px] border border-stone-300 bg-[#f7f2e8] text-stone-950 shadow-[0_28px_90px_rgba(41,37,36,0.14)]">
              <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(135deg,rgba(255,255,255,0.9),rgba(255,255,255,0.28)_38%,rgba(245,158,11,0.12)_100%)]" />
              <div className="pointer-events-none absolute left-0 top-0 h-full w-px bg-gradient-to-b from-transparent via-stone-400/50 to-transparent" />
              <div className="relative grid gap-0 xl:grid-cols-[minmax(0,1fr)_430px]">
                <div className="px-5 py-6 sm:px-8 sm:py-8 lg:px-10">
                  <div className="flex flex-wrap items-center gap-3">
                    <span className="inline-flex items-center gap-2 rounded-full border border-stone-400/50 bg-white/70 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.24em] text-stone-700">
                      <Sparkles className="h-3.5 w-3.5 text-amber-700" />
                      Пересказ без потери смысла
                    </span>
                    <span className="inline-flex items-center gap-2 rounded-full bg-stone-950 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.22em] text-stone-100">
                      {toolCreditCost} кр / запуск
                    </span>
                  </div>

                  <div className="mt-8 grid gap-8 lg:grid-cols-[minmax(0,0.96fr)_minmax(320px,0.72fr)] lg:items-end">
                    <div>
                      <h2 className="max-w-3xl text-4xl font-semibold leading-[1.03] tracking-normal text-stone-950 sm:text-6xl">
                        Сложный юридический текст станет понятным рабочим
                        пересказом.
                      </h2>
                      <p className="mt-5 max-w-2xl text-base leading-7 text-stone-700">
                        Загрузите договор, претензию, регламент или судебный
                        фрагмент. Инструмент сохранит юридический смысл, но
                        уберет тяжелые обороты и покажет выводы языком, с
                        которым проще принимать решение.
                      </p>
                    </div>

                    <div className="rounded-[28px] border border-stone-300/90 bg-white/[0.78] p-4 shadow-[0_18px_50px_rgba(41,37,36,0.08)] backdrop-blur">
                      <div className="grid gap-3">
                        {[
                          [
                            "До",
                            "Стороны руководствуются положениями применимого законодательства при наступлении обстоятельств...",
                          ],
                          [
                            "После",
                            "Если возникнут эти обстоятельства, стороны действуют по закону и условиям документа.",
                          ],
                        ].map(([label, text]) => (
                          <div
                            key={label}
                            className="rounded-[22px] border border-stone-200 bg-stone-50 px-4 py-4"
                          >
                            <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-stone-500">
                              {label}
                            </p>
                            <p className="mt-2 text-sm leading-6 text-stone-800">
                              {text}
                            </p>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>

                  <div className="mt-7 grid gap-3 sm:grid-cols-3">
                    {[
                      [
                        "1",
                        "Загрузите документ",
                        `Поддерживаются: ${tool.mvp.accepts.join(", ")}.`,
                      ],
                      [
                        "2",
                        "Получите простой пересказ",
                        "Смысл, обязанности, сроки и важные оговорки остаются на месте.",
                      ],
                      [
                        "3",
                        "Проверьте выводы",
                        "Результат удобно читать самому или отправить коллеге без юридической перегрузки.",
                      ],
                    ].map(([step, title, text]) => (
                      <div
                        key={step}
                        className="rounded-[24px] border border-stone-300/80 bg-white/[0.64] p-4"
                      >
                        <div className="mb-4 flex h-9 w-9 items-center justify-center rounded-full bg-stone-950 text-sm font-semibold text-white">
                          {step}
                        </div>
                        <p className="text-sm font-semibold text-stone-950">
                          {title}
                        </p>
                        <p className="mt-2 text-sm leading-6 text-stone-600">
                          {text}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>

                <aside className="border-t border-stone-300 bg-stone-950 p-4 text-stone-50 sm:p-5 xl:border-l xl:border-t-0">
                  <div className="relative overflow-hidden rounded-[28px] border border-white/[0.12] bg-white/[0.04] p-4 shadow-[0_24px_70px_rgba(0,0,0,0.28)] sm:p-5">
                    <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(245,158,11,0.2),transparent_38%)]" />
                    <div className="relative space-y-5">
                      <div className="flex items-start justify-between gap-3 border-b border-white/10 pb-4">
                        <div>
                          <p className="text-[11px] font-semibold uppercase tracking-[0.26em] text-amber-300">
                            Файл для пересказа
                          </p>
                          <h3 className="mt-2 text-2xl font-semibold tracking-normal text-white">
                            Загрузите юридический текст
                          </h3>
                        </div>
                        <div className="rounded-2xl border border-white/10 bg-white/[0.07] p-3 text-amber-300">
                          <ScanSearch className="h-6 w-6" />
                        </div>
                      </div>

                      <div className="rounded-[26px] border border-white/10 bg-white/[0.03] p-2">
                        <UploadDropzone
                          acceptedExtensions={tool.mvp.accepts}
                          file={file}
                          onFileChange={handleFileChange}
                          compact
                          showFileCard={false}
                          surface="dark"
                        />
                      </div>

                      {file ? (
                        <button
                          type="button"
                          onClick={() => handleFileChange(null)}
                          className="flex w-full min-w-0 items-center gap-3 rounded-[22px] border border-amber-300/30 bg-amber-400/10 px-4 py-3 text-left transition hover:border-amber-300/55 hover:bg-amber-400/[0.14]"
                        >
                          <span className="rounded-2xl bg-amber-300/12 p-2 text-amber-200">
                            <FileText className="h-5 w-5" />
                          </span>
                          <span className="min-w-0">
                            <span className="block text-[11px] font-semibold uppercase tracking-[0.2em] text-amber-100/80">
                              Выбранный файл
                            </span>
                            <span className="block truncate text-sm font-semibold text-white">
                              {file.name}
                            </span>
                            <span className="block text-xs text-stone-400">{`${formatSize(file.size)} · .${getFileExtension(file.name) || "file"}`}</span>
                          </span>
                        </button>
                      ) : null}

                      <div className="grid grid-cols-2 gap-3 text-xs">
                        {[
                          {
                            title: "Обезличивание",
                            value: "Имена, контакты, реквизиты",
                            icon: UserRound,
                          },
                          {
                            title: "Шифрование",
                            value: "AES-GCM защита",
                            icon: ShieldCheck,
                          },
                        ].map((item) => (
                          <div
                            key={item.title}
                            className="rounded-[20px] border border-white/10 bg-white/[0.04] p-3"
                          >
                            <item.icon className="h-4 w-4 text-amber-300" />
                            <p className="mt-3 font-semibold text-stone-100">
                              {item.title}
                            </p>
                            <p className="mt-1 leading-5 text-stone-400">
                              {item.value}
                            </p>
                          </div>
                        ))}
                      </div>

                      <div className="border-t border-white/10 pt-4">
                        <Button
                          type="button"
                          variant="primary"
                          disabled={!file}
                          onClick={handleAnalyze}
                          className="w-full bg-[#ffd43b] text-stone-950 hover:bg-amber-300"
                        >
                          Запустить пересказ
                        </Button>
                        <div className="mt-3 flex justify-center">
                          {darkCostHint}
                        </div>
                      </div>
                    </div>
                  </div>
                </aside>
              </div>
            </section>
          ) : isSecureHeroLanding ? (
            <SecureUploadHero
              heading={
                SECURE_HERO_HEADINGS[tool.slug] ?? (
                  <>
                    Загрузите документ
                    <br />и запустите анализ
                  </>
                )
              }
              description="Файл обрабатывается в защищенном контуре: чувствительные данные могут быть обезличены перед анализом, а передача и хранение выполняются с шифрованием."
              acceptedExtensions={tool.mvp.accepts}
              file={file}
              onFileChange={handleFileChange}
              onAnalyze={handleAnalyze}
              analyzeDisabled={!file}
              securityChips={[
                {
                  title: "Обезличивание",
                  subtitle: "Персональные данные",
                  tooltip: ANONYMIZATION_TOOLTIP,
                  icon: UserRound,
                },
                {
                  title: "Шифрование",
                  subtitle: "AES-GCM защита",
                  tooltip: ENCRYPTION_TOOLTIP,
                  icon: ShieldCheck,
                },
              ]}
              infoCards={[
                {
                  title: "Форматы",
                  value: tool.mvp.accepts.join(" / ").toUpperCase(),
                },
                { title: "Обезличивание", value: "Имена, контакты, реквизиты" },
                {
                  title: "Шифрование",
                  value: "AES-GCM при передаче и хранении",
                },
                { title: "Стоимость", value: `${toolCreditCost} кр / запуск` },
              ]}
              costHint={darkCostHint}
            />
          ) : (
            <section className="rounded-3xl border border-gray-200 bg-white p-4 shadow-sm sm:p-5">
              <div className="mb-4">
                <div>
                  <div className="inline-flex items-center gap-2 rounded-full bg-amber-50 px-3 py-1 text-xs font-medium text-amber-700">
                    <Sparkles className="h-3.5 w-3.5" />
                    Быстрый старт
                  </div>
                  <h2 className="mt-3 text-lg font-semibold text-gray-900">
                    Загрузите файл и запустите анализ
                  </h2>
                  <p className="mt-1 text-sm text-gray-600">
                    Начните с документа. Остальные действия доступны в
                    компактной панели ниже.
                  </p>
                </div>
              </div>
              {isCompareTool ? (
                <div className="grid gap-4 lg:grid-cols-2">
                  <div className="space-y-2">
                    <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                      Документ слева
                    </p>
                    <UploadDropzone
                      acceptedExtensions={tool.mvp.accepts}
                      file={file}
                      onFileChange={handleFileChange}
                      compact
                      showFileCard={false}
                    />
                  </div>
                  <div className="space-y-2">
                    <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                      Документ справа
                    </p>
                    <UploadDropzone
                      acceptedExtensions={tool.mvp.accepts}
                      file={compareFile}
                      onFileChange={handleCompareFileChange}
                      compact
                      showFileCard={false}
                    />
                  </div>
                </div>
              ) : (
                <UploadDropzone
                  acceptedExtensions={tool.mvp.accepts}
                  file={file}
                  onFileChange={handleFileChange}
                  compact
                  showFileCard={false}
                />
              )}
            </section>
          ))}

        {!isDataExtractorPage && !isSecureHeroLanding && (
          <div className="sticky top-4 z-30">
            <div className="rounded-3xl border border-gray-200 bg-white/95 p-3 shadow-lg shadow-gray-200/60 backdrop-blur sm:p-4">
              <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_auto] xl:items-center">
                {isCompareTool ? (
                  <div className="grid min-w-0 gap-3 md:grid-cols-2">
                    {[
                      { title: "Документ слева", currentFile: file },
                      { title: "Документ справа", currentFile: compareFile },
                    ].map((item) => (
                      <div
                        key={item.title}
                        className="flex min-w-0 items-center gap-3 rounded-2xl border border-gray-200 bg-gray-50 px-3 py-3"
                      >
                        <div className="rounded-2xl bg-white p-2 text-gray-500">
                          <FileText className="h-5 w-5" />
                        </div>
                        <div className="min-w-0">
                          <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                            {item.title}
                          </p>
                          <p className="truncate text-sm font-medium text-gray-900">
                            {item.currentFile
                              ? item.currentFile.name
                              : "Файл не выбран"}
                          </p>
                          <p className="text-xs text-gray-500">
                            {item.currentFile
                              ? `${formatSize(item.currentFile.size)} · .${getFileExtension(item.currentFile.name) || "file"}`
                              : `Поддерживаются: ${tool.mvp.accepts.join(", ")}`}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="flex min-w-0 items-center gap-3">
                    <div className="rounded-2xl bg-gray-100 p-2 text-gray-500">
                      <FileText className="h-5 w-5" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                        {file ? "Выбранный файл" : "Готово к загрузке"}
                      </p>
                      <p className="truncate text-sm font-medium text-gray-900">
                        {file ? file.name : "Выберите документ для анализа"}
                      </p>
                      <p className="text-xs text-gray-500">
                        {file
                          ? `${formatSize(file.size)} · .${getFileExtension(file.name) || "file"}`
                          : `Поддерживаются: ${tool.mvp.accepts.join(", ")}`}
                      </p>
                    </div>
                  </div>
                )}

                <div className="space-y-3 xl:max-w-[760px] xl:justify-self-end">
                  <div className="flex flex-wrap items-center gap-3 xl:justify-end">
                    {isSpellingCheckerPage &&
                    state === "success" &&
                    spellingExportText.trim() ? (
                      <div className="relative" data-download-menu="true">
                        <Button
                          type="button"
                          variant="secondary"
                          onClick={() => setDownloadMenuOpen((prev) => !prev)}
                          className="shrink-0 whitespace-nowrap"
                        >
                          Скачать документ
                        </Button>
                        {downloadMenuOpen ? (
                          <div className="absolute right-0 top-[calc(100%+0.6rem)] z-20 min-w-[220px] rounded-2xl border border-gray-200 bg-white p-2 shadow-xl">
                            {(
                              [
                                "txt",
                                "pdf",
                                "doc",
                                "docx",
                                "md",
                                "odt",
                                "rtf",
                              ] as const
                            ).map((format) => (
                              <button
                                key={format}
                                type="button"
                                onClick={() => {
                                  setDownloadMenuOpen(false);
                                  void downloadDocumentFile(
                                    spellingExportText,
                                    format as DownloadDocumentFormat,
                                    "spelling-checker-proof",
                                  );
                                }}
                                className="w-full rounded-xl px-3 py-2 text-left text-sm text-gray-700 transition hover:bg-gray-100"
                              >
                                Скачать как {format.toUpperCase()}
                              </button>
                            ))}
                          </div>
                        ) : null}
                      </div>
                    ) : null}
                    <Button
                      type="button"
                      variant={
                        state === "success" && !hasEditorChanges
                          ? "secondary"
                          : "primary"
                      }
                      disabled={
                        !file ||
                        (isCompareTool && !compareFile) ||
                        (state === "success" && !hasEditorChanges)
                      }
                      onClick={
                        state === "loading"
                          ? handleAbortAnalysis
                          : handleAnalyze
                      }
                      className={`shrink-0 whitespace-nowrap ${
                        state === "success" && !hasEditorChanges
                          ? "min-w-[180px] border-amber-200 bg-amber-50 text-amber-700"
                          : "min-w-[220px]"
                      }`}
                    >
                      {state === "loading"
                        ? isDataExtractorPage
                          ? "Остановить сравнение"
                          : "Остановить анализ"
                        : state === "success" && hasEditorChanges
                          ? "Проанализировать еще раз"
                          : state === "success"
                            ? "Проанализировано"
                            : tool.slug === "data-extractor"
                              ? "Сравнить документы"
                              : "Запустить анализ"}
                    </Button>
                    {costHint}
                  </div>
                  {actionHint ? (
                    <p className="text-xs text-gray-500 xl:text-right">
                      {actionHint}
                    </p>
                  ) : null}
                </div>
              </div>
            </div>
          </div>
        )}

        {!isSecureHeroLanding && (
          <section>
            <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
              <div>
                <h2
                  className={`text-lg font-semibold ${isDataExtractorPage ? "tracking-[-0.03em] text-stone-900 sm:text-[1.75rem]" : "text-gray-900"}`}
                >
                  {isDataExtractorPage ? "Панель сравнения" : "Results"}
                </h2>
                {isDataExtractorPage ? (
                  <p className="mt-1 max-w-2xl text-sm leading-6 text-stone-600">
                    Общая картина, расхождения и итоговая оценка связи между
                    двумя документами собраны в одной ленте.
                  </p>
                ) : null}
              </div>
              {isDataExtractorPage ? (
                <div className="inline-flex items-center gap-2 rounded-full border border-stone-300 bg-stone-100/80 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.22em] text-stone-600">
                  <GitCompareArrows className="h-3.5 w-3.5" />
                  Сравнение документов
                </div>
              ) : null}
            </div>
            {tool.slug === "document-analyzer" &&
            (state === "success" || state === "loading") &&
            result ? (
              <div className="space-y-5">
                <div
                  className="inline-flex rounded-2xl border border-gray-200 bg-gray-100 p-1"
                  role="tablist"
                  aria-label="Режим результатов"
                >
                  <button
                    type="button"
                    role="tab"
                    aria-selected={documentTab === "summary"}
                    onClick={() => setDocumentTab("summary")}
                    className={`rounded-xl px-4 py-2 text-sm font-medium transition ${
                      documentTab === "summary"
                        ? "bg-white text-gray-900 shadow-sm"
                        : "text-gray-600 hover:text-gray-900"
                    }`}
                  >
                    Summary
                  </button>
                  <button
                    type="button"
                    role="tab"
                    aria-selected={documentTab === "advanced"}
                    onClick={() => setDocumentTab("advanced")}
                    className={`rounded-xl px-4 py-2 text-sm font-medium transition ${
                      documentTab === "advanced"
                        ? "bg-white text-gray-900 shadow-sm"
                        : "text-gray-600 hover:text-gray-900"
                    }`}
                  >
                    Advanced AI Editor
                  </button>
                </div>

                {documentTab === "summary" ? (
                  <ResultsPanel
                    status={state === "loading" ? "loading" : "success"}
                    result={result}
                    toolSlug={tool.slug}
                    errorMessage={errorMessage ?? undefined}
                    showUpgradeCta={showUpgradeCta}
                    stage={stage ?? undefined}
                    elapsedSec={elapsedSec}
                    documentView="summary"
                    onSpellingTextChange={
                      isSpellingCheckerPage ? setSpellingExportText : undefined
                    }
                  />
                ) : (
                  <AdvancedAiEditor
                    data={advancedEditorData}
                    isAnalyzing={state === "loading"}
                    onDocumentChange={handleAdvancedEditorDocumentChange}
                  />
                )}
              </div>
            ) : tool.slug === "document-analyzer" && state === "loading" ? (
              <PrepareEditorLoader />
            ) : (
              <ResultsPanel
                status={state === "idle" || state === "ready" ? "idle" : state}
                result={result ?? undefined}
                toolSlug={tool.slug}
                errorMessage={errorMessage ?? undefined}
                showUpgradeCta={showUpgradeCta}
                stage={stage ?? undefined}
                elapsedSec={elapsedSec}
                documentView={documentTab}
                onSpellingTextChange={
                  isSpellingCheckerPage ? setSpellingExportText : undefined
                }
              />
            )}
          </section>
        )}
      </div>
    </ToolShell>
  );
}
