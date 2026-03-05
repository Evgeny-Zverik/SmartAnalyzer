"use client";

import type { Tool, ToolCategory } from "@/lib/config/tools";
import { CATEGORIES } from "@/lib/config/tools";

export const ALL_CATEGORY = "All";

type ToolFiltersProps = {
  search: string;
  category: string;
  onSearchChange: (value: string) => void;
  onCategoryChange: (value: string) => void;
};

export function ToolFilters({
  search,
  category,
  onSearchChange,
  onCategoryChange,
}: ToolFiltersProps) {
  const chips = [ALL_CATEGORY, ...CATEGORIES];

  return (
    <div className="space-y-4">
      <input
        type="search"
        placeholder="Search tools..."
        value={search}
        onChange={(e) => onSearchChange(e.target.value)}
        className="w-full max-w-md rounded-lg border border-gray-300 px-4 py-2.5 text-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
        aria-label="Search tools"
      />
      <div className="flex flex-wrap gap-2">
        {chips.map((chip) => (
          <button
            key={chip}
            type="button"
            onClick={() => onCategoryChange(chip)}
            className={`rounded-full px-4 py-2 text-sm font-medium transition focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2 ${
              category === chip
                ? "bg-emerald-600 text-white hover:bg-emerald-700"
                : "bg-gray-100 text-gray-700 hover:bg-gray-200"
            }`}
          >
            {chip}
          </button>
        ))}
      </div>
    </div>
  );
}

export function filterTools(
  tools: Tool[],
  search: string,
  category: string
): Tool[] {
  const q = search.trim().toLowerCase();
  const byCategory =
    category === ALL_CATEGORY
      ? tools
      : tools.filter((t) => t.category === (category as ToolCategory));
  return q
    ? byCategory.filter(
        (t) =>
          t.title.toLowerCase().includes(q) ||
          t.description.toLowerCase().includes(q)
      )
    : byCategory;
}
