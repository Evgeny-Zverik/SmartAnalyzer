"use client";

import { Card } from "@/components/ui/Card";
import type { PluginFinding, PluginPanel } from "@/lib/plugins/types";

type PluginPanelsProps = {
  panels: PluginPanel[];
  findings: PluginFinding[];
  activeFindingId?: string;
  onSelectFinding: (finding: PluginFinding) => void;
};

export function PluginPanels({
  panels,
  findings,
  activeFindingId,
  onSelectFinding,
}: PluginPanelsProps) {
  return (
    <div className="grid gap-4 xl:grid-cols-[minmax(0,1.35fr)_340px]">
      <Card>
        <h3 className="text-sm font-semibold text-gray-900">Замечания</h3>
        <div className="mt-4 space-y-3">
          {findings.length === 0 ? (
            <p className="text-sm text-gray-500">Замечаний не найдено.</p>
          ) : (
            findings.map((finding) => (
              <button
                key={finding.id}
                type="button"
                onClick={() => onSelectFinding(finding)}
                className={`w-full rounded-2xl border p-4 text-left transition ${
                  activeFindingId === finding.id
                    ? "border-gray-900 bg-gray-900 text-white"
                    : "border-gray-200 bg-white hover:border-gray-300"
                }`}
              >
                <p className="text-sm font-semibold">{finding.title}</p>
                {finding.description ? (
                  <p
                    className={`mt-1 text-sm ${
                      activeFindingId === finding.id ? "text-white/75" : "text-gray-600"
                    }`}
                  >
                    {finding.description}
                  </p>
                ) : null}
              </button>
            ))
          )}
        </div>
      </Card>

      <div className="space-y-4">
        {panels.map((panel) => (
          <Card key={panel.id}>
            <h3 className="text-sm font-semibold text-gray-900">{panel.title}</h3>
            <pre className="mt-3 overflow-auto rounded-2xl bg-gray-50 p-3 text-xs text-gray-700">
              {JSON.stringify(panel.data, null, 2)}
            </pre>
          </Card>
        ))}
      </div>
    </div>
  );
}
