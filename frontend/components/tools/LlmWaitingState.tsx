"use client";

import { useEffect, useRef, useState } from "react";

type AnalysisStage = "upload" | "analyze" | "review" | "done";
type DocumentViewMode = "summary" | "advanced";

type LlmWaitingStateProps = {
  stage?: AnalysisStage;
  elapsedSec: number;
  toolSlug?: string;
  documentView?: DocumentViewMode;
};

const STAGE_TITLES: Record<AnalysisStage, string> = {
  upload: "Загрузка и подготовка файла",
  analyze: "Анализ LLM",
  review: "Разметка и сборка результата",
  done: "Финализация ответа",
};

const BASE_STEPS: AnalysisStage[] = ["upload", "analyze", "done"];
const DOC_STEPS: AnalysisStage[] = ["upload", "analyze", "review", "done"];

function formatTime(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  if (m > 0) return `${m} мин ${s} сек`;
  return `${s} сек`;
}

function getLoaderCopy(toolSlug?: string): { eyebrow: string; title: string; subtitle: string } {
  if (toolSlug === "data-extractor") {
    return {
      eyebrow: "Comparison Loop",
      title: "Сравниваем версии и строим карту различий",
      subtitle: "Выделяем совпадения, сдвиги формулировок и изменения сроков в единую структуру.",
    };
  }
  if (toolSlug === "spelling-checker") {
    return {
      eyebrow: "Proof Loop",
      title: "Проверяем орфографию и готовим чистовую версию",
      subtitle: "LLM проходит по тексту и аккуратно исправляет ошибки без потери исходного смысла.",
    };
  }
  if (toolSlug === "legal-text-simplifier") {
    return {
      eyebrow: "Simplify Loop",
      title: "Упрощаем юридический текст без потери смысла",
      subtitle: "Сохраняем юридическую точность и превращаем сложные формулировки в понятный язык.",
    };
  }
  if (toolSlug === "foreign-language-translator") {
    return {
      eyebrow: "Translate Loop",
      title: "Переводим и сверяем терминологию",
      subtitle: "Модель выстраивает корректный перевод и удерживает контекст по всему документу.",
    };
  }
  if (toolSlug === "legal-style-translator") {
    return {
      eyebrow: "Style Loop",
      title: "Переводим текст в официально-деловой стиль",
      subtitle: "Формулировки выравниваются под юридическую подачу и рабочие корпоративные документы.",
    };
  }
  if (toolSlug === "legal-document-design-review") {
    return {
      eyebrow: "Drafting Loop",
      title: "Проверяем структуру и технику юридического текста",
      subtitle: "Оцениваем стройность документа, формулировки и признаки юридических рисков.",
    };
  }
  return {
    eyebrow: "LLM Loop",
    title: "Анализируем документ и собираем результат",
    subtitle: "Запущена многоэтапная обработка: чтение, анализ и финальная компоновка ответа.",
  };
}

