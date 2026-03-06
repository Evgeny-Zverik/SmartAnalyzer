"use client";

import { useRouter } from "next/navigation";
import { useState, useCallback, useEffect, useRef } from "react";
import { notFound } from "next/navigation";
import { FileText, Settings, Sparkles } from "lucide-react";
import { getToolBySlug } from "@/lib/config/tools";
import { runToolAnalysis, type AnalysisStage } from "@/lib/api/tools";
import { parseApiError, isLimitReached, isUnauthorized } from "@/lib/api/errors";
import { logout } from "@/lib/api/auth";
import { ToolShell } from "@/components/tools/ToolShell";
import { UploadDropzone } from "@/components/tools/UploadDropzone";
import { ResultsPanel } from "@/components/tools/ResultsPanel";
import { AdvancedAiEditor } from "@/components/tools/AdvancedAiEditor";
import {
  LLMSettingsModal,
  getStoredLLMConfig,
  getStoredLLMConfigForMode,
  getLLMConfigForRequest,
  type LLMConfig,
} from "@/components/tools/LLMSettingsModal";
import { Button } from "@/components/ui/Button";

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

export default function ToolPage({ params }: { params: { slug: string } }) {
  const router = useRouter();
  const tool = getToolBySlug(params.slug);

  if (!tool) {
    notFound();
  }

  const [state, setState] = useState<ToolState>("idle");
  const [file, setFile] = useState<File | null>(null);
  const [result, setResult] = useState<Record<string, unknown> | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [showUpgradeCta, setShowUpgradeCta] = useState(false);
  const [llmConfig, setLlmConfig] = useState<LLMConfig | null>(null);
  const [llmModalOpen, setLlmModalOpen] = useState(false);
  const [stage, setStage] = useState<AnalysisStage | null>(null);
  const [elapsedSec, setElapsedSec] = useState(0);
  const [documentTab, setDocumentTab] = useState<DocumentTab>("summary");
  const isIntroCollapsed = !!file && (state === "loading" || state === "success" || state === "error");
  const analysisAbortRef = useRef<AbortController | null>(null);
  const actionHint = file
    ? state === "loading"
      ? "Идет анализ документа. Можно остановить процесс в любой момент."
      : state === "success"
        ? ""
        : "Панель закреплена, чтобы можно было быстро запустить анализ при скролле."
    : "Сначала загрузите файл. После выбора документа панель превратится в рабочую строку.";

  useEffect(() => {
    setLlmConfig(getStoredLLMConfig());
  }, []);

  const currentMode = llmConfig?.mode ?? "local";
  const setLlmMode = useCallback((mode: "local" | "api") => {
    setLlmConfig(getStoredLLMConfigForMode(mode));
  }, []);

  const handleFileChange = useCallback((f: File | null) => {
    setFile(f);
    setState(f ? "ready" : "idle");
    setResult(null);
    setErrorMessage(null);
    setDocumentTab("summary");
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
      const requestLlm = tool.slug === "document-analyzer" ? getLLMConfigForRequest(llmConfig) : undefined;
      const data = await runToolAnalysis(tool.slug, file, requestLlm, (s) => {
        setStage(s);
      }, controller.signal);
      setResult(data as Record<string, unknown>);
      if (tool.slug === "document-analyzer") {
        setDocumentTab("advanced");
      }
      setState("success");
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
          message = message || "Cannot read text from document or unsupported format.";
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
          message = message || "Data extraction failed. Try again.";
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
  }, [file, tool.slug, router, llmConfig]);

  const handleAbortAnalysis = useCallback(() => {
    analysisAbortRef.current?.abort();
    analysisAbortRef.current = null;
  }, []);

  useEffect(() => {
    return () => {
      analysisAbortRef.current?.abort();
    };
  }, []);

  return (
    <ToolShell
      tool={tool}
      metaAction={
        file ? (
          <Button
            type="button"
            variant="secondary"
            onClick={() => {
              if (state === "loading") {
                handleAbortAnalysis();
              }
              handleFileChange(null);
            }}
            className="whitespace-nowrap"
          >
            Сменить файл
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
            <UploadDropzone
              acceptedExtensions={tool.mvp.accepts}
              file={file}
              onFileChange={handleFileChange}
              compact
              showFileCard={false}
            />
          </section>
        )}

        <div className="sticky top-4 z-30">
          <div className="rounded-3xl border border-gray-200 bg-white/95 p-3 shadow-lg shadow-gray-200/60 backdrop-blur sm:p-4">
            <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_auto] xl:items-center">
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

              <div className="space-y-3 xl:max-w-[760px] xl:justify-self-end">
                <div className="flex flex-wrap items-center gap-3 xl:justify-end">
                  {tool.slug === "document-analyzer" && (
                    <div className="flex flex-wrap items-center gap-3">
                      <div
                        className="flex shrink-0 rounded-xl border border-gray-300 bg-gray-100 p-0.5"
                        role="group"
                        aria-label="Режим LLM"
                      >
                        <button
                          type="button"
                          onClick={() => setLlmMode("local")}
                          className={`rounded-lg px-3 py-2 text-sm font-medium whitespace-nowrap transition ${
                            currentMode === "local"
                              ? "bg-white text-gray-900 shadow-sm"
                              : "text-gray-600 hover:text-gray-900"
                          }`}
                        >
                          Свой сервер
                        </button>
                        <button
                          type="button"
                          onClick={() => setLlmMode("api")}
                          className={`rounded-lg px-3 py-2 text-sm font-medium whitespace-nowrap transition ${
                            currentMode === "api"
                              ? "bg-white text-gray-900 shadow-sm"
                              : "text-gray-600 hover:text-gray-900"
                          }`}
                        >
                          API
                        </button>
                      </div>
                      <button
                        type="button"
                        onClick={() => setLlmModalOpen(true)}
                        className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-gray-300 bg-white text-gray-600 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2 disabled:opacity-50"
                        title="Настройки LLM"
                        aria-label="Настройки LLM"
                      >
                        <Settings className="h-5 w-5" />
                      </button>
                    </div>
                  )}
                  <Button
                    type="button"
                    variant={state === "success" ? "secondary" : "primary"}
                    disabled={!file || state === "success"}
                    onClick={state === "loading" ? handleAbortAnalysis : handleAnalyze}
                    className={`shrink-0 whitespace-nowrap ${
                      state === "success"
                        ? "min-w-[180px] border-emerald-200 bg-emerald-50 text-emerald-700"
                        : "min-w-[220px]"
                    }`}
                  >
                    {state === "loading"
                      ? "Остановить анализ"
                      : state === "success"
                        ? "Проанализировано"
                        : tool.slug === "data-extractor"
                        ? "Запустить извлечение"
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
        {tool.slug === "document-analyzer" && (
          <LLMSettingsModal
            isOpen={llmModalOpen}
            onClose={() => setLlmModalOpen(false)}
            initialConfig={llmConfig}
            onSave={setLlmConfig}
          />
        )}

        <section>
          <h2 className="mb-4 text-lg font-semibold text-gray-900">Results</h2>
          {tool.slug === "document-analyzer" && state === "success" && result ? (
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
                  status="success"
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
                  data={
                    (result.advanced_editor as {
                      full_text: string;
                      annotations: Array<{
                        id: string;
                        type: "risk" | "improvement";
                        severity: "low" | "medium" | "high";
                        start_offset: number;
                        end_offset: number;
                        title: string;
                        reason: string;
                        suggested_rewrite: string;
                      }>;
                    }) ?? { full_text: "", annotations: [] }
                  }
                />
              )}
            </div>
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
