"use client";

import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import type { PluginLifecycleState, WorkspacePluginItem } from "@/lib/plugins/types";

const STATE_LABELS: Record<PluginLifecycleState, string> = {
  registered: "registered",
  compatible: "available",
  enabled: "enabled",
  queued: "queued",
  running: "running",
  completed: "completed",
  partial: "partial",
  failed: "failed",
  disabled: "disabled",
  locked: "locked",
};

type PluginSidebarProps = {
  items: WorkspacePluginItem[];
  selectedPluginId?: string;
  runningPluginId?: string | null;
  onSelect: (pluginId: string) => void;
  onToggle: (pluginId: string, enabled: boolean) => void;
  onRun: (pluginId: string) => void;
};

export function PluginSidebar({
  items,
  selectedPluginId,
  runningPluginId,
  onSelect,
  onToggle,
  onRun,
}: PluginSidebarProps) {
  return (
    <aside className="space-y-3">
      <div className="rounded-3xl border border-gray-200 bg-white p-4 shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">
          Подключенные модули
        </p>
        <p className="mt-2 text-sm text-gray-600">
          Каждый модуль запускается независимо и пишет результат в общий workspace.
        </p>
      </div>

      {items.map((item) => {
        const resultCount = item.latest_result?.findings?.length ?? 0;
        const isRunning = runningPluginId === item.manifest.id || item.state === "running";
        return (
          <div
            key={item.manifest.id}
            onClick={() => onSelect(item.manifest.id)}
            className={`w-full rounded-3xl border p-4 text-left shadow-sm transition ${
              selectedPluginId === item.manifest.id
                ? "border-gray-900 bg-gray-900 text-white"
                : "border-gray-200 bg-white hover:border-gray-300"
            }`}
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-sm font-semibold">{item.manifest.name}</p>
                <p
                  className={`mt-1 text-xs ${
                    selectedPluginId === item.manifest.id ? "text-white/70" : "text-gray-500"
                  }`}
                >
                  {item.latest_result?.summary?.short_text || item.manifest.description}
                </p>
              </div>
              <Badge
                className={
                  selectedPluginId === item.manifest.id
                    ? "border-white/20 bg-white/10 text-white"
                    : undefined
                }
              >
                {STATE_LABELS[item.state]}
              </Badge>
            </div>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <Badge
                className={
                  selectedPluginId === item.manifest.id
                    ? "border-white/20 bg-white/10 text-white"
                    : "bg-gray-50 text-gray-700 ring-1 ring-gray-200"
                }
              >
                {resultCount} findings
              </Badge>
              <Badge
                className={
                  selectedPluginId === item.manifest.id
                    ? "border-white/20 bg-white/10 text-white"
                    : "bg-gray-50 text-gray-700 ring-1 ring-gray-200"
                }
              >
                {item.manifest.required_plan}
              </Badge>
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              <Button
                type="button"
                variant={item.enabled ? "secondary" : "ghost"}
                onClick={() => onToggle(item.manifest.id, !item.enabled)}
                disabled={item.state === "locked"}
                className="min-w-[112px]"
              >
                {item.enabled ? "Disable" : "Enable"}
              </Button>
              <Button
                type="button"
                onClick={() => onRun(item.manifest.id)}
                disabled={!item.enabled || item.state === "locked" || isRunning}
                className="min-w-[112px]"
              >
                {isRunning ? "Running..." : "Run"}
              </Button>
            </div>
          </div>
        );
      })}
    </aside>
  );
}
