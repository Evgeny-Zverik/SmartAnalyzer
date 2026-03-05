"use client";

import { useRouter } from "next/navigation";
import { useState, useCallback, useEffect } from "react";
import { notFound } from "next/navigation";
import { Settings } from "lucide-react";
import { getToolBySlug } from "@/lib/config/tools";
import { runToolAnalysis } from "@/lib/api/tools";
import { parseApiError, isLimitReached, isUnauthorized } from "@/lib/api/errors";
import { logout } from "@/lib/api/auth";
import { ToolShell } from "@/components/tools/ToolShell";
import { UploadDropzone } from "@/components/tools/UploadDropzone";
import { ResultsPanel } from "@/components/tools/ResultsPanel";
import { LLMSettingsModal, getStoredLLMConfig, getLLMConfigForRequest, type LLMConfig } from "@/components/tools/LLMSettingsModal";
import { Button } from "@/components/ui/Button";

type ToolState = "idle" | "ready" | "loading" | "success" | "error";

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

  useEffect(() => {
    setLlmConfig(getStoredLLMConfig());
  }, []);

  const handleFileChange = useCallback((f: File | null) => {
    setFile(f);
    setState(f ? "ready" : "idle");
    setResult(null);
    setErrorMessage(null);
  }, []);

  const handleAnalyze = useCallback(async () => {
    if (!file) return;
    setState("loading");
    setErrorMessage(null);
    setResult(null);
    setShowUpgradeCta(false);
    try {
      const requestLlm = tool.slug === "document-analyzer" ? getLLMConfigForRequest(llmConfig) : undefined;
      const data = await runToolAnalysis(tool.slug, file, requestLlm);
      setResult(data as Record<string, unknown>);
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
        message = message || "Cannot read text from document.";
      } else if (parsed.status === 500) {
        message = message || "Analysis failed. Try again.";
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

        <div className="flex items-center gap-3">
          {tool.slug === "document-analyzer" && (
            <button
              type="button"
              onClick={() => setLlmModalOpen(true)}
              className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-gray-300 bg-white text-gray-600 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2 disabled:opacity-50"
              title="Настройки LLM"
              aria-label="Настройки LLM"
            >
              <Settings className="h-5 w-5" />
            </button>
          )}
          <Button
            type="button"
            variant="primary"
            disabled={!file || state === "loading"}
            onClick={handleAnalyze}
          >
            {state === "loading" ? "Analyzing…" : "Analyze"}
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
          <ResultsPanel
            status={state === "idle" || state === "ready" ? "idle" : state}
            result={result ?? undefined}
            errorMessage={errorMessage ?? undefined}
            showUpgradeCta={showUpgradeCta}
          />
        </section>
      </div>
    </ToolShell>
  );
}
