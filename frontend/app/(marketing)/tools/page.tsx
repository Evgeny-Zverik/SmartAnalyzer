import { ToolsPageClient } from "./ToolsPageClient";
import Link from "next/link";
import {
  ArrowRight,
  CheckCircle2,
  FileSearch,
  GitCompareArrows,
  ShieldCheck,
  Sparkles,
} from "lucide-react";

const quickScenarios = [
  {
    title: "Проверить договор",
    text: "Риски, штрафы, сроки и спорные формулировки.",
    href: "/tools/document-analyzer",
    icon: FileSearch,
  },
  {
    title: "Сравнить редакции",
    text: "Что добавили, удалили или переписали в новой версии.",
    href: "/tools/data-extractor",
    icon: GitCompareArrows,
  },
  {
    title: "Найти судебную практику",
    text: "Подходы судов, нормы и аргументы для проверки.",
    href: "/tools/tender-analyzer",
    icon: CheckCircle2,
  },
];

export default function ToolsPage() {
  return (
    <main className="min-h-screen bg-[#f5f6f7]">
      <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
        <section className="relative overflow-hidden rounded-[36px] border border-stone-200/80 bg-white p-6 shadow-[0_24px_80px_rgba(28,25,23,0.08)] sm:p-8 lg:p-10">
          <div className="pointer-events-none absolute bottom-0 left-1/3 h-px w-1/2 bg-gradient-to-r from-transparent via-stone-400/30 to-transparent" />
          <div className="relative grid gap-8 lg:grid-cols-[1.05fr_0.95fr] lg:items-center">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full border border-amber-200 bg-[#fff7cc] px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.2em] text-stone-900">
                <Sparkles className="h-3.5 w-3.5" />
                AI-инструменты для документов
              </div>
              <h1 className="mt-5 max-w-4xl text-4xl font-semibold leading-[0.96] tracking-[-0.05em] text-stone-900 sm:text-5xl lg:text-6xl">
                Выберите задачу и получите готовый результат по документу.
              </h1>
              <p className="mt-5 max-w-3xl text-base leading-8 text-stone-600">
                Начните с анализа договора, сравнения редакций или поиска
                судебной практики. Каждый инструмент сразу ведет к рабочему
                сценарию, без ручной настройки промпта.
              </p>
              <div className="mt-7 flex flex-col gap-3 sm:flex-row">
                <Link
                  href="/tools/document-analyzer"
                  className="inline-flex items-center justify-center rounded-full bg-[#ffd43b] px-6 py-3 text-sm font-bold text-stone-950 shadow-[0_16px_42px_rgba(245,158,11,0.22)] hover:bg-[#f6c343]"
                >
                  Проверить договор
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
                <Link
                  href="#tool-catalog"
                  className="inline-flex items-center justify-center rounded-full border border-stone-300 bg-white/85 px-6 py-3 text-sm font-bold text-stone-800 hover:bg-white"
                >
                  Выбрать другой инструмент
                </Link>
              </div>
              <div className="mt-7 grid gap-3 sm:grid-cols-3">
                {[
                  ["PDF, DOCX, сканы", "форматы для анализа"],
                  ["100 кредитов", "для бесплатного старта"],
                  ["AES-GCM", "шифрование диалогов"],
                ].map(([value, label]) => (
                  <div
                    key={value}
                    className="rounded-2xl border border-stone-200 bg-white/76 p-4 shadow-sm"
                  >
                    <p className="text-lg font-bold tracking-[-0.03em] text-stone-950">
                      {value}
                    </p>
                    <p className="mt-1 text-xs font-semibold uppercase tracking-[0.12em] text-stone-500">
                      {label}
                    </p>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-[32px] border border-stone-200 bg-stone-50 p-4 shadow-[0_18px_54px_rgba(15,23,42,0.08)]">
              <div className="rounded-[24px] border border-amber-200 bg-[#fff7cc] p-4">
                <div className="flex items-start gap-3">
                  <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-[16px] border border-stone-200 bg-white text-stone-950">
                    <ShieldCheck className="h-5 w-5" />
                  </span>
                  <div>
                    <p className="font-semibold text-stone-950">
                      Лучший первый шаг
                    </p>
                    <p className="mt-1 text-sm leading-6 text-stone-600">
                      Загрузите договор и получите риски, сроки, штрафы и выводы
                      по пунктам.
                    </p>
                  </div>
                </div>
              </div>
              <div className="mt-3 space-y-3">
                {quickScenarios.map(({ title, text, href, icon: Icon }) => (
                  <Link
                    key={title}
                    href={href}
                    className="group flex items-start gap-3 rounded-[24px] border border-stone-200 bg-white p-4 transition hover:border-amber-300 hover:bg-[#fffaf0]"
                  >
                    <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-[16px] border border-stone-200 bg-stone-50 text-stone-950">
                      <Icon className="h-5 w-5" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-bold text-stone-950">
                        {title}
                      </span>
                      <span className="mt-1 block text-sm leading-6 text-stone-600">
                        {text}
                      </span>
                    </span>
                    <ArrowRight className="mt-1 h-4 w-4 shrink-0 text-stone-400 transition group-hover:translate-x-0.5 group-hover:text-amber-600" />
                  </Link>
                ))}
              </div>
            </div>
          </div>
        </section>

        <ToolsPageClient />
      </div>
    </main>
  );
}
