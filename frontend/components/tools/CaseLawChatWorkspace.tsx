"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { IBM_Plex_Sans, PT_Serif } from "next/font/google";
import {
  ArrowUpRight,
  Gavel,
  Landmark,
  Link2,
  MapPin,
  Scale,
  Search,
  ShieldAlert,
  Sparkles,
} from "lucide-react";
import type { Tool } from "@/lib/config/tools";
import { runTenderAnalyzerChat, type TenderAnalyzerChatResponse } from "@/lib/api/tools";
import { parseApiError, isLimitReached, isUnauthorized } from "@/lib/api/errors";
import { logout } from "@/lib/api/auth";
import { requestReauth } from "@/lib/auth/session";
import { Button } from "@/components/ui/Button";

const displayFont = PT_Serif({
  subsets: ["latin", "cyrillic"],
  variable: "--font-case-display",
  weight: ["400", "700"],
});

const bodyFont = IBM_Plex_Sans({
  subsets: ["latin", "cyrillic"],
  variable: "--font-case-body",
  weight: ["400", "500", "600"],
});

type ChatState = "idle" | "loading" | "success" | "error";

type ChatMessage =
  | {
      id: string;
      role: "user";
      content: string;
    }
  | {
      id: string;
      role: "assistant";
      content: string;
      result: TenderAnalyzerChatResponse["result"];
    };

const SUGGESTIONS = [
  "Практика по неосновательному обогащению, Брянская область, арбитраж, ссылки на акты",
  "Подходы судов по взысканию неустойки за просрочку поставки, Москва, апелляция",
  "Суды общей юрисдикции по трудовым спорам, Брянск, восстановление на работе",
];

function formatTime(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  if (m > 0) return `${m} мин ${s} сек`;
  return `${s} сек`;
}

