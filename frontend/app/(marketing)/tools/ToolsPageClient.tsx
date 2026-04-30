"use client";

import { useEffect, useMemo, useState } from "react";
import { tools } from "@/lib/config/tools";
import { ToolCard } from "@/components/tools/ToolCard";
import { getEnabledToolSlugs } from "@/lib/features/toolFeatureGate";

const categoryFilters = ["Все", "Документы", "Риски", "Данные"] as const;

export function ToolsPageClient() {
  const [enabledToolSlugs, setEnabledToolSlugs] = useState<Set<string> | null>(
    null,
  );
  const [activeFilter, setActiveFilter] =
    useState<(typeof categoryFilters)[number]>("Все");

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
    [enabledToolSlugs],
  );
  const filteredTools = useMemo(
    () =>
      activeFilter === "Все"
        ? visibleTools
        : visibleTools.filter((tool) => {
            if (activeFilter === "Документы")
              return tool.category === "Documents";
            if (activeFilter === "Риски") return tool.category === "Risk";
            return tool.category === "Data";
          }),
    [activeFilter, visibleTools],
  );

  return (
    <section id="tool-catalog" className="mt-10 scroll-mt-28">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-amber-700">
            Каталог
          </p>
          <h2 className="mt-2 text-3xl font-semibold tracking-[-0.04em] text-stone-950">
            Выберите инструмент под текущую задачу
          </h2>
          <p className="mt-2 text-sm leading-6 text-stone-600">
            Доступно инструментов:{" "}
            <span className="font-semibold text-stone-900">
              {filteredTools.length}
            </span>
          </p>
        </div>
        <div
          className="flex flex-wrap items-center gap-2"
          aria-label="Фильтр инструментов"
        >
          {categoryFilters.map((item) => (
            <button
              key={item}
              type="button"
              onClick={() => setActiveFilter(item)}
              className={`inline-flex items-center rounded-full border px-3 py-1.5 text-xs font-semibold transition ${
                activeFilter === item
                  ? "border-stone-900 bg-stone-900 text-white"
                  : "border-stone-300 bg-white/80 text-stone-600 hover:bg-white hover:text-stone-900"
              }`}
            >
              {item}
            </button>
          ))}
        </div>
      </div>

      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {filteredTools.map((tool) => (
          <ToolCard key={tool.slug} tool={tool} />
        ))}
      </div>

      <div className="mt-10 rounded-[32px] border border-stone-200 bg-white p-6 text-stone-950 shadow-[0_24px_80px_rgba(28,25,23,0.08)] sm:p-8">
        <div className="flex flex-col gap-5 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-amber-700">
              Не знаете, с чего начать?
            </p>
            <h2 className="mt-3 max-w-2xl text-3xl font-semibold leading-tight tracking-[-0.04em]">
              Начните с анализа договора: он покажет риски, сроки и спорные
              пункты.
            </h2>
          </div>
          <a
            href="/tools/document-analyzer"
            className="inline-flex items-center justify-center rounded-full bg-[#ffd43b] px-6 py-3 text-sm font-bold text-stone-950 shadow-[0_14px_34px_rgba(245,158,11,0.18)] hover:bg-[#f6c343]"
          >
            Проверить договор
          </a>
        </div>
      </div>
    </section>
  );
}
