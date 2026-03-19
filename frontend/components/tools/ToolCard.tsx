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

export function ToolCard({ tool }: ToolCardProps) {
  const Icon = iconMap[tool.icon] ?? FileSearch;

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
            <Badge className="border border-stone-200 bg-white/80 text-stone-700">{CATEGORY_LABELS[tool.category] ?? tool.category}</Badge>
            <Badge className="border border-emerald-200 bg-emerald-100/80 text-emerald-800">MVP</Badge>
          </div>
        </div>
        <h3 className="mt-5 text-xl font-semibold tracking-[-0.03em] text-stone-900">
          {tool.title}
        </h3>
        <p className="mt-3 flex-1 text-sm leading-7 text-stone-600">{tool.description}</p>
        <p className="mt-4 text-xs uppercase tracking-[0.2em] text-stone-500">
          Форматы: {tool.mvp.accepts.length > 0 ? tool.mvp.accepts.join(" / ").toUpperCase() : "По запросу"}
        </p>
        <div className="mt-5">
          <Button href={`/tools/${tool.slug}`} variant="primary" className="w-full rounded-full bg-stone-900 px-5 hover:bg-stone-800 focus:ring-stone-600 sm:w-auto">
            Открыть
          </Button>
        </div>
      </div>
      </div>
    </Card>
  );
}
