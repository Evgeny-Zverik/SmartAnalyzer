"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ArrowUpRight, Landmark, Link2, MapPin, Scale, Search } from "lucide-react";
import type { Tool } from "@/lib/config/tools";
import { runTenderAnalyzerChat, type TenderAnalyzerChatResponse } from "@/lib/api/tools";
import { parseApiError, isLimitReached, isUnauthorized } from "@/lib/api/errors";
import { logout } from "@/lib/api/auth";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";

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
    <div className="space-y-4">
      <div className="rounded-2xl border border-emerald-100 bg-emerald-50/70 p-4">
        <p className="text-sm font-medium text-emerald-900">{result.summary}</p>
        <p className="mt-2 text-sm leading-6 text-emerald-800/90">{result.search_scope}</p>
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.3fr)_minmax(220px,0.7fr)]">
        <Card className="p-5">
          <h3 className="flex items-center gap-2 text-sm font-semibold text-gray-900">
            <Search className="h-4 w-4 text-emerald-600" />
            Контекст запроса
          </h3>
          <p className="mt-3 text-sm leading-6 text-gray-600">{result.dispute_overview}</p>
        </Card>
        <Card className="p-5">
          <h3 className="flex items-center gap-2 text-sm font-semibold text-gray-900">
            <MapPin className="h-4 w-4 text-emerald-600" />
            Регионы
          </h3>
          <div className="mt-3 flex flex-wrap gap-2">
            {result.regions.map((region) => (
              <span key={region} className="rounded-full bg-gray-100 px-3 py-1 text-xs font-medium text-gray-700">
                {region}
              </span>
            ))}
          </div>
        </Card>
      </div>

      <Card className="p-5">
        <h3 className="flex items-center gap-2 text-sm font-semibold text-gray-900">
          <Scale className="h-4 w-4 text-emerald-600" />
          Подходы судов
        </h3>
        <div className="mt-4 space-y-3">
          {result.court_positions.map((item, index) => (
            <div key={`${index}-${item.court}`} className="rounded-2xl border border-gray-200 bg-gray-50 p-4">
              <p className="text-sm font-semibold text-gray-900">{item.court}</p>
              <p className="mt-2 text-sm leading-6 text-gray-600">{item.position}</p>
              <p className="mt-2 text-xs leading-5 text-gray-500">{item.relevance}</p>
            </div>
          ))}
        </div>
      </Card>

      <Card className="p-5">
        <h3 className="flex items-center gap-2 text-sm font-semibold text-gray-900">
          <Link2 className="h-4 w-4 text-emerald-600" />
          Ссылки на акты
        </h3>
        <div className="mt-4 space-y-3">
          {result.cited_cases.map((item, index) => (
            <div key={`${index}-${item.citation}`} className="rounded-2xl border border-gray-200 bg-gray-50 p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="text-sm font-semibold text-gray-900">{item.title}</p>
                  <p className="mt-1 text-xs font-medium text-gray-500">{item.citation}</p>
                </div>
                <a
                  href={item.url}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 text-sm font-medium text-emerald-700 hover:text-emerald-800"
                >
                  Открыть
                  <ArrowUpRight className="h-4 w-4" />
                </a>
              </div>
              <p className="mt-3 text-sm leading-6 text-gray-600">{item.takeaway}</p>
            </div>
          ))}
        </div>
      </Card>

      <div className="grid gap-4 xl:grid-cols-2">
        <Card className="p-5">
          <h3 className="text-sm font-semibold text-gray-900">Нормы права</h3>
          <ul className="mt-3 list-inside list-disc space-y-2 text-sm leading-6 text-gray-600">
            {result.legal_basis.map((item, index) => (
              <li key={`${index}-${item.slice(0, 24)}`}>{item}</li>
            ))}
          </ul>
        </Card>
        <Card className="p-5">
          <h3 className="text-sm font-semibold text-gray-900">Что делать дальше</h3>
          <ul className="mt-3 list-inside list-disc space-y-2 text-sm leading-6 text-gray-600">
            {result.practical_takeaways.map((item, index) => (
              <li key={`${index}-${item.slice(0, 24)}`}>{item}</li>
            ))}
          </ul>
          <p className="mt-4 rounded-2xl bg-amber-50 px-4 py-3 text-sm text-amber-900">{result.follow_up_prompt}</p>
        </Card>
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
        : "Спросите про регион, вид суда, предмет спора и попросите ссылки на акты.",
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
        window.location.href = "/login";
        return;
      }
      const parsed = parseApiError(error);
      let message = parsed.message || "Не удалось собрать подборку практики.";
      if (isLimitReached(error)) {
        message = "Daily limit reached. Upgrade to Pro.";
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
    <div className="space-y-8">
      <section className="overflow-hidden rounded-[32px] border border-gray-200 bg-[radial-gradient(circle_at_top_left,_rgba(16,185,129,0.16),_transparent_32%),linear-gradient(180deg,#ffffff_0%,#f8fafc_100%)] shadow-sm">
        <div className="grid gap-6 p-6 xl:grid-cols-[minmax(0,1.2fr)_minmax(320px,0.8fr)] xl:p-8">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full bg-white/85 px-3 py-1 text-xs font-medium text-emerald-700 shadow-sm">
              <Landmark className="h-3.5 w-3.5" />
              Legal Research Chat
            </div>
            <h2 className="mt-4 max-w-2xl text-2xl font-semibold text-gray-900">Спросите как в правовой базе, но своими словами</h2>
            <p className="mt-3 max-w-2xl text-sm leading-7 text-gray-600">
              Опишите спор, регион, вид суда и что именно нужно: подходы судов, ссылки на акты, применимые нормы или общую сводку по практике.
            </p>
            <div className="mt-6 grid gap-3 sm:grid-cols-2">
              {SUGGESTIONS.map((item) => (
                <button
                  key={item}
                  type="button"
                  onClick={() => setQuery(item)}
                  className="rounded-2xl border border-gray-200 bg-white/90 px-4 py-3 text-left text-sm leading-6 text-gray-700 shadow-sm transition hover:border-emerald-300 hover:bg-white"
                >
                  {item}
                </button>
              ))}
            </div>
          </div>

          <div className="rounded-[28px] border border-gray-200 bg-white/90 p-5 shadow-sm">
            <p className="text-sm font-semibold text-gray-900">Запрос</p>
            <p className="mt-2 text-sm leading-6 text-gray-600">{headerHint}</p>
            <textarea
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Например: практика по взысканию неустойки, Брянская область, арбитраж, ссылки на акты"
              className="mt-4 min-h-[180px] w-full resize-y rounded-2xl border border-gray-300 px-4 py-3 text-sm leading-6 text-gray-900 shadow-sm outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20"
            />
            <div className="mt-4 flex flex-wrap items-center gap-3">
              <Button
                type="button"
                onClick={status === "loading" ? () => abortRef.current?.abort() : handleSubmit}
                disabled={!canSubmit && status !== "loading"}
                className="min-w-[220px]"
              >
                {status === "loading" ? "Остановить поиск" : "Найти практику"}
              </Button>
              <label className="inline-flex items-center gap-2 rounded-full border border-gray-200 bg-white px-3 py-2 text-xs font-medium text-gray-700">
                <input
                  type="checkbox"
                  checked={allowRelatedRegions}
                  onChange={(e) => setAllowRelatedRegions(e.target.checked)}
                  className="h-4 w-4 rounded border-gray-300 text-emerald-600 focus:ring-emerald-500"
                />
                Разрешить похожие акты из других регионов
              </label>
              <p className="text-xs text-gray-500">Формат ответа: краткая сводка, позиции судов и ссылки на акты.</p>
            </div>
            {errorMessage ? (
              <div className="mt-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{errorMessage}</div>
            ) : null}
          </div>
        </div>
      </section>

      <section>
        <div className="mb-4 flex items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Диалог</h2>
            <p className="mt-1 text-sm text-gray-500">{tool.title} запоминает ход беседы в рамках текущей страницы.</p>
          </div>
        </div>

        {messages.length === 0 ? (
          <Card className="p-8 text-center">
            <p className="text-sm text-gray-500">Пока пусто. Отправьте запрос вроде «решения судов Брянска по поставке, ссылки на акты».</p>
          </Card>
        ) : (
          <div className="space-y-4">
            {messages.map((message) => (
              <div key={message.id} className={message.role === "user" ? "flex justify-end" : "flex justify-start"}>
                <div
                  className={
                    message.role === "user"
                      ? "max-w-3xl rounded-[28px] bg-gray-900 px-5 py-4 text-sm leading-6 text-white shadow-sm"
                      : "w-full max-w-5xl rounded-[28px] border border-gray-200 bg-white p-5 shadow-sm"
                  }
                >
                  {message.role === "user" ? (
                    <p>{message.content}</p>
                  ) : (
                    <AssistantAnswer result={message.result} />
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