export function LlmWaitingState({
  stage,
  elapsedSec,
  toolSlug,
  documentView = "summary",
}: LlmWaitingStateProps) {
  const rootRef = useRef<HTMLDivElement | null>(null);
  const [isInView, setIsInView] = useState(true);

  useEffect(() => {
    const node = rootRef.current;
    if (!node) return;
    const observer = new IntersectionObserver(
      (entries) => {
        setIsInView(entries[0]?.isIntersecting ?? true);
      },
      { threshold: 0.1 }
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  const steps = toolSlug === "document-analyzer" ? DOC_STEPS : BASE_STEPS;
  const resolvedStage: AnalysisStage = stage ?? "upload";
  const rawIdx = steps.indexOf(resolvedStage);
  const currentIdx = rawIdx >= 0 ? rawIdx : 0;
  const progress = Math.max(12, ((currentIdx + 1) / steps.length) * 100);
  const copy = getLoaderCopy(toolSlug);

  const currentTitle =
    toolSlug === "document-analyzer" && documentView === "advanced" && resolvedStage === "analyze"
      ? "Анализ и подготовка AI-редактора"
      : STAGE_TITLES[resolvedStage];

  return (
    <div
      ref={rootRef}
      className="llm-waiting-enter relative overflow-hidden rounded-[32px] border border-zinc-800 bg-[radial-gradient(circle_at_top_left,rgba(16,185,129,0.24),transparent_34%),radial-gradient(circle_at_80%_15%,rgba(56,189,248,0.22),transparent_32%),linear-gradient(158deg,#0a111c,#111d30_54%,#13263a)] p-6 text-zinc-100 shadow-[0_28px_90px_rgba(2,6,23,0.45)] sm:p-8"
    >
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(120deg,rgba(255,255,255,0.08),transparent_34%,rgba(255,255,255,0.02)_70%,transparent)]" />
      <div className="pointer-events-none absolute -left-16 top-8 h-44 w-44 rounded-full border border-emerald-300/30" />
      <div className="llm-gentle-float pointer-events-none absolute right-8 top-10 h-24 w-24 rounded-full bg-emerald-300/20 blur-2xl" />

      <div className="relative grid gap-6 xl:grid-cols-[minmax(0,1fr)_320px]">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-emerald-200/85">{copy.eyebrow}</p>
          <h3 className="mt-3 text-3xl font-semibold tracking-[-0.04em] text-white">{copy.title}</h3>
          <p className="mt-4 max-w-3xl text-sm leading-7 text-zinc-300">{copy.subtitle}</p>

          <div className="relative mt-7 h-3 overflow-hidden rounded-full bg-white/10 ring-1 ring-white/10">
            <div
              className="h-full rounded-full bg-[linear-gradient(90deg,#10b981,#14b8a6,#38bdf8)] transition-[width] duration-300 ease-[cubic-bezier(0.25,1,0.5,1)]"
              style={{ width: `${progress}%` }}
            />
            {isInView ? (
              <div className="pointer-events-none absolute inset-0 overflow-hidden">
                <div className="llm-progress-sheen h-full w-1/3 rounded-full bg-[linear-gradient(90deg,transparent,rgba(255,255,255,0.45),transparent)]" />
              </div>
            ) : null}
          </div>

          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            {steps.map((item, index) => {
              const isDone = index < currentIdx;
              const isCurrent = index === currentIdx;
              return (
                <div
                  key={item}
                  className={`llm-stage-enter rounded-2xl border px-4 py-4 transition-[transform,background-color,border-color] duration-200 ease-[cubic-bezier(0.22,1,0.36,1)] ${
                    isDone
                      ? "border-emerald-300/30 bg-emerald-300/10"
                      : isCurrent
                        ? "border-sky-300/35 bg-white/10"
                        : "border-white/10 bg-white/[0.04]"
                  } motion-safe:hover:-translate-y-0.5 motion-reduce:transform-none`}
                  style={{ animationDelay: `${0.08 + index * 0.05}s` }}
                >
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-zinc-300">{STAGE_TITLES[item]}</p>
                    <span className="relative inline-flex h-8 w-8 items-center justify-center">
                      <span className={`absolute inset-0 rounded-full border-2 ${isDone ? "border-emerald-300" : isCurrent ? `border-sky-300 border-t-transparent ${isInView ? "animate-spin" : ""} motion-reduce:animate-none` : "border-white/25"}`} />
                      <span className={`relative inline-flex h-5 w-5 rounded-full ${isDone ? "bg-emerald-300" : isCurrent ? `bg-sky-300 ${isInView ? "animate-pulse" : ""} motion-reduce:animate-none` : "bg-white/20"}`} />
                    </span>
                  </div>
                  <div className="mt-3 h-1.5 rounded-full bg-white/10">
                    <div
                      className={`h-1.5 rounded-full ${
                        isDone
                          ? "w-full bg-emerald-300"
                          : isCurrent
                            ? `w-2/3 bg-sky-300 ${isInView ? "animate-pulse" : ""} motion-reduce:animate-none`
                            : "w-1/4 bg-white/20"
                      }`}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <aside className="llm-stage-enter rounded-[26px] border border-white/12 bg-black/35 p-5" style={{ animationDelay: "0.24s" }}>
          <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-zinc-400">Время анализа</p>
          <p className="mt-2 text-4xl font-semibold tracking-[-0.05em] text-white">{formatTime(elapsedSec)}</p>
          <p className="mt-2 text-sm text-zinc-300">{currentTitle}</p>

          <div className="mt-6 rounded-2xl border border-white/10 bg-white/[0.04] p-4">
            <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-zinc-500">Engine</p>
            <div className="mt-3 flex items-center justify-between">
              <p className="text-sm text-zinc-200">LLM pipeline active</p>
              <div className="relative h-14 w-14">
                <span className={`absolute inset-0 rounded-full border-[3px] border-emerald-300 border-t-transparent ${isInView ? "animate-spin" : ""} motion-reduce:animate-none`} />
                <span className={`absolute inset-[8px] rounded-full border-[3px] border-sky-300 border-t-transparent [animation-direction:reverse] ${isInView ? "animate-spin" : ""} motion-reduce:animate-none`} />
                <span className={`absolute inset-[20px] rounded-full bg-emerald-300 ${isInView ? "animate-pulse" : ""} motion-reduce:animate-none`} />
              </div>
            </div>
          </div>

          <div className="mt-4 space-y-3">
            {["Чтение контекста", "LLM-обработка", "Формирование ответа"].map((label, index) => (
              <div key={label} className="rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2.5">
                <div className="flex items-center justify-between gap-3">
                  <span className="text-sm text-zinc-200">{label}</span>
                  <span className={`h-2.5 w-2.5 rounded-full ${index <= currentIdx ? `bg-emerald-300 ${isInView ? "animate-pulse" : ""} motion-reduce:animate-none` : "bg-white/20"}`} />
                </div>
              </div>
            ))}
          </div>
        </aside>
      </div>
    </div>
  );
}
