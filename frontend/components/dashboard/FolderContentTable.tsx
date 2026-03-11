"use client";

import Link from "next/link";
import { useState } from "react";
import { GripVertical, FileText, BarChart3 } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { getToolBySlug } from "@/lib/config/tools";
import { getAnalysis } from "@/lib/api/analyses";
import { downloadJson } from "@/lib/utils/downloadJson";
import type { FolderItem } from "@/lib/api/folders";

const MOVE_TYPE = "application/x-smartanalyzer-move";

type FolderContentTableProps = {
  items: FolderItem[];
  pagination: { page: number; page_size: number; total: number };
  userFolderIds: Set<number>;
  onPageChange: (page: number) => void;
  onRefresh: () => void;
  onViewAnalysis: (id: number) => void;
  onToast: (message: string, type: "success" | "error") => void;
};

function formatDate(iso: string) {
  return new Date(iso).toLocaleString();
}

function statusLabel(s: string) {
  const map: Record<string, string> = {
    uploaded: "Загружен",
    queued: "В очереди",
    processing: "Обработка",
    completed: "Готов",
    failed: "Ошибка",
  };
  return map[s] ?? s;
}

export function FolderContentTable({
  items,
  pagination,
  userFolderIds,
  onPageChange,
  onRefresh,
  onViewAnalysis,
  onToast,
}: FolderContentTableProps) {
  const [downloadingId, setDownloadingId] = useState<number | null>(null);

  function handleDragStart(e: React.DragEvent, item: FolderItem) {
    if (!userFolderIds.size) return;
    e.dataTransfer.setData(MOVE_TYPE, JSON.stringify({ type: item.entity_type, id: item.id }));
    e.dataTransfer.effectAllowed = "move";
  }

  async function handleDownloadAnalysis(analysisId: number) {
    setDownloadingId(analysisId);
    try {
      const d = await getAnalysis(analysisId);
      downloadJson(d.result, `${d.tool_slug}-${d.analysis_id}.json`);
    } finally {
      setDownloadingId(null);
    }
  }

  const { page, page_size, total } = pagination;
  const totalPages = Math.max(1, Math.ceil(total / page_size));
  const hasPrev = page > 1;
  const hasNext = page < totalPages;

  return (
    <div className="overflow-hidden rounded-lg border border-gray-200 bg-white">
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="w-8 px-2 py-3" aria-hidden />
              <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">
                Тип
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">
                Инструмент
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">
                Название
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">
                Дата
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">
                Статус
              </th>
              <th className="px-4 py-3 text-right text-xs font-medium uppercase text-gray-500">
                Действия
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 bg-white">
            {items.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-gray-500">
                  В папке пока ничего нет
                </td>
              </tr>
            ) : (
              items.map((item) => {
                const tool = item.tool_slug ? getToolBySlug(item.tool_slug) : null;
                const key = `${item.entity_type}-${item.id}`;

                return (
                  <tr
                    key={key}
                    className="hover:bg-gray-50"
                    draggable={userFolderIds.size > 0}
                    onDragStart={(e) => handleDragStart(e, item)}
                  >
                    <td className="w-8 px-2 py-3 text-gray-400">
                      {userFolderIds.size > 0 && (
                        <GripVertical className="h-4 w-4 cursor-grab" aria-hidden />
                      )}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-sm text-gray-600">
                      {item.entity_type === "document" ? (
                        <span className="inline-flex items-center gap-1">
                          <FileText className="h-4 w-4" />
                          Документ
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1">
                          <BarChart3 className="h-4 w-4" />
                          Анализ
                        </span>
                      )}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-sm text-gray-900">
                      {tool?.title ?? item.tool_slug ?? "—"}
                    </td>
                    <td className="max-w-xs truncate px-4 py-3 text-sm text-gray-900" title={item.title}>
                      {item.title}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-sm text-gray-600">
                      {formatDate(item.created_at)}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-sm text-gray-600">
                      {statusLabel(item.status)}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-right text-sm">
                      <div className="flex justify-end gap-2">
                        {item.entity_type === "document" && (
                          <Link href={`/tools/document-analyzer?document=${item.id}`}>
                            <Button variant="ghost" type="button">
                              Открыть инструмент
                            </Button>
                          </Link>
                        )}
                        {item.entity_type === "analysis" && (
                          <>
                            <Button
                              variant="ghost"
                              type="button"
                              disabled={downloadingId === item.id}
                              onClick={() => onViewAnalysis(item.id)}
                            >
                              Подробнее
                            </Button>
                            <Button
                              variant="ghost"
                              type="button"
                              disabled={downloadingId === item.id}
                              onClick={() => handleDownloadAnalysis(item.id)}
                            >
                              {downloadingId === item.id ? "…" : "Скачать JSON"}
                            </Button>
                            <Link href={`/tools/${item.tool_slug ?? "document-analyzer"}`}>
                              <Button variant="secondary" type="button">
                                Инструмент
                              </Button>
                            </Link>
                          </>
                        )}
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
            {total === 0
              ? "0 элементов"
              : `Показано ${(page - 1) * page_size + 1}–${Math.min(page * page_size, total)} из ${total}`}
          </p>
          <div className="flex gap-2">
            <Button
              variant="secondary"
              type="button"
              disabled={!hasPrev}
              onClick={() => onPageChange(page - 1)}
            >
              Назад
            </Button>
            <Button
              variant="secondary"
              type="button"
              disabled={!hasNext}
              onClick={() => onPageChange(page + 1)}
            >
              Вперёд
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
