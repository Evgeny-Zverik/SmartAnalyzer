"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";

type HealthCheck = {
  status: string;
  [key: string]: unknown;
};

type HealthResponse = {
  status: string;
  checked_at: string;
  service?: {
    name?: string;
    version?: string;
    environment?: string;
  };
  checks: Record<string, string | HealthCheck>;
};

type ProbeState = {
  loading: boolean;
  data: HealthResponse | null;
  error: string | null;
  latencyMs: number | null;
};

type RestartState = {
  backend: boolean;
};

const API_BASE_URL =
  (typeof process !== "undefined" && process.env.NEXT_PUBLIC_API_BASE_URL) ||
  "http://localhost:8000";

function normalizeCheck(name: string, value: string | HealthCheck) {
  if (typeof value === "string") {
    return { name, status: value, details: {} as Record<string, unknown> };
  }
  const { status, ...details } = value;
  return { name, status, details };
}

function statusTone(status: string) {
  if (status === "ok") return "bg-emerald-100 text-emerald-800 border-emerald-200";
  if (status === "degraded" || status === "unavailable") {
    return "bg-amber-100 text-amber-800 border-amber-200";
  }
  return "bg-red-100 text-red-800 border-red-200";
}

function statusLabel(status: string) {
  if (status === "ok") return "в норме";
  if (status === "degraded") return "частично";
  if (status === "unavailable") return "недоступно";
  if (status === "down") return "не работает";
  if (status === "checking") return "проверка";
  return status;
}

function formatValue(value: unknown): string {
  if (typeof value === "boolean") return value ? "да" : "нет";
  if (value == null) return "н/д";
  return String(value);
}

