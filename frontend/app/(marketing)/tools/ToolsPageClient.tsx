"use client";

import { useEffect, useMemo, useState } from "react";
import { tools } from "@/lib/config/tools";
import { ToolCard } from "@/components/tools/ToolCard";
import { getEnabledToolSlugs } from "@/lib/features/toolFeatureGate";

export function ToolsPageClient() {
  const [enabledToolSlugs, setEnabledToolSlugs] = useState<Set<string> | null>(null);

  useEffect(() => {
    let cancelled = false;
    getEnabledToolSlugs(tools.map((tool) => tool.slug))
      .then((enabled) => {
        if (!cancelled) {
          setEnabledToolSlugs(enabled);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setEnabledToolSlugs(new Set(tools.map((tool) => tool.slug)));
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
        : tools.filter((tool) => tool.slug !== "handwriting-recognition"),
    [enabledToolSlugs]
  );

  return (
    <>
      <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {visibleTools.map((tool) => (
          <ToolCard key={tool.slug} tool={tool} />
        ))}
      </div>
    </>
  );
}