function AssistantAnswer({ result }: { result: TenderAnalyzerChatResponse["result"] }) {
  return (
    <div className="space-y-4 [font-family:var(--font-case-body)]">
      {(result as Record<string, unknown>).data_source === "stub" && (
        <div className="rounded-xl border border-amber-300 bg-amber-50 px-4 py-3">
          <p className="text-sm font-semibold text-amber-800">Ориентировочная сводка</p>
          <p className="mt-1 text-xs text-amber-700">
            Источники поиска недоступны. Результаты ниже носят справочный характер и не основаны на реальной поисковой выдаче. Не используйте их как подтверждённую судебную практику.
          </p>
        </div>
      )}
      {(result as Record<string, unknown>).data_source === "no_results" && (
        <div className="rounded-xl border border-gray-300 bg-gray-50 px-4 py-3">
          <p className="text-sm font-semibold text-gray-700">Результаты не найдены</p>
          <p className="mt-1 text-xs text-gray-600">
            По вашему запросу не удалось найти точных совпадений. Попробуйте уточнить запрос.
          </p>
        </div>
      )}
      {typeof (result as Record<string, unknown>).related_region_notice === "string" &&
        (result as Record<string, unknown>).related_region_notice && (
          <div className="rounded-xl border border-amber-300 bg-amber-50 px-4 py-3">
            <p className="text-sm font-semibold text-amber-800">Другие регионы</p>
            <p className="mt-1 text-xs text-amber-700">
              {String((result as Record<string, unknown>).related_region_notice)}
            </p>
          </div>
        )}
      <div className="rounded-[24px] border border-emerald-200/70 bg-[linear-gradient(135deg,#f1fbf6,#ecfdf5_48%,#f8fffc)] p-4">
        <p className="text-sm font-semibold text-emerald-900">{result.summary}</p>
        <p className="mt-2 text-sm leading-6 text-emerald-800/90">{result.search_scope}</p>
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.3fr)_minmax(220px,0.7fr)]">
        <div className="rounded-3xl border border-stone-200 bg-white p-5 shadow-[0_12px_36px_rgba(15,23,42,0.08)]">
          <h3 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-[0.18em] text-stone-500">
            <Search className="h-4 w-4 text-emerald-700" />
            Контекст запроса
          </h3>
          <p className="mt-3 text-sm leading-6 text-stone-700">{result.dispute_overview}</p>
        </div>
        <div className="rounded-3xl border border-stone-200 bg-white p-5 shadow-[0_12px_36px_rgba(15,23,42,0.08)]">
          <h3 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-[0.18em] text-stone-500">
            <MapPin className="h-4 w-4 text-emerald-700" />
            Регионы
          </h3>
          <div className="mt-3 flex flex-wrap gap-2">
            {result.regions.map((region) => (
              <span
                key={region}
                className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-semibold uppercase tracking-[0.12em] text-emerald-700"
              >
                {region}
              </span>
            ))}
          </div>
        </div>
      </div>

      {result.court_positions.length > 0 && (
      <div className="rounded-3xl border border-stone-200 bg-white p-5 shadow-[0_12px_36px_rgba(15,23,42,0.08)]">
        <h3 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-[0.18em] text-stone-500">
          <Scale className="h-4 w-4 text-emerald-700" />
          Подходы судов
        </h3>
        <div className="mt-4 space-y-3">
          {result.court_positions.map((item, index) => {
            const regionMatch = (item as Record<string, unknown>).region_match;
            return (
              <div
                key={`${index}-${item.court}`}
                className="rounded-2xl border border-stone-200/90 bg-stone-50/75 p-4"
              >
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-sm font-semibold text-stone-900">{item.court}</p>
                  {regionMatch === "other" && (
                    <span className="rounded-full border border-amber-300 bg-amber-50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-amber-700">
                      Другой регион
                    </span>
                  )}
                </div>
                <p className="mt-2 text-sm leading-6 text-stone-700">{item.position}</p>
                <p className="mt-2 text-xs leading-5 text-stone-500">{item.relevance}</p>
              </div>
            );
          })}
        </div>
      </div>
      )}

      {result.cited_cases.length > 0 && (
      <div className="rounded-3xl border border-stone-200 bg-white p-5 shadow-[0_12px_36px_rgba(15,23,42,0.08)]">
        <h3 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-[0.18em] text-stone-500">
          <Link2 className="h-4 w-4 text-emerald-700" />
          Ссылки на акты
        </h3>
        <div className="mt-4 space-y-3">
          {result.cited_cases.map((item, index) => {
            const regionMatch = (item as Record<string, unknown>).region_match;
            return (
              <div
                key={`${index}-${item.citation}`}
                className="rounded-2xl border border-stone-200/90 bg-stone-50/75 p-4"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-sm font-semibold text-stone-900">{item.title}</p>
                      {regionMatch === "other" && (
                        <span className="rounded-full border border-amber-300 bg-amber-50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-amber-700">
                          Другой регион
                        </span>
                      )}
                    </div>
                    <p className="mt-1 text-xs font-medium text-stone-500">{item.citation}</p>
                  </div>
                  <a
                    href={item.url}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.12em] text-emerald-700 transition hover:bg-emerald-100"
                  >
                    Открыть
                    <ArrowUpRight className="h-3.5 w-3.5" />
                  </a>
                </div>
                <p className="mt-3 text-sm leading-6 text-stone-700">{item.takeaway}</p>
              </div>
            );
          })}
        </div>
      </div>
      )}

      <div className="grid gap-4 xl:grid-cols-2">
        <div className="rounded-3xl border border-stone-200 bg-white p-5 shadow-[0_12px_36px_rgba(15,23,42,0.08)]">
          <h3 className="text-sm font-semibold uppercase tracking-[0.18em] text-stone-500">Нормы права</h3>
          <ul className="mt-3 space-y-2">
            {result.legal_basis.map((item, index) => (
              <li
                key={`${index}-${item.slice(0, 24)}`}
                className="rounded-xl border border-stone-200 bg-stone-50 px-3 py-2 text-sm text-stone-700"
              >
                {item}
              </li>
            ))}
          </ul>
        </div>
        <div className="rounded-3xl border border-stone-200 bg-white p-5 shadow-[0_12px_36px_rgba(15,23,42,0.08)]">
          <h3 className="text-sm font-semibold uppercase tracking-[0.18em] text-stone-500">Что делать дальше</h3>
          <ul className="mt-3 space-y-2">
            {result.practical_takeaways.map((item, index) => (
              <li
                key={`${index}-${item.slice(0, 24)}`}
                className="rounded-xl border border-stone-200 bg-stone-50 px-3 py-2 text-sm text-stone-700"
              >
                {item}
              </li>
            ))}
          </ul>
          <p className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
            {result.follow_up_prompt}
          </p>
        </div>
      </div>
    </div>
  );
}

