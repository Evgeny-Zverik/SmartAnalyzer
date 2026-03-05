"use client";

import { useState, useMemo } from "react";
import { Search, RotateCcw } from "lucide-react";
import { tools } from "@/lib/config/tools";
import {
  ToolFilters,
  filterTools,
  ALL_CATEGORY,
} from "@/components/tools/ToolFilters";
import { ToolCard } from "@/components/tools/ToolCard";
import { Button } from "@/components/ui/Button";

export function ToolsPageClient() {
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState(ALL_CATEGORY);

  const filteredTools = useMemo(
    () => filterTools(tools, search, category),
    [search, category]
  );

  const handleReset = () => {
    setSearch("");
    setCategory(ALL_CATEGORY);
  };

  return (
    <>
      <div className="mt-8">
        <ToolFilters
          search={search}
          category={category}
          onSearchChange={setSearch}
          onCategoryChange={setCategory}
        />
      </div>

      {filteredTools.length > 0 ? (
        <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {filteredTools.map((tool) => (
            <ToolCard key={tool.slug} tool={tool} />
          ))}
        </div>
      ) : (
        <div className="mt-12 flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-gray-200 bg-gray-50 py-16 text-center">
          <Search className="h-12 w-12 text-gray-400" aria-hidden />
          <p className="mt-4 text-lg font-medium text-gray-700">
            No tools found
          </p>
          <p className="mt-1 text-sm text-gray-500">
            Try changing search or category filter
          </p>
          <Button
            variant="secondary"
            className="mt-6"
            onClick={handleReset}
            type="button"
          >
            <RotateCcw className="mr-2 inline h-4 w-4" aria-hidden />
            Reset filters
          </Button>
        </div>
      )}
    </>
  );
}
