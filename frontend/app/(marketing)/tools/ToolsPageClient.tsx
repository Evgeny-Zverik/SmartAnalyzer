"use client";

import { useEffect, useMemo, useState } from "react";
import { tools } from "@/lib/config/tools";
import { ToolCard } from "@/components/tools/ToolCard";
import { getEnabledToolSlugs } from "@/lib/features/toolFeatureGate";

export function ToolsPageClient() {
  const [enabledToolSlugs, setEnabledToolSlugs] = useState<Set<string> | null>(null);

  useEffect(() => {
    let cancelled = false;
    setEnabledToolSlugs(new Set());
    getEnabledToolSlugs(tools.map((tool) => tool.slug))
      .then((enabled) => {
        if (!cancelled) {
          setEnabledToolSlugs(enabled);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setEnabledToolSlugs(new Set());
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const visibleTools = useMemo(
    () =>
      enabledToolSlugs
        ? tools.filter((tool) => enabledToolSlugs.has(tool.slug))
        : [],
    [enabledToolSlugs]
  );

  return (
    <section className="mt-10">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm font-medium text-stone-600">
          Доступно инструментов: <span className="font-semibold text-stone-900">{visibleTools.length}</span>
        </p>
        <div className="flex flex-wrap items-center gap-2">
          {["Документы", "Риски", "Данные"].map((item) => (
            <span
              key={item}
              className="inline-flex items-center rounded-full border border-stone-300 bg-white/80 px-3 py-1 text-xs font-medium text-stone-600"
            >
              {item}
            </span>
          ))}
        </div>
      </div>

      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {visibleTools.map((tool) => (
          <ToolCard key={tool.slug} tool={tool} />
        ))}
      </div>
    </section>
  );
}