export function CaseLawChatWorkspace({ tool }: { tool: Tool }) {
  const [query, setQuery] = useState("");
  const [allowRelatedRegions, setAllowRelatedRegions] = useState(false);
  const [status, setStatus] = useState<ChatState>("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [elapsedSec, setElapsedSec] = useState(0);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    if (status !== "loading") return;
    const id = window.setInterval(() => {
      setElapsedSec((prev) => prev + 1);
    }, 1000);
    return () => window.clearInterval(id);
  }, [status]);

  useEffect(() => {
    return () => {
      abortRef.current?.abort();
    };
  }, []);

  const canSubmit = query.trim().length > 0;
  const headerHint = useMemo(
    () =>
      status === "loading"
        ? `Ищем практику и собираем ссылки на акты. Прошло ${formatTime(elapsedSec)}.`
        : "Укажите регион, суд, предмет спора и что нужно получить: позиции, нормы или ссылки на акты.",
    [elapsedSec, status]
  );

  const handleSubmit = useCallback(async () => {
    const trimmed = query.trim();
    if (!trimmed) return;

    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setStatus("loading");
    setErrorMessage(null);
    setElapsedSec(0);
    setMessages((prev) => [
      ...prev,
      {
        id: `user-${Date.now()}`,
        role: "user",
        content: allowRelatedRegions ? `${trimmed}\n\nРежим: разрешить похожие акты из других регионов` : trimmed,
      },
    ]);

    try {
      const response = await runTenderAnalyzerChat(trimmed, allowRelatedRegions, controller.signal);
      setMessages((prev) => [
        ...prev,
        {
          id: `assistant-${Date.now()}`,
          role: "assistant",
          content: response.result.summary,
          result: response.result,
        },
      ]);
      setStatus("success");
      setQuery("");
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") {
        setStatus("idle");
        setElapsedSec(0);
        return;
      }
      if (isUnauthorized(error)) {
        logout();
        requestReauth({ reason: "case_law_chat" });
        return;
      }
      const parsed = parseApiError(error);
      let message = parsed.message || "Не удалось собрать подборку практики.";
      if (isLimitReached(error)) {
        message = "Дневной лимит исчерпан. Перейдите на Pro.";
      } else if (parsed.status === 400) {
        message = message || "Нужно ввести запрос.";
      }
      setErrorMessage(message);
      setStatus("error");
    } finally {
      if (abortRef.current === controller) {
        abortRef.current = null;
      }
    }
  }, [allowRelatedRegions, query]);

  return (
    <div className={`${displayFont.variable} ${bodyFont.variable} space-y-8`}>
      <section className="relative overflow-hidden rounded-[34px] border border-zinc-800 bg-[radial-gradient(circle_at_top_left,rgba(16,185,129,0.24),transparent_36%),radial-gradient(circle_at_100%_0%,rgba(56,189,248,0.24),transparent_38%),linear-gradient(160deg,#0b1019,#101827_52%,#152033)] p-5 text-zinc-100 shadow-[0_35px_120px_rgba(2,6,23,0.45)] sm:p-7">
        <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(120deg,rgba(255,255,255,0.08),transparent_30%,rgba(255,255,255,0.04)_72%,transparent)]" />
        <div className="relative grid gap-6 xl:grid-cols-[minmax(0,1.2fr)_minmax(350px,0.8fr)]">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-emerald-300/35 bg-emerald-400/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.26em] text-emerald-200 [font-family:var(--font-case-body)]">
              <Landmark className="h-3.5 w-3.5" />
              Обзор судебной практики
            </div>
            <h2 className="mt-4 max-w-3xl text-3xl leading-[1.08] tracking-[-0.03em] text-white sm:text-5xl [font-family:var(--font-case-display)]">
              Диалог с судебной
              <br />
              аналитикой
              <br />
              в реальном времени.
            </h2>
            <p className="mt-4 max-w-2xl text-sm leading-7 text-zinc-300 sm:text-base [font-family:var(--font-case-body)]">
              Опишите спор естественным языком. Инструмент соберет позиции судов, ссылки на акты, релевантные нормы
              и короткий план, что проверить дальше.
            </p>

            <div className="mt-6 grid gap-3 sm:grid-cols-2">
              {SUGGESTIONS.map((item) => (
                <button
                  key={item}
                  type="button"
                  onClick={() => setQuery(item)}
                  className="rounded-2xl border border-white/15 bg-white/10 px-4 py-3 text-left text-sm leading-6 text-zinc-100 transition hover:border-emerald-300/50 hover:bg-emerald-400/10 [font-family:var(--font-case-body)]"
                >
                  {item}
                </button>
              ))}
            </div>
          </div>

          <div className="rounded-[28px] border border-white/15 bg-white/8 p-5 backdrop-blur [font-family:var(--font-case-body)]">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-zinc-300">Запрос</p>
                <p className="mt-2 text-sm leading-6 text-zinc-200">{headerHint}</p>
              </div>
              <div className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-emerald-300/30 bg-emerald-400/10 text-emerald-200">
                <Sparkles className="h-5 w-5" />
              </div>
            </div>

            <textarea
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Например: практика по взысканию неустойки, Брянская область, арбитраж, ссылки на акты"
              className="mt-4 min-h-[190px] w-full resize-y rounded-2xl border border-white/20 bg-zinc-950/50 px-4 py-3 text-sm leading-6 text-zinc-100 shadow-sm outline-none transition placeholder:text-zinc-400 focus:border-emerald-300 focus:ring-2 focus:ring-emerald-300/25"
            />

            <div className="mt-4 space-y-3">
              <Button
                type="button"
                onClick={status === "loading" ? () => abortRef.current?.abort() : handleSubmit}
                disabled={!canSubmit && status !== "loading"}
                className="w-full rounded-xl bg-emerald-400 text-zinc-950 hover:bg-emerald-300 focus:ring-emerald-200"
              >
                {status === "loading" ? "Остановить поиск" : "Найти практику"}
              </Button>

              <label className="flex items-start gap-2 rounded-xl border border-white/15 bg-white/5 px-3 py-2.5 text-xs text-zinc-200">
                <input
                  type="checkbox"
                  checked={allowRelatedRegions}
                  onChange={(e) => setAllowRelatedRegions(e.target.checked)}
                  className="mt-0.5 h-4 w-4 rounded border-zinc-500 bg-zinc-900 text-emerald-400 focus:ring-emerald-300"
                />
                Разрешить похожие акты из других регионов
              </label>

              <p className="text-xs text-zinc-400">Формат ответа: сводка, позиции судов, ссылки на акты и нормы права.</p>
            </div>

            {errorMessage ? (
              <div className="mt-4 rounded-xl border border-rose-300/40 bg-rose-500/10 px-4 py-3 text-sm text-rose-100">
                {errorMessage}
              </div>
            ) : null}
          </div>
        </div>
      </section>

      <section className="[font-family:var(--font-case-body)]">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-[30px] leading-tight tracking-[-0.02em] text-zinc-900 [font-family:var(--font-case-display)]">
              Диалог и выводы
            </h2>
            <p className="mt-1 text-sm text-zinc-500">{tool.title} хранит контекст в рамках текущей сессии страницы.</p>
          </div>
          <div className="inline-flex items-center gap-2 rounded-full border border-zinc-300 bg-white px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.16em] text-zinc-600">
            <Gavel className="h-3.5 w-3.5 text-emerald-600" />
            Сообщений: {messages.length}
          </div>
        </div>

        {messages.length === 0 ? (
          <div className="rounded-[28px] border border-zinc-200 bg-[linear-gradient(180deg,#ffffff,#f6f7f8)] p-10 text-center shadow-[0_18px_60px_rgba(15,23,42,0.08)]">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl border border-amber-200 bg-amber-50 text-amber-700">
              <ShieldAlert className="h-6 w-6" />
            </div>
            <p className="mx-auto mt-4 max-w-2xl text-sm leading-7 text-zinc-600">
              Диалог пока пуст. Начните с запроса вроде: «арбитражная практика по неустойке в Брянской области,
              ссылки на акты».
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {messages.map((message) => (
              <div key={message.id} className={message.role === "user" ? "flex justify-end" : "flex justify-start"}>
                <div
                  className={
                    message.role === "user"
                      ? "max-w-3xl rounded-[26px] border border-zinc-800 bg-zinc-900 px-5 py-4 text-sm leading-7 text-zinc-100 shadow-[0_16px_44px_rgba(15,23,42,0.22)] [font-family:var(--font-case-body)]"
                      : "w-full max-w-6xl rounded-[30px] border border-zinc-200 bg-[linear-gradient(180deg,#ffffff,#f8f9fa)] p-5 shadow-[0_18px_60px_rgba(15,23,42,0.08)]"
                  }
                >
                  {message.role === "user" ? <p>{message.content}</p> : <AssistantAnswer result={message.result} />}
                </div>
              </div>
            ))}
            {status === "loading" && (
              <div className="flex justify-start">
                <div className="w-full max-w-6xl rounded-[30px] border border-emerald-200 bg-[linear-gradient(180deg,#ffffff,#f1fbf6)] p-5 shadow-[0_18px_60px_rgba(15,23,42,0.08)]">
                  <div className="flex items-center gap-3">
                    <span className="relative flex h-3 w-3">
                      <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75"></span>
                      <span className="relative inline-flex h-3 w-3 rounded-full bg-emerald-500"></span>
                    </span>
                    <p className="text-sm font-semibold text-emerald-900">Собираем подборку практики…</p>
                    <span className="ml-auto rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">
                      {formatTime(elapsedSec)}
                    </span>
                  </div>
                  <div className="mt-4 space-y-2">
                    <div className="h-3 animate-pulse rounded-full bg-emerald-100/80" style={{ width: "80%" }} />
                    <div className="h-3 animate-pulse rounded-full bg-emerald-100/80" style={{ width: "60%" }} />
                    <div className="h-3 animate-pulse rounded-full bg-emerald-100/80" style={{ width: "72%" }} />
                  </div>
                  <p className="mt-4 text-xs leading-5 text-emerald-800/80">
                    Ищем по kad.arbitr.ru и sudrf.ru, фильтруем по региону и инстанции, проверяем нормы.
                  </p>
                </div>
              </div>
            )}
          </div>
        )}
      </section>
    </div>
  );
}
