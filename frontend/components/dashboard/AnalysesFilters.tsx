"use client";

import { Input } from "@/components/ui/Input";
import { tools } from "@/lib/config/tools";

type AnalysesFiltersProps = {
  toolSlug: string;
  searchQuery: string;
  onToolSlugChange: (value: string) => void;
  onSearchChange: (value: string) => void;
};

export function AnalysesFilters({
  toolSlug,
  searchQuery,
  onToolSlugChange,
  onSearchChange,
}: AnalysesFiltersProps) {
  return (
    <div className="flex flex-wrap items-center gap-4">
      <div className="min-w-[180px]">
        <label htmlFor="filter-tool" className="mb-1.5 block text-sm font-medium text-gray-700">
          Инструмент
        </label>
        <select
          id="filter-tool"
          value={toolSlug}
          onChange={(e) => onToolSlugChange(e.target.value)}
          className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-gray-900 shadow-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
        >
          <option value="">Все</option>
          {tools.map((t) => (
            <option key={t.slug} value={t.slug}>
              {t.title}
            </option>
          ))}
        </select>
      </div>
      <div className="min-w-[200px] flex-1">
        <Input
          label="Поиск по имени файла"
          type="search"
          placeholder="contract.pdf"
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
        />
      </div>
    </div>
  );
}
