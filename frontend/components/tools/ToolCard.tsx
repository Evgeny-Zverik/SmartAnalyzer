import Link from "next/link";
import {
  FileSearch,
  Scale,
  GitCompareArrows,
  Landmark,
  PenTool,
  type LucideIcon,
} from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import type { Tool } from "@/lib/config/tools";
import { CATEGORY_LABELS } from "@/lib/config/tools";

const iconMap: Record<string, LucideIcon> = {
  FileSearch,
  Scale,
  GitCompareArrows,
  Landmark,
  PenTool,
};

type ToolCardProps = {
  tool: Tool;
};

const toolSalesMeta: Record<
  string,
  { outcome: string; cta: string; highlight?: string }
> = {
  "document-analyzer": {
    outcome: "Резюме, риски, сроки, штрафы и выводы по пунктам договора.",
    cta: "Проверить договор",
    highlight: "Лучший старт",
  },
  "data-extractor": {
    outcome:
      "Покажет, что изменилось между редакциями и где появились новые риски.",
    cta: "Сравнить редакции",
  },
  "tender-analyzer": {
    outcome:
      "Подберет подходы судов, ссылки на акты и нормы, которые стоит проверить.",
    cta: "Найти практику",
  },
  "handwriting-recognition": {
    outcome:
      "Переведет фото, сканы и рукописные материалы в редактируемый текст.",
    cta: "Распознать документ",
  },
  "legal-style-translator": {
    outcome:
      "Сделает текст более официальным и пригодным для деловой переписки.",
    cta: "Перевести стиль",
  },
  "legal-text-simplifier": {
    outcome: "Объяснит юридический текст простым языком без потери смысла.",
    cta: "Упростить текст",
  },
  "spelling-checker": {
    outcome: "Исправит орфографию, пунктуацию и явные ошибки в документе.",
    cta: "Проверить текст",
  },
  "foreign-language-translator": {
    outcome: "Переведет иностранный текст на русский для дальнейшей работы.",
    cta: "Перевести текст",
  },
  "legal-document-design-review": {
    outcome: "Проверит структуру, язык и технику юридического документа.",
    cta: "Проверить структуру",
  },
};

export function ToolCard({ tool }: ToolCardProps) {
  const Icon = iconMap[tool.icon] ?? FileSearch;
  const meta = toolSalesMeta[tool.slug] ?? {
    outcome: tool.description,
    cta: "Открыть инструмент",
  };
  const isUnlimited =
    tool.slug === "legal-document-design-review" ||
    tool.slug === "legal-style-translator" ||
    tool.slug === "foreign-language-translator" ||
    tool.slug === "legal-text-simplifier" ||
    tool.slug === "spelling-checker";
  const visibleFormats = tool.mvp.accepts.slice(0, 4);
  const hiddenFormatsCount = Math.max(
    0,
    tool.mvp.accepts.length - visibleFormats.length,
  );

  return (
    <Card className="group relative overflow-hidden rounded-[28px] border-stone-200/80 bg-[linear-gradient(160deg,rgba(255,255,255,0.95),rgba(248,246,241,0.95))] p-0 shadow-[0_18px_50px_rgba(28,25,23,0.06)] transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_28px_70px_rgba(16,185,129,0.14)]">
      <div className="pointer-events-none absolute right-0 top-0 h-28 w-28 rounded-full bg-emerald-200/20 blur-2xl transition-opacity duration-300 group-hover:opacity-100" />
      <div className="pointer-events-none absolute bottom-0 left-0 h-px w-full bg-gradient-to-r from-transparent via-stone-300/50 to-transparent" />
      <div className="p-6">
        <div className="flex h-full flex-col">
          <div className="flex items-start justify-between gap-2">
            <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-3 text-emerald-700">
              <Icon className="h-6 w-6 shrink-0" aria-hidden />
            </div>
            <div className="flex flex-wrap gap-1">
              <Badge className="border border-stone-200 bg-white/80 text-stone-700">
                {CATEGORY_LABELS[tool.category] ?? tool.category}
              </Badge>
              {meta.highlight && (
                <Badge className="border border-emerald-300 bg-emerald-50 text-emerald-700">
                  {meta.highlight}
                </Badge>
              )}
              {isUnlimited && (
                <Badge className="border border-zinc-700/80 bg-zinc-800/90 text-zinc-100">
                  Безлимит
                </Badge>
              )}
            </div>
          </div>
          <h3 className="mt-5 text-xl font-semibold tracking-[-0.03em] text-stone-900">
            {tool.title}
          </h3>
          <p className="mt-3 text-sm leading-7 text-stone-600">
            {tool.description}
          </p>
          <div className="mt-4 rounded-2xl border border-emerald-200 bg-emerald-50/70 p-3">
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-emerald-700">
              Результат
            </p>
            <p className="mt-1 text-sm leading-6 text-stone-700">
              {meta.outcome}
            </p>
          </div>
          <div className="mt-5">
            <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-stone-400">
              Форматы
            </p>
            {tool.mvp.accepts.length > 0 ? (
              <div className="mt-2 flex flex-wrap gap-2">
                {visibleFormats.map((format) => (
                  <span
                    key={`${tool.slug}-${format}`}
                    className="inline-flex items-center rounded-full border border-stone-200 bg-white/88 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-stone-600"
                  >
                    {format}
                  </span>
                ))}
                {hiddenFormatsCount > 0 && (
                  <span className="inline-flex items-center rounded-full border border-emerald-200 bg-emerald-50/90 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-emerald-700">
                    +{hiddenFormatsCount}
                  </span>
                )}
              </div>
            ) : (
              <p className="mt-2 text-sm text-stone-500">По запросу</p>
            )}
          </div>
          <div className="mt-5">
            <Button
              href={`/tools/${tool.slug}`}
              variant="primary"
              className="w-full rounded-full bg-stone-900 px-5 hover:bg-stone-800 focus:ring-stone-600"
            >
              {meta.cta}
            </Button>
          </div>
        </div>
      </div>
    </Card>
  );
}
