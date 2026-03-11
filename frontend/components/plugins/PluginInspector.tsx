"use client";

import { Card } from "@/components/ui/Card";
import { SeverityBadge } from "@/components/tools/SeverityBadge";
import type { PluginFinding } from "@/lib/plugins/types";

type PluginInspectorProps = {
  finding?: PluginFinding | null;
};

export function PluginInspector({ finding }: PluginInspectorProps) {
  return (
    <Card className="h-full">
      <h3 className="text-sm font-semibold text-gray-900">Inspector</h3>
      {!finding ? (
        <p className="mt-3 text-sm text-gray-500">Выберите finding в панели модулей или внизу workspace.</p>
      ) : (
        <div className="mt-4 space-y-3">
          <div className="flex items-center gap-2">
            <p className="text-sm font-semibold text-gray-900">{finding.title}</p>
            {finding.severity ? <SeverityBadge severity={finding.severity} /> : null}
          </div>
          {finding.description ? <p className="text-sm text-gray-600">{finding.description}</p> : null}
          {finding.quote ? (
            <div className="rounded-2xl bg-gray-50 p-3 text-sm text-gray-700">{finding.quote}</div>
          ) : null}
          {finding.suggestion ? (
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Suggestion</p>
              <p className="mt-1 text-sm text-gray-700">{finding.suggestion}</p>
            </div>
          ) : null}
        </div>
      )}
    </Card>
  );
}
