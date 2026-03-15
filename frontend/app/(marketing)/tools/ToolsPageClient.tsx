"use client";

import { useMemo } from "react";
import { tools } from "@/lib/config/tools";
import { ToolCard } from "@/components/tools/ToolCard";

export function ToolsPageClient() {
  const visibleTools = useMemo(() => tools, []);

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
