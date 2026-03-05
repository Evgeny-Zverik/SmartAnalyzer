"use client";

import { useRouter } from "next/navigation";
import { useState, useCallback } from "react";
import { notFound } from "next/navigation";
import { getToolBySlug } from "@/lib/config/tools";
import { runToolAnalysis } from "@/lib/api/tools";
import { parseApiError, isLimitReached, isUnauthorized } from "@/lib/api/errors";
import { logout } from "@/lib/api/auth";
import { ToolShell } from "@/components/tools/ToolShell";
import { UploadDropzone } from "@/components/tools/UploadDropzone";
import { ResultsPanel } from "@/components/tools/ResultsPanel";
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
      const data = await runToolAnalysis(tool.slug, file);
      setResult(data as Record<string, unknown>);
      setState("success");
    } catch (e) {
      if (isUnauthorized(e)) {
        logout();
        router.replace("/login");
        return;
      }
      const parsed = parseApiError(e);
      setErrorMessage(parsed.message);
      setShowUpgradeCta(isLimitReached(e));
      setState("error");
    }
  }, [file, tool.slug, router]);

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

        <div className="flex items-center gap-4">
          <Button
            type="button"
            variant="primary"
            disabled={!file || state === "loading"}
            onClick={handleAnalyze}
          >
            {state === "loading" ? "Analyzing…" : "Analyze"}
          </Button>
        </div>

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