export default function StatusPage() {
  const [probe, setProbe] = useState<ProbeState>({
    loading: true,
    data: null,
    error: null,
    latencyMs: null,
  });
  const [restartState, setRestartState] = useState<RestartState>({ backend: false });
  const [actionMessage, setActionMessage] = useState<string | null>(null);

  async function refresh() {
    setProbe((current) => ({ ...current, loading: true, error: null }));
    const startedAt = performance.now();
    try {
      const response = await fetch(`${API_BASE_URL}/health`, { cache: "no-store" });
      if (!response.ok) {
        throw new Error(`Backend returned ${response.status}`);
      }
      const data = (await response.json()) as HealthResponse;
      setProbe({
        loading: false,
        data,
        error: null,
        latencyMs: Math.round(performance.now() - startedAt),
      });
    } catch (error) {
      setProbe({
        loading: false,
        data: null,
        error: error instanceof Error ? error.message : "Unknown error",
        latencyMs: null,
      });
    }
  }

  async function restartBackend() {
    setRestartState((current) => ({ ...current, backend: true }));
    setActionMessage(null);
    try {
      const response = await fetch(`${API_BASE_URL}/system/restart/backend`, {
        method: "POST",
      });
      if (!response.ok) {
        throw new Error(`Backend returned ${response.status}`);
      }
      setActionMessage("Перезапуск backend запрошен. Обновляю статус автоматически.");
      window.setTimeout(() => {
        refresh();
      }, 1500);
    } catch (error) {
      setActionMessage(
        error instanceof Error ? `Не удалось перезапустить backend: ${error.message}` : "Не удалось перезапустить backend."
      );
    } finally {
      window.setTimeout(() => {
        setRestartState((current) => ({ ...current, backend: false }));
      }, 2500);
    }
  }

  useEffect(() => {
    refresh();
    const interval = window.setInterval(refresh, 15000);
    return () => window.clearInterval(interval);
  }, []);

  const checks = probe.data
    ? Object.entries(probe.data.checks).map(([name, value]) => normalizeCheck(name, value))
    : [];

  return (
    <main className="min-h-screen bg-slate-100 px-6 py-10 text-slate-900">
      <div className="mx-auto flex max-w-6xl flex-col gap-6">
        <div className="flex flex-col gap-4 rounded-[28px] border border-slate-200 bg-white/90 p-8 shadow-sm md:flex-row md:items-end md:justify-between">
          <div className="space-y-3">
            <p className="text-xs font-semibold uppercase tracking-[0.3em] text-slate-500">
              Временный мониторинг
            </p>
            <div>
              <h1 className="text-4xl font-bold tracking-tight">Состояние системы</h1>
              <p className="mt-2 max-w-2xl text-sm text-slate-600">
                Живые проверки доступности frontend, backend API, базы данных, хранилища и базовой конфигурации.
              </p>
            </div>
          </div>
          <div className="flex flex-wrap gap-3">
            <Button variant="secondary" href="/dashboard">
              Дашборд
            </Button>
            <Button onClick={refresh} disabled={probe.loading}>
              {probe.loading ? "Обновление..." : "Обновить"}
            </Button>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          <Card className="rounded-[24px] border-slate-200 bg-slate-950 text-white shadow-lg shadow-slate-300/30 hover:shadow-lg">
            <p className="text-xs uppercase tracking-[0.3em] text-slate-400">Frontend</p>
            <p className="mt-4 text-3xl font-semibold">Онлайн</p>
            <p className="mt-2 text-sm text-slate-300">Эта страница уже открылась в браузере.</p>
          </Card>
          <Card className="rounded-[24px] border-slate-200 bg-white hover:shadow-md">
            <p className="text-xs uppercase tracking-[0.3em] text-slate-500">Backend</p>
            <p className="mt-4 text-3xl font-semibold">
              {statusLabel(probe.data?.status ?? (probe.error ? "down" : "checking"))}
            </p>
            <p className="mt-2 text-sm text-slate-600">
              {probe.latencyMs != null ? `${probe.latencyMs} мс время ответа` : "Ожидание проверки"}
            </p>
          </Card>
          <Card className="rounded-[24px] border-slate-200 bg-white hover:shadow-md">
            <p className="text-xs uppercase tracking-[0.3em] text-slate-500">Эндпоинт</p>
            <p className="mt-4 break-all text-sm font-medium text-slate-800">{API_BASE_URL}/health</p>
            <p className="mt-2 text-sm text-slate-600">
              {probe.data?.checked_at
                ? `Последняя проверка: ${new Date(probe.data.checked_at).toLocaleString()}`
                : "Успешных проверок пока не было"}
            </p>
          </Card>
        </div>

        {probe.error ? (
          <Alert variant="error" className="rounded-2xl">
            Проверка backend завершилась ошибкой: {probe.error}
          </Alert>
        ) : null}

        {actionMessage ? (
          <Alert variant="info" className="rounded-2xl">
            {actionMessage}
          </Alert>
        ) : null}

        {probe.data ? (
          <>
            <div className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
              <Card className="rounded-[24px] border-slate-200 bg-white">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <p className="text-xs uppercase tracking-[0.3em] text-slate-500">Проверки</p>
                    <h2 className="mt-2 text-2xl font-semibold">Подсистемы</h2>
                  </div>
                  <span
                    className={`rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-wide ${statusTone(
                      probe.data.status
                    )}`}
                  >
                    {statusLabel(probe.data.status)}
                  </span>
                </div>
                <div className="mt-6 grid gap-4 md:grid-cols-2">
                  {checks.map((check) => (
                    <div
                      key={check.name}
                      className="rounded-2xl border border-slate-200 bg-slate-50 p-4"
                    >
                      <div className="flex items-center justify-between gap-3">
                        <h3 className="text-base font-semibold capitalize">
                          {check.name === "api"
                            ? "API"
                            : check.name === "database"
                              ? "База данных"
                              : check.name === "storage"
                                ? "Хранилище"
                                : check.name === "configuration"
                                  ? "Конфигурация"
                                  : check.name.replaceAll("_", " ")}
                        </h3>
                        <span
                          className={`rounded-full border px-2.5 py-1 text-xs font-semibold uppercase ${statusTone(
                            check.status
                          )}`}
                        >
                          {statusLabel(check.status)}
                        </span>
                      </div>
                      <dl className="mt-4 space-y-2 text-sm text-slate-600">
                        {Object.entries(check.details).map(([key, value]) => (
                          <div key={key} className="flex items-start justify-between gap-4">
                            <dt className="capitalize text-slate-500">
                              {key === "path"
                                ? "Путь"
                                : key === "exists"
                                  ? "Существует"
                                  : key === "writable"
                                    ? "Доступ на запись"
                                    : key === "environment"
                                      ? "Окружение"
                                      : key === "jwt_configured"
                                        ? "JWT настроен"
                                        : key === "openai_configured"
                                          ? "OpenAI настроен"
                                          : key === "max_upload_bytes"
                                            ? "Лимит загрузки"
                                            : key === "model"
                                              ? "Модель"
                                              : key.replaceAll("_", " ")}
                            </dt>
                            <dd className="max-w-[60%] break-all text-right text-slate-800">
                              {formatValue(value)}
                            </dd>
                          </div>
                        ))}
                      </dl>
                    </div>
                  ))}
                </div>
              </Card>

              <Card className="rounded-[24px] border-slate-200 bg-white">
                <p className="text-xs uppercase tracking-[0.3em] text-slate-500">Сервис</p>
                <h2 className="mt-2 text-2xl font-semibold">Метаданные</h2>
                <dl className="mt-6 space-y-4 text-sm">
                  <div className="flex items-start justify-between gap-4">
                    <dt className="text-slate-500">Сервис</dt>
                    <dd className="text-right font-medium text-slate-900">
                      {probe.data.service?.name ?? "SmartAnalyzer"}
                    </dd>
                  </div>
                  <div className="flex items-start justify-between gap-4">
                    <dt className="text-slate-500">Версия</dt>
                    <dd className="text-right font-medium text-slate-900">
                      {probe.data.service?.version ?? "н/д"}
                    </dd>
                  </div>
                  <div className="flex items-start justify-between gap-4">
                    <dt className="text-slate-500">Окружение</dt>
                    <dd className="text-right font-medium text-slate-900">
                      {probe.data.service?.environment ?? "н/д"}
                    </dd>
                  </div>
                  <div className="flex items-start justify-between gap-4">
                    <dt className="text-slate-500">Маршрут frontend</dt>
                    <dd className="text-right font-medium text-slate-900">/status</dd>
                  </div>
                  <div className="flex items-start justify-between gap-4">
                    <dt className="text-slate-500">Автообновление</dt>
                    <dd className="text-right font-medium text-slate-900">15 сек</dd>
                  </div>
                </dl>

                <div className="mt-8 rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-4 text-sm text-slate-600">
                  Это временная техническая панель для локального окружения. Здесь показываются
                  публичные системные проверки. Прикладные проверки с авторизацией остаются в
                  основных экранах.
                </div>

                <div className="mt-6">
                  <Link href="/" className="text-sm font-medium text-emerald-700 hover:text-emerald-800">
                    На главную
                  </Link>
                </div>
              </Card>
            </div>

            <Card className="rounded-[24px] border-slate-200 bg-white">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="text-xs uppercase tracking-[0.3em] text-slate-500">Управление</p>
                  <h2 className="mt-2 text-2xl font-semibold">Перезапуск систем</h2>
                </div>
              </div>

              <div className="mt-6 grid gap-4 md:grid-cols-3">
                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <h3 className="text-base font-semibold text-slate-900">Backend API</h3>
                  <p className="mt-2 text-sm text-slate-600">
                    Можно перезапустить прямо с этой страницы. Подходит для временного локального мониторинга.
                  </p>
                  <Button
                    className="mt-4 w-full"
                    onClick={restartBackend}
                    disabled={restartState.backend}
                  >
                    {restartState.backend ? "Перезапуск..." : "Перезапустить backend"}
                  </Button>
                </div>

                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <h3 className="text-base font-semibold text-slate-900">Frontend</h3>
                  <p className="mt-2 text-sm text-slate-600">
                    Из браузера безопасный перезапуск недоступен. Его нужно перезапускать из dev-процесса.
                  </p>
                  <Button className="mt-4 w-full" disabled>
                    Перезапуск недоступен
                  </Button>
                </div>

                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <h3 className="text-base font-semibold text-slate-900">База данных</h3>
                  <p className="mt-2 text-sm text-slate-600">
                    Для SQLite в этом режиме доступна только проверка состояния. Перезапуск как отдельного сервиса не применим.
                  </p>
                  <Button className="mt-4 w-full" disabled>
                    Только мониторинг
                  </Button>
                </div>
              </div>
            </Card>
          </>
        ) : (
          <Card className="rounded-[24px] border-slate-200 bg-white">
            <p className="text-sm text-slate-600">
              Данные ещё не загружены. Нажми «Обновить», чтобы повторить проверку.
            </p>
          </Card>
        )}
      </div>
    </main>
  );
}
