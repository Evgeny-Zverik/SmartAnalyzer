"use client";

import { useState, useCallback } from "react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";

type JsonActionsProps = {
  data: Record<string, unknown>;
  filename?: string;
};

export function JsonActions({ data, filename = "data-extractor-result.json" }: JsonActionsProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(JSON.stringify(data, null, 2));
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  }, [data]);

  const handleDownload = useCallback(() => {
    const blob = new Blob([JSON.stringify(data, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  }, [data, filename]);

  return (
    <Card>
      <div className="flex flex-wrap items-center gap-2">
        <Button type="button" variant="secondary" onClick={handleCopy}>
          {copied ? "Скопировано" : "Copy JSON"}
        </Button>
        <Button type="button" variant="secondary" onClick={handleDownload}>
          Download JSON
        </Button>
      </div>
      <details className="mt-3">
        <summary className="cursor-pointer text-sm font-medium text-gray-700">
          Показать JSON
        </summary>
        <pre className="mt-2 max-h-64 overflow-auto rounded border border-gray-200 bg-gray-50 p-3 text-xs">
          {JSON.stringify(data, null, 2)}
        </pre>
      </details>
    </Card>
  );
}
