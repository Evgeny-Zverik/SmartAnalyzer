"use client";

import { useRouter } from "next/navigation";
import { useState, useCallback, useEffect, useMemo, useRef } from "react";
import { notFound } from "next/navigation";
import { FileText, Sparkles } from "lucide-react";
import { getToolBySlug } from "@/lib/config/tools";
import {
  prepareDocumentAnalyzer,
  runToolAnalysis,
  streamDocumentAnalyzer,
  type AnalysisStage,
  type DocumentAnalyzerRunResponse,
  type EditedDocumentRequest,
} from "@/lib/api/tools";
import { parseApiError, isLimitReached, isUnauthorized } from "@/lib/api/errors";
import { logout } from "@/lib/api/auth";
import { uploadDocument } from "@/lib/api/documents";
import { ToolShell } from "@/components/tools/ToolShell";
import { UploadDropzone } from "@/components/tools/UploadDropzone";
import { ResultsPanel } from "@/components/tools/ResultsPanel";
import { AdvancedAiEditor } from "@/components/tools/AdvancedAiEditor";
import { CaseLawChatWorkspace } from "@/components/tools/CaseLawChatWorkspace";
import { DocumentWorkspace } from "@/components/tools/DocumentWorkspace";
import {
  getStoredLLMConfig,
  getLLMConfigForRequest,
  type LLMConfig,
} from "@/components/tools/LLMSettingsModal";
import { Button } from "@/components/ui/Button";
import { getFeatureModules } from "@/lib/api/settings";
import { getFeatureKeyForTool, isToolEnabled } from "@/lib/features/toolFeatureGate";

