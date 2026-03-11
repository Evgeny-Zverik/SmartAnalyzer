"use client";

import Link from "next/link";
import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { getToolBySlug } from "@/lib/config/tools";
import { getAnalysis, type AnalysisListItem } from "@/lib/api/analyses";
import { downloadJson } from "@/lib/utils/downloadJson";

const LIMIT = 20;

type AnalysesTableProps = {
  items: AnalysisListItem[];
  total: number;
  offset: number;
  onView: (id: number) => void;
  onPageChange: (newOffset: number) => void;
};

function formatDate(iso: string) {
  return new Date(iso).toLocaleString();
}

export function AnalysesTable({
  items,
  total,
  offset,
  onView,
  onPageChange,
}: AnalysesTableProps) {
  const hasPrev = offset > 0;
  const hasNext = offset + items.length < total;
  const prevOffset = Math.max(0, offset - LIMIT);
  const nextOffset = offset + LIMIT;
  const [downloadingId, setDownloadingId] = useState<number | null>(null);

  function handleDownload(item: AnalysisListItem) {
    setDownloadingId(item.analysis_id);
    getAnalysis(item.analysis_id)
      .then((d) => downloadJson(d.result, `${d.tool_slug}-${d.analysis_id}.json`))
      .finally(() => setDownloadingId(null));
  }

  return (
    <div className="overflow-hidden rounded-lg border border-gray-200 bg-white">
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">
                Инструмент
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">
                Файл
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">
                Дата
              </th>
              <th className="px-4 py-3 text-right text-xs font-medium uppercase text-gray-500">
                Действия
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 bg-white">
            {items.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-4 py-8 text-center text-gray-500">
                  Нет анализов. Запустите инструмент со страницы инструмента.
                </td>
              </tr>
            ) : (
              items.map((item) => {
                const tool = getToolBySlug(item.tool_slug);
                return (
                  <tr key={item.analysis_id} className="hover:bg-gray-50">
                    <td className="whitespace-nowrap px-4 py-3 text-sm text-gray-900">
                      {tool?.title ?? item.tool_slug}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600">{item.filename}</td>
                    <td className="whitespace-nowrap px-4 py-3 text-sm text-gray-600">
                      {formatDate(item.created_at)}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-right text-sm">
                      <div className="flex justify-end gap-2">
                        <Button
                          variant="ghost"
                          type="button"
                          onClick={() => onView(item.analysis_id)}
                        >
                          Подробнее
                        </Button>
                        <Button
                          variant="ghost"
                          type="button"
                          disabled={downloadingId === item.analysis_id}
                          onClick={() => handleDownload(item)}
                        >
                          {downloadingId === item.analysis_id ? "…" : "Скачать JSON"}
                        </Button>
                        <Link href={`/tools/${item.tool_slug}`}>
                          <Button variant="secondary" type="button">
                            Открыть инструмент
                          </Button>
                        </Link>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
      {(hasPrev || hasNext) && (
        <div className="flex items-center justify-between border-t border-gray-200 px-4 py-3">
          <p className="text-sm text-gray-600">
            Показано {offset + 1}–{offset + items.length} из {total}
          </p>
          <div className="flex gap-2">
            <Button
              variant="secondary"
              type="button"
              disabled={!hasPrev}
              onClick={() => onPageChange(prevOffset)}
            >
              Назад
            </Button>
            <Button
              variant="secondary"
              type="button"
              disabled={!hasNext}
              onClick={() => onPageChange(nextOffset)}
            >
              Вперёд
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
