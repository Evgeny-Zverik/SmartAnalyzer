"use client";

import { useState } from "react";
import { ChevronDown, Loader2, AlertCircle, CheckCircle2, Lock } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import type { PluginLifecycleState, WorkspacePluginItem } from "@/lib/plugins/types";

type PluginSidebarProps = {
  items: WorkspacePluginItem[];
  selectedPluginId?: string;
  runningPluginId?: string | null;
  onSelect: (pluginId: string) => void;
  onToggle: (pluginId: string, enabled: boolean) => void;
  onRun: (pluginId: string) => void;
};

function stateIcon(state: PluginLifecycleState, isRunning: boolean) {
  if (isRunning || state === "running" || state === "queued")
    return <Loader2 className="h-4 w-4 animate-spin text-blue-500" />;
  if (state === "completed")
    return <CheckCircle2 className="h-4 w-4 text-emerald-500" />;
  if (state === "failed")
    return <AlertCircle className="h-4 w-4 text-red-500" />;
  if (state === "locked")
    return <Lock className="h-4 w-4 text-gray-400" />;
  return null;
}

function stateLabel(state: PluginLifecycleState, isRunning: boolean): string | null {
  if (isRunning || state === "running") return "Анализ...";
  if (state === "queued") return "В очереди";
  if (state === "completed") return null;
  if (state === "failed") return "Ошибка";
  if (state === "locked") return "Pro";
  if (state === "partial") return "Частично";
  return null;
}

export function PluginSidebar({
  items,
  selectedPluginId,
  runningPluginId,
  onSelect,
  onToggle,
  onRun,
}: PluginSidebarProps) {
  const [expandedId, setExpandedId] = useState<string | null>(null);

  return (
    <aside className="space-y-2">
      <div className="rounded-2xl border border-gray-200 bg-white px-4 py-3 shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">
          Модули анализа
        </p>
      </div>

      {items.map((item) => {
        const pluginId = item.manifest.id;
        const isRunning = runningPluginId === pluginId || item.state === "running";
        const isExpanded = expandedId === pluginId;
        const isSelected = selectedPluginId === pluginId;
        const isLocked = item.state === "locked";
        const resultCount = item.latest_result?.findings?.length ?? 0;
        const summaryText = item.latest_result?.summary?.short_text;

        return (
          <div
            key={pluginId}
            className={`rounded-2xl border shadow-sm transition-colors ${
              isSelected
                ? "border-gray-900 bg-gray-50"
                : "border-gray-200 bg-white hover:border-gray-300"
            }`}
          >
            {/* Header — always visible */}
            <button
              type="button"
              className="flex w-full items-center gap-3 px-4 py-3 text-left"
              onClick={() => {
                setExpandedId(isExpanded ? null : pluginId);
                onSelect(pluginId);
              }}
            >
              <div className="flex min-w-0 flex-1 items-center gap-2">
                {stateIcon(item.state, isRunning)}
                <span className="truncate text-sm font-medium text-gray-900">
                  {item.manifest.name}
                </span>
                {resultCount > 0 && item.state === "completed" && (
                  <Badge className="bg-gray-100 text-gray-600">{resultCount}</Badge>
                )}
                {(() => {
                  const label = stateLabel(item.state, isRunning);
                  return label ? (
                    <span className="text-xs text-gray-400">{label}</span>
                  ) : null;
                })()}
              </div>

              {/* Toggle switch */}
              <button
                type="button"
                role="switch"
                aria-checked={item.enabled}
                disabled={isLocked}
                onClick={(e) => {
                  e.stopPropagation();
                  onToggle(pluginId, !item.enabled);
                }}
                className={`relative inline-flex h-5 w-9 flex-shrink-0 cursor-pointer items-center rounded-full transition-colors ${
                  isLocked
                    ? "cursor-not-allowed bg-gray-200"
                    : item.enabled
                      ? "bg-emerald-500"
                      : "bg-gray-300"
                }`}
              >
                <span
                  className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow transition-transform ${
                    item.enabled ? "translate-x-[18px]" : "translate-x-[3px]"
                  }`}
                />
              </button>

              <ChevronDown
                className={`h-4 w-4 flex-shrink-0 text-gray-400 transition-transform ${
                  isExpanded ? "rotate-180" : ""
                }`}
              />
            </button>

            {/* Expanded content */}
            {isExpanded && (
              <div className="border-t border-gray-100 px-4 pb-3 pt-2">
                <p className="text-xs text-gray-500">{item.manifest.description}</p>

                {summaryText && (
                  <p className="mt-2 text-xs font-medium text-gray-700">{summaryText}</p>
                )}

                {item.latest_result?.summary?.counters &&
                  item.latest_result.summary.counters.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {item.latest_result.summary.counters.map((c) => (
                        <Badge
                          key={c.key}
                          className="bg-gray-50 text-gray-600 ring-1 ring-gray-200"
                        >
                          {c.label}: {c.value}
                        </Badge>
                      ))}
                    </div>
                  )}

                <div className="mt-3 flex items-center gap-2">
                  <Badge className="bg-gray-50 text-gray-500 ring-1 ring-gray-200">
                    {item.manifest.required_plan}
                  </Badge>
                  {item.enabled && !isLocked && (
                    <button
                      type="button"
                      onClick={() => onRun(pluginId)}
                      disabled={isRunning}
                      className="ml-auto text-xs font-medium text-gray-500 hover:text-gray-900 disabled:opacity-40"
                    >
                      {isRunning ? "Запуск..." : "Перезапустить"}
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>
        );
      })}
    </aside>
  );
}
