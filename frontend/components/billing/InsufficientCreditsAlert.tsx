"use client";

import Link from "next/link";
import { Coins, Sparkles, X } from "lucide-react";

type InsufficientCreditsAlertProps = {
  required: number | null;
  balance: number | null;
  toolName?: string;
  onDismiss?: () => void;
};

export function InsufficientCreditsAlert({
  required,
  balance,
  toolName,
  onDismiss,
}: InsufficientCreditsAlertProps) {
  const requiredKnown = typeof required === "number" && required > 0;
  const balanceKnown = typeof balance === "number" && balance >= 0;
  const missing =
    requiredKnown && balanceKnown ? Math.max(0, required - balance) : null;

  const fmt = (value: number) => value.toLocaleString("ru-RU");
  const headline = toolName
    ? `Не хватает кредитов для запуска «${toolName}»`
    : "Не хватает кредитов для запуска инструмента";

  return (
    <div
      role="alert"
      aria-live="assertive"
      className="relative overflow-hidden rounded-3xl border border-amber-200 bg-[radial-gradient(circle_at_top_left,#fff7e6,#fff1d6_55%,#fde6c8)] p-5 shadow-[0_22px_60px_-30px_rgba(217,119,6,0.45)] sm:p-6"
    >
      <div className="pointer-events-none absolute -right-10 -top-10 h-44 w-44 rounded-full bg-amber-300/40 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-12 -left-8 h-44 w-44 rounded-full bg-orange-300/30 blur-3xl" />

      {onDismiss ? (
        <button
          type="button"
          onClick={onDismiss}
          aria-label="Закрыть"
          className="absolute right-3 top-3 inline-flex h-8 w-8 items-center justify-center rounded-full text-amber-700/70 transition hover:bg-amber-200/60 hover:text-amber-900"
        >
          <X className="h-4 w-4" />
        </button>
      ) : null}

      <div className="relative flex flex-col gap-4 sm:flex-row sm:items-start">
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-amber-300 bg-white text-amber-600 shadow-[0_10px_24px_-12px_rgba(217,119,6,0.6)]">
          <Coins className="h-6 w-6" />
        </div>

        <div className="min-w-0 flex-1">
          <h3 className="text-base font-semibold text-amber-950 sm:text-lg">
            {headline}
          </h3>
          <p className="mt-1.5 text-sm leading-6 text-amber-900/85">
            Каждый запуск AI‑анализа списывает кредиты пропорционально размеру
            документа и включённым плагинам. Пополните баланс — и продолжите
            ровно с того места, где остановились: загруженный документ и
            настройки сохранятся.
          </p>

          {requiredKnown || balanceKnown ? (
            <div className="mt-4 grid gap-2 sm:grid-cols-3">
              {requiredKnown ? (
                <Stat label="Требуется" value={`${fmt(required!)} кр.`} tone="primary" />
              ) : null}
              {balanceKnown ? (
                <Stat label="Сейчас на балансе" value={`${fmt(balance!)} кр.`} tone="muted" />
              ) : null}
              {missing != null && missing > 0 ? (
                <Stat label="Не хватает" value={`${fmt(missing)} кр.`} tone="danger" />
              ) : null}
            </div>
          ) : null}

          <div className="mt-5 flex flex-col gap-2 sm:flex-row sm:items-center">
            <Link
              href="/pricing"
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-stone-900 px-4 py-2.5 text-sm font-semibold text-white shadow-[0_12px_30px_-12px_rgba(15,23,42,0.6)] transition hover:bg-emerald-600 hover:shadow-[0_14px_34px_-10px_rgba(16,185,129,0.55)]"
            >
              <Sparkles className="h-4 w-4" />
              Пополнить баланс
            </Link>
            <Link
              href="/pricing#plans"
              className="inline-flex items-center justify-center gap-1 rounded-xl border border-amber-300 bg-white/70 px-4 py-2.5 text-sm font-semibold text-amber-900 transition hover:bg-white"
            >
              Посмотреть тарифы
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

function Stat({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone: "primary" | "muted" | "danger";
}) {
  const toneClass =
    tone === "primary"
      ? "border-amber-300 bg-white text-amber-900"
      : tone === "danger"
      ? "border-rose-300 bg-white text-rose-700"
      : "border-amber-200/70 bg-white/70 text-amber-900/80";
  return (
    <div className={`rounded-2xl border ${toneClass} px-3 py-2`}>
      <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-amber-700/70">
        {label}
      </div>
      <div className="mt-0.5 text-sm font-semibold tabular-nums">{value}</div>
    </div>
  );
}
