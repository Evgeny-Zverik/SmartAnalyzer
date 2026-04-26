"use client";

import Link from "next/link";
import { useEffect } from "react";
import { Coins, Sparkles, X } from "lucide-react";

type InsufficientCreditsModalProps = {
  open: boolean;
  required: number | null;
  balance: number | null;
  toolName?: string;
  onClose: () => void;
};

export function InsufficientCreditsModal({
  open,
  required,
  balance,
  toolName,
  onClose,
}: InsufficientCreditsModalProps) {
  useEffect(() => {
    if (!open) return;
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", handleKey);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", handleKey);
      document.body.style.overflow = previousOverflow;
    };
  }, [open, onClose]);

  if (!open) return null;

  const requiredKnown = typeof required === "number" && required > 0;
  const balanceKnown = typeof balance === "number" && balance >= 0;
  const missing =
    requiredKnown && balanceKnown ? Math.max(0, required - balance) : null;

  const fmt = (value: number) => value.toLocaleString("ru-RU");
  const headline = toolName
    ? `Не хватает кредитов для «${toolName}»`
    : "Не хватает кредитов для запуска";

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-live="assertive"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
      className="fixed inset-0 z-[1600] flex items-center justify-center bg-[rgba(15,23,42,0.55)] px-4 backdrop-blur-md"
    >
      <div className="w-full max-w-md origin-center animate-[avatar-menu-in_220ms_cubic-bezier(0.16,1,0.3,1)] overflow-hidden rounded-[28px] border border-stone-200 bg-white shadow-[0_30px_120px_rgba(15,23,42,0.32)]">
        <div className="relative overflow-hidden border-b border-amber-100 bg-[radial-gradient(circle_at_top,_rgba(252,211,77,0.32),rgba(255,255,255,0.96)_62%)] px-6 pb-5 pt-6">
          <span className="pointer-events-none absolute -right-12 -top-12 h-32 w-32 rounded-full bg-amber-200/50 blur-3xl" />
          <button
            type="button"
            onClick={onClose}
            aria-label="Закрыть"
            className="absolute right-3 top-3 inline-flex h-8 w-8 items-center justify-center rounded-full text-stone-500 transition hover:bg-white hover:text-stone-900"
          >
            <X className="h-4 w-4" />
          </button>
          <div className="relative flex items-start gap-3">
            <span className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-2xl border border-amber-200 bg-white text-amber-700 shadow-sm">
              <Coins className="h-5 w-5" />
            </span>
            <div className="min-w-0">
              <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-amber-700">
                Недостаточно кредитов
              </p>
              <h2 className="mt-1 text-2xl font-semibold tracking-[-0.03em] text-stone-950">
                {headline}
              </h2>
              <p className="mt-1.5 text-[13.5px] leading-relaxed text-stone-600">
                Каждый запуск AI‑анализа списывает кредиты пропорционально
                размеру документа и включённым плагинам. Пополните баланс — и
                продолжите ровно с того места, где остановились: загруженный
                документ и настройки сохранятся.
              </p>
            </div>
          </div>
        </div>

        <div className="space-y-4 px-6 py-5">
          {requiredKnown || balanceKnown ? (
            <div className="grid gap-2 sm:grid-cols-3">
              {requiredKnown ? (
                <Stat label="Требуется" value={`${fmt(required!)} кр.`} tone="primary" />
              ) : null}
              {balanceKnown ? (
                <Stat label="На балансе" value={`${fmt(balance!)} кр.`} tone="muted" />
              ) : null}
              {missing != null && missing > 0 ? (
                <Stat label="Не хватает" value={`${fmt(missing)} кр.`} tone="danger" />
              ) : null}
            </div>
          ) : null}

          <div className="flex flex-col gap-2 pt-1 sm:flex-row sm:items-center">
            <Link
              href="/pricing"
              onClick={onClose}
              className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl bg-stone-900 px-4 py-2.5 text-sm font-semibold text-white shadow-[0_12px_30px_-12px_rgba(15,23,42,0.6)] transition hover:bg-emerald-600 hover:shadow-[0_14px_34px_-10px_rgba(16,185,129,0.55)]"
            >
              <Sparkles className="h-4 w-4" />
              Пополнить баланс
            </Link>
            <button
              type="button"
              onClick={onClose}
              className="inline-flex items-center justify-center rounded-xl border border-stone-200 bg-white px-4 py-2.5 text-sm font-semibold text-stone-700 transition hover:bg-stone-50"
            >
              Закрыть
            </button>
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
      ? "border-amber-200 bg-amber-50 text-amber-900"
      : tone === "danger"
      ? "border-rose-200 bg-rose-50 text-rose-700"
      : "border-stone-200 bg-stone-50 text-stone-700";
  return (
    <div className={`rounded-2xl border ${toneClass} px-3 py-2`}>
      <div className="text-[10px] font-semibold uppercase tracking-[0.16em] opacity-70">
        {label}
      </div>
      <div className="mt-0.5 text-sm font-semibold tabular-nums">{value}</div>
    </div>
  );
}
