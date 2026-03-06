"use client";

import { useRouter } from "next/navigation";
import { useState, useCallback, useEffect } from "react";
import { notFound } from "next/navigation";
import { Settings } from "lucide-react";
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
      });
      setResult(data as Record<string, unknown>);
      if (tool.slug === "document-analyzer") {
        setDocumentTab("advanced");
      }
      setState("success");
    } catch (e) {
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
    }
  }, [file, tool.slug, router, llmConfig]);

  return (
    <ToolShell tool={tool}>
      <div className="space-y-8">
        <section>
          <h2 className="mb-4 text-lg font-semibold text-gray-900">Upload</h2>
          <UploadDropzone
            acceptedExtensions={tool.mvp.accepts}
            file={file}
            onFileChange={handleFileChange}
          />
        </section>

        <div className="flex flex-wrap items-center gap-3">
          {tool.slug === "document-analyzer" && (
            <>
              <div
                className="flex rounded-lg border border-gray-300 bg-gray-100 p-0.5"
                role="group"
                aria-label="Режим LLM"
              >
                <button
                  type="button"
                  onClick={() => setLlmMode("local")}
                  className={`rounded-md px-3 py-2 text-sm font-medium transition ${
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
                  className={`rounded-md px-3 py-2 text-sm font-medium transition ${
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
                className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-gray-300 bg-white text-gray-600 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2 disabled:opacity-50"
                title="Настройки LLM"
                aria-label="Настройки LLM"
              >
                <Settings className="h-5 w-5" />
              </button>
            </>
          )}
          <Button
            type="button"
            variant="primary"
            disabled={!file || state === "loading"}
            onClick={handleAnalyze}
          >
            {state === "loading"
              ? tool.slug === "data-extractor"
                ? "Extracting…"
                : "Analyzing…"
              : tool.slug === "data-extractor"
                ? "Extract"
                : "Analyze"}
          </Button>
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
