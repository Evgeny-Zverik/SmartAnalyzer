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

function statusClass(s: string) {
  const map: Record<string, string> = {
    uploaded: "border-amber-200 bg-[#fff7cc] text-amber-700",
    queued: "border-amber-200 bg-amber-50 text-amber-700",
    processing: "border-stone-200 bg-stone-50 text-stone-700",
    completed: "border-teal-200 bg-teal-50 text-teal-700",
    failed: "border-rose-200 bg-rose-50 text-rose-700",
  };
  return map[s] ?? "border-zinc-200 bg-zinc-50 text-zinc-700";
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
    <div className="overflow-hidden rounded-[26px] border border-zinc-200/90 bg-white shadow-[0_18px_60px_rgba(10,16,30,0.08)]">
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-zinc-100">
          <thead className="bg-[linear-gradient(180deg,#fafaf9,#f5f5f4)]">
            <tr>
              <th className="w-8 px-2 py-3" aria-hidden />
              <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-[0.2em] text-zinc-500">
                Тип
              </th>
              <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-[0.2em] text-zinc-500">
                Инструмент
              </th>
              <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-[0.2em] text-zinc-500">
                Название
              </th>
              <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-[0.2em] text-zinc-500">
                Дата
              </th>
              <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-[0.2em] text-zinc-500">
                Статус
              </th>
              <th className="px-4 py-3 text-right text-[11px] font-semibold uppercase tracking-[0.2em] text-zinc-500">
                Действия
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100 bg-white">
            {items.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 py-10 text-center text-zinc-500">
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
                    className="transition hover:bg-zinc-50/70"
                    draggable={userFolderIds.size > 0}
                    onDragStart={(e) => handleDragStart(e, item)}
                  >
                    <td className="w-8 px-2 py-3 text-zinc-400">
                      {userFolderIds.size > 0 && (
                        <GripVertical className="h-4 w-4 cursor-grab" aria-hidden />
                      )}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-sm text-zinc-700">
                      {item.entity_type === "document" ? (
                        <span className="inline-flex items-center gap-1.5 rounded-full border border-zinc-200 bg-zinc-50 px-2.5 py-1 text-xs font-medium uppercase tracking-[0.12em] text-zinc-600">
                          <FileText className="h-4 w-4" />
                          Документ
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 rounded-full border border-zinc-200 bg-zinc-50 px-2.5 py-1 text-xs font-medium uppercase tracking-[0.12em] text-zinc-600">
                          <BarChart3 className="h-4 w-4" />
                          Анализ
                        </span>
                      )}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-sm font-medium text-zinc-900">
                      {tool?.title ?? item.tool_slug ?? "—"}
                    </td>
                    <td className="max-w-xs truncate px-4 py-3 text-sm text-zinc-800" title={item.title}>
                      {item.title}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-sm text-zinc-600">
                      {formatDate(item.created_at)}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-sm text-zinc-600">
                      <span
                        className={`inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-semibold uppercase tracking-[0.1em] ${statusClass(item.status)}`}
                      >
                        {statusLabel(item.status)}
                      </span>
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
        <div className="flex items-center justify-between border-t border-zinc-100 bg-zinc-50/70 px-4 py-3">
          <p className="text-sm text-zinc-600">
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
