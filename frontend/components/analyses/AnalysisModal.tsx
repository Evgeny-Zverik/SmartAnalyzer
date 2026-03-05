"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/Button";
import { AnalysisRenderer } from "@/components/analyses/AnalysisRenderer";
import { getAnalysis, type AnalysisDetail } from "@/lib/api/analyses";
import { downloadJson } from "@/lib/utils/downloadJson";

type AnalysisModalProps = {
  analysisId: number | null;
  onClose: () => void;
};

export function AnalysisModal({ analysisId, onClose }: AnalysisModalProps) {
  const [detail, setDetail] = useState<AnalysisDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (analysisId == null) {
      setDetail(null);
      setError(null);
      return;
    }
    setLoading(true);
    setError(null);
    getAnalysis(analysisId)
      .then(setDetail)
      .catch((e) => setError(e instanceof Error ? e.message : "Ошибка загрузки"))
      .finally(() => setLoading(false));
  }, [analysisId]);

  function handleDownload() {
    if (!detail) return;
    downloadJson(detail.result, `${detail.tool_slug}-${detail.analysis_id}.json`);
  }

  if (analysisId == null) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="analysis-modal-title"
      onClick={onClose}
    >
      <div
        className="max-h-[90vh] w-full max-w-2xl overflow-hidden rounded-lg bg-white shadow-xl flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-gray-200 px-4 py-3">
          <h2 id="analysis-modal-title" className="text-lg font-semibold text-gray-900">
            Результат анализа {detail ? `#${detail.analysis_id}` : ""}
          </h2>
          <div className="flex gap-2">
            {detail && (
              <Button variant="secondary" type="button" onClick={handleDownload}>
                Скачать JSON
              </Button>
            )}
            <Button variant="ghost" type="button" onClick={onClose}>
              Закрыть
            </Button>
          </div>
        </div>
        <div className="flex-1 overflow-y-auto p-4">
          {loading && <p className="text-gray-500">Загрузка…</p>}
          {error && <p className="text-red-600">{error}</p>}
          {detail && !loading && (
            <>
              <p className="mb-3 text-sm text-gray-500">
                {detail.document.filename} · {detail.tool_slug} · {new Date(detail.created_at).toLocaleString()}
              </p>
              <AnalysisRenderer toolSlug={detail.tool_slug} result={detail.result} />
            </>
          )}
        </div>
      </div>
    </div>
  );
}
