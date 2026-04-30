"use client";

import { Coins } from "lucide-react";

type CreditCostHintProps = {
  credits: number | null;
  balance?: number | null;
  label?: string;
  compact?: boolean;
  tone?: "light" | "dark";
  phase?: "idle" | "running" | "success";
};

export function CreditCostHint({
  credits,
  balance,
  label = "Спишется от",
  compact = false,
  tone = "light",
  phase = "idle",
}: CreditCostHintProps) {
  const isDark = tone === "dark";
  const creditLabel = credits == null ? "—" : credits.toLocaleString("ru-RU");
  const balanceLabel = balance == null ? null : balance.toLocaleString("ru-RU");
  const phaseLabel =
    phase === "running" ? "Резервируем" : phase === "success" ? "Списано" : label;
  const amountPrefix = phase === "running" || phase === "success" ? "−" : "";

  return (
    <div
      aria-live="polite"
      className={`inline-flex min-w-0 items-center gap-2 rounded-xl border px-3 py-2 text-xs transition-[transform,background-color,border-color,opacity] duration-200 ease-out ${
        isDark
          ? "border-amber-300/30 bg-amber-400/10 text-amber-100"
          : "border-amber-200 bg-amber-50 text-amber-800"
      } ${
        phase === "running"
          ? isDark
            ? "scale-[1.02] border-amber-300/45 bg-amber-300/12 text-amber-100"
            : "scale-[1.02] border-amber-200 bg-amber-50 text-amber-800"
          : ""
      } ${
        phase === "success"
          ? isDark
            ? "border-amber-300/55 bg-amber-300/16"
            : "border-amber-300 bg-amber-100"
          : ""
      }`}
      title={
        credits == null
          ? "Минимальная стоимость пока не загружена"
          : `Минимальное списание: ${creditLabel} кредитов. Для больших документов итог может вырасти по фактическим токенам.`
      }
    >
      <Coins
        className={`h-4 w-4 shrink-0 transition-transform duration-300 ease-out ${
          phase === "running" ? "-translate-y-0.5 animate-pulse" : ""
        } ${
          phase === "success" ? "translate-y-0 scale-110" : ""
        } ${isDark ? "text-amber-200" : "text-amber-600"}`}
      />
      <span className="min-w-0">
        <span className={isDark ? "text-amber-100/80" : "text-amber-700"}>
          {phaseLabel}
        </span>{" "}
        <span className="font-semibold tabular-nums transition-transform duration-200 ease-out">
          {amountPrefix}
          {creditLabel}
        </span>{" "}
        <span>{compact ? "кр." : "кредитов"}</span>
        {!compact && balanceLabel ? (
          <>
            <span className={isDark ? "mx-1.5 text-white/25" : "mx-1.5 text-amber-300"}>•</span>
            <span className={isDark ? "text-amber-100/75" : "text-amber-700/80"}>
              баланс {balanceLabel}
            </span>
          </>
        ) : null}
      </span>
    </div>
  );
}