type ToolState = "idle" | "ready" | "loading" | "success" | "error";
type DocumentTab = "summary" | "advanced";

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function getHelpfulLlmMessage(parsed: { error: string; message: string; details: unknown }): string {
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
  annotations: DocumentAnalyzerRunResponse["result"]["advanced_editor"]["annotations"]
): Record<string, unknown> | null {
  if (!prev) return prev;
  const advanced = (prev.advanced_editor as {
    full_text: string;
    rich_content?: Record<string, unknown> | null;
    source_format?: string | null;
    annotations?: DocumentAnalyzerRunResponse["result"]["advanced_editor"]["annotations"];
  } | undefined) ?? { full_text: "", annotations: [] };

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
          <div className="relative h-12 w-12 rounded-2xl bg-emerald-100">
            <div className="absolute inset-2 rounded-full border-[3px] border-emerald-500 border-t-transparent animate-spin" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-gray-900">Подготавливаем AI-редактор</h3>
            <p className="mt-1 text-sm text-gray-600">
              Извлекаем текст и собираем документную поверхность перед полной AI-разметкой.
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

export default function ToolPage({ params }: { params: { slug: string } }) {
  const router = useRouter();
  const tool = getToolBySlug(params.slug);

  if (!tool) {
    notFound();
  }

  const [featureAccessReady, setFeatureAccessReady] = useState(() => getFeatureKeyForTool(tool.slug) === null);
  const [featureAllowed, setFeatureAllowed] = useState(true);

  const [state, setState] = useState<ToolState>("idle");
  const [file, setFile] = useState<File | null>(null);
  const [compareFile, setCompareFile] = useState<File | null>(null);
  const [result, setResult] = useState<Record<string, unknown> | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [showUpgradeCta, setShowUpgradeCta] = useState(false);
  const [llmConfig, setLlmConfig] = useState<LLMConfig | null>(null);
  const [stage, setStage] = useState<AnalysisStage | null>(null);
  const [elapsedSec, setElapsedSec] = useState(0);
  const [documentTab, setDocumentTab] = useState<DocumentTab>("summary");
  const [documentId, setDocumentId] = useState<number | null>(null);
  const [compareDocumentId, setCompareDocumentId] = useState<number | null>(null);
  const [editedDocument, setEditedDocument] = useState<EditedDocumentRequest | null>(null);
  const [hasEditorChanges, setHasEditorChanges] = useState(false);
  const isLlmConfigurableTool = tool.slug === "document-analyzer" || tool.slug === "data-extractor";
  const advancedEditorData = useMemo(
    () =>
      ((result?.advanced_editor as {
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
      }) ?? { full_text: "", annotations: [] }),
    [result?.advanced_editor]
  );
  const isIntroCollapsed = (!!file || !!compareFile) && (state === "loading" || state === "success" || state === "error");
  const isCompareTool = tool.slug === "data-extractor";
  const analysisAbortRef = useRef<AbortController | null>(null);
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

  useEffect(() => {
    setLlmConfig(getStoredLLMConfig());
  }, []);

  useEffect(() => {
    const featureKey = getFeatureKeyForTool(tool.slug);
    if (!featureKey) {
      setFeatureAllowed(true);
      setFeatureAccessReady(true);
      return;
    }

    let cancelled = false;
    getFeatureModules()
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
          logout();
          router.replace("/login");
          return;
        }
        setFeatureAllowed(true);
        setFeatureAccessReady(true);
      });

    return () => {
      cancelled = true;
    };
  }, [router, tool.slug]);

  const handleFileChange = useCallback((f: File | null) => {
    setFile(f);
    setState(f || compareFile ? "ready" : "idle");
    setResult(null);
    setErrorMessage(null);
    setDocumentTab("summary");
    setDocumentId(null);
    setCompareDocumentId(null);
    setEditedDocument(null);
    setHasEditorChanges(false);
  }, [compareFile]);

  const handleCompareFileChange = useCallback((f: File | null) => {
    setCompareFile(f);
    setState(file || f ? "ready" : "idle");
    setResult(null);
    setErrorMessage(null);
    setDocumentTab("summary");
    setCompareDocumentId(null);
  }, [file]);

  const handleAdvancedEditorDocumentChange = useCallback((payload: {
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
      const requestLlm = isLlmConfigurableTool ? getLLMConfigForRequest(llmConfig) : undefined;
      if (tool.slug === "document-analyzer") {
        let currentDocumentId = documentId;

        if (!currentDocumentId) {
          setStage("upload");
          const uploadRes = await uploadDocument(file, { signal: controller.signal });
          currentDocumentId = uploadRes.document_id;
          setDocumentId(currentDocumentId);

          setStage("analyze");
          const prepared = await prepareDocumentAnalyzer(currentDocumentId, controller.signal);
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
          requestLlm,
          controller.signal,
          hasEditorChanges ? editedDocument : null,
          (event) => {
            if (event.type === "progress") {
              setStage(event.stage);
              return;
            }
            if (event.type === "annotations_batch") {
              setStage("review");
              setResult((prev) => mergeStreamAnnotations(prev, event.annotations));
              return;
            }
            if (event.type === "final") {
              setStage("done");
              setResult(event.result as unknown as Record<string, unknown>);
              setDocumentTab("advanced");
              setHasEditorChanges(false);
              setState("success");
              return;
            }
            if (event.type === "error") {
              throw new Error(event.message || "Streaming analysis failed.");
            }
          }
        );
      } else if (tool.slug === "data-extractor") {
        let currentDocumentId = documentId;
        let currentCompareDocumentId = compareDocumentId;

        setStage("upload");
        if (!currentDocumentId) {
          const uploadRes = await uploadDocument(file, { signal: controller.signal });
          currentDocumentId = uploadRes.document_id;
          setDocumentId(currentDocumentId);
        }
        if (!currentCompareDocumentId && compareFile) {
          const uploadRes = await uploadDocument(compareFile, { signal: controller.signal });
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
          requestLlm,
          (s) => {
            setStage(s);
          },
          controller.signal,
          {
            existingDocumentId: currentDocumentId,
            compareDocumentId: currentCompareDocumentId,
          }
        );
        setResult(analysis.result as Record<string, unknown>);
        setState("success");
      } else {
        const analysis = await runToolAnalysis(
          tool.slug,
          file,
          requestLlm,
          (s) => {
            setStage(s);
          },
          controller.signal
        );
        setResult(analysis.result as Record<string, unknown>);
        if (analysis.documentId) {
          setDocumentId(analysis.documentId);
        }
        setState("success");
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
        router.replace("/login");
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
        if (tool.slug === "contract-checker") {
          message = message || "Cannot extract text from contract.";
        } else if (tool.slug === "data-extractor") {
          message = message || "Невозможно прочитать один из документов для сравнения.";
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
        } else if (tool.slug === "contract-checker") {
          message = message || "Contract analysis failed. Try again.";
        } else if (tool.slug === "data-extractor") {
          message = message || "Сравнение документов не удалось. Попробуйте еще раз.";
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
  }, [file, compareFile, isCompareTool, isLlmConfigurableTool, tool.slug, router, llmConfig, documentId, compareDocumentId, editedDocument, hasEditorChanges]);

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
          <p className="text-sm text-gray-500">Проверяем доступность инструмента...</p>
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
        {!isIntroCollapsed && (
          <section className="rounded-3xl border border-gray-200 bg-white p-4 shadow-sm sm:p-5">
            <div className="mb-4">
              <div>
                <div className="inline-flex items-center gap-2 rounded-full bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-700">
                  <Sparkles className="h-3.5 w-3.5" />
                  Быстрый старт
                </div>
                <h2 className="mt-3 text-lg font-semibold text-gray-900">Загрузите файл и запустите анализ</h2>
                <p className="mt-1 text-sm text-gray-600">
                  Начните с документа. Остальные действия доступны в компактной панели ниже.
                </p>
              </div>
            </div>
            {isCompareTool ? (
              <div className="grid gap-4 lg:grid-cols-2">
                <div className="space-y-2">
                  <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Документ слева</p>
                  <UploadDropzone
                    acceptedExtensions={tool.mvp.accepts}
                    file={file}
                    onFileChange={handleFileChange}
                    compact
                    showFileCard={false}
                  />
                </div>
                <div className="space-y-2">
                  <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Документ справа</p>
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
        )}

        <div className="sticky top-4 z-30">
          <div className="rounded-3xl border border-gray-200 bg-white/95 p-3 shadow-lg shadow-gray-200/60 backdrop-blur sm:p-4">
            <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_auto] xl:items-center">
              {isCompareTool ? (
                <div className="grid min-w-0 gap-3 md:grid-cols-2">
                  {[
                    { title: "Документ слева", currentFile: file },
                    { title: "Документ справа", currentFile: compareFile },
                  ].map((item) => (
                    <div key={item.title} className="flex min-w-0 items-center gap-3 rounded-2xl border border-gray-200 bg-gray-50 px-3 py-3">
                      <div className="rounded-2xl bg-white p-2 text-gray-500">
                        <FileText className="h-5 w-5" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">{item.title}</p>
                        <p className="truncate text-sm font-medium text-gray-900">
                          {item.currentFile ? item.currentFile.name : "Файл не выбран"}
                        </p>
                        <p className="text-xs text-gray-500">
                          {item.currentFile
                            ? `${formatSize(item.currentFile.size)} · ${tool.mvp.accepts.join(", ")}`
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
                        ? `${formatSize(file.size)} · ${tool.mvp.accepts.join(", ")}`
                        : `Поддерживаются: ${tool.mvp.accepts.join(", ")}`}
                    </p>
                  </div>
                </div>
              )}

              <div className="space-y-3 xl:max-w-[760px] xl:justify-self-end">
                <div className="flex flex-wrap items-center gap-3 xl:justify-end">
                  <Button
                    type="button"
                    variant={state === "success" && !hasEditorChanges ? "secondary" : "primary"}
                    disabled={(!file || (isCompareTool && !compareFile)) || (state === "success" && !hasEditorChanges)}
                    onClick={state === "loading" ? handleAbortAnalysis : handleAnalyze}
                    className={`shrink-0 whitespace-nowrap ${
                      state === "success" && !hasEditorChanges
                        ? "min-w-[180px] border-emerald-200 bg-emerald-50 text-emerald-700"
                        : "min-w-[220px]"
                    }`}
                  >
                    {state === "loading"
                      ? "Остановить анализ"
                      : state === "success" && hasEditorChanges
                        ? "Проанализировать еще раз"
                        : state === "success"
                        ? "Проанализировано"
                        : tool.slug === "data-extractor"
                        ? "Сравнить документы"
                        : "Запустить анализ"}
                  </Button>
                </div>
                {actionHint ? (
                  <p className="text-xs text-gray-500 xl:text-right">{actionHint}</p>
                ) : null}
              </div>
            </div>
          </div>
        </div>

        <section>
          <h2 className="mb-4 text-lg font-semibold text-gray-900">Results</h2>
          {tool.slug === "document-analyzer" && (state === "success" || state === "loading") && result ? (
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
            />
          )}
        </section>
      </div>
    </ToolShell>
  );
}
