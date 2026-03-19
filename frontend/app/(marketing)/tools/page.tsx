import { ToolsPageClient } from "./ToolsPageClient";

export default function ToolsPage() {
  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top,_rgba(232,249,243,0.7),rgba(252,251,247,0.96)_42%,rgba(246,244,239,0.96))]">
      <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
        <section className="relative overflow-hidden rounded-[34px] border border-stone-200/80 bg-[linear-gradient(135deg,rgba(255,255,255,0.94),rgba(248,245,237,0.94))] p-6 shadow-[0_24px_80px_rgba(28,25,23,0.08)] sm:p-8">
          <div className="pointer-events-none absolute right-0 top-0 h-40 w-40 rounded-full bg-emerald-200/30 blur-3xl" />
          <div className="pointer-events-none absolute bottom-0 left-1/3 h-px w-1/2 bg-gradient-to-r from-transparent via-stone-400/30 to-transparent" />
          <div className="relative">
            <div className="inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.24em] text-emerald-700">
              Каталог AI-инструментов
            </div>
            <h1 className="mt-5 max-w-4xl text-4xl font-semibold leading-[0.96] tracking-[-0.05em] text-stone-900 sm:text-5xl lg:text-6xl">
              Выберите подходящий анализатор и запускайте задачу за пару кликов.
            </h1>
            <p className="mt-5 max-w-3xl text-base leading-8 text-stone-600">
              Каждый инструмент заточен под отдельный тип работы: сравнение версий документов, проверка договоров, обзор судебной
              практики, распознавание рукописных материалов и структурированный анализ содержимого.
            </p>
          </div>
        </section>

        <ToolsPageClient />
      </div>
    </main>
  );
}
