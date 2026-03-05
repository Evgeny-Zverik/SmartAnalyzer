"use client";

import { useState, useCallback } from "react";
import { notFound } from "next/navigation";
import { getToolBySlug } from "@/lib/config/tools";
import { runToolAnalysis } from "@/lib/api/tools";
import { ToolShell } from "@/components/tools/ToolShell";
import { UploadDropzone } from "@/components/tools/UploadDropzone";
import { ResultsPanel } from "@/components/tools/ResultsPanel";
import { Button } from "@/components/ui/Button";

type ToolState = "idle" | "ready" | "loading" | "success" | "error";

export default function ToolPage({ params }: { params: { slug: string } }) {
  const tool = getToolBySlug(params.slug);

  if (!tool) {
    notFound();
  }

  const [state, setState] = useState<ToolState>("idle");
  const [file, setFile] = useState<File | null>(null);
  const [result, setResult] = useState<Record<string, unknown> | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

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
    try {
      const data = await runToolAnalysis(tool.slug, file);
      setResult(data as Record<string, unknown>);
      setState("success");
    } catch (e) {
      setErrorMessage(e instanceof Error ? e.message : "Unknown error");
      setState("error");
    }
  }, [file, tool.slug]);

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
            outputLabels={tool.mvp.output}
          />
        </section>
      </div>
    </ToolShell>
  );
}
