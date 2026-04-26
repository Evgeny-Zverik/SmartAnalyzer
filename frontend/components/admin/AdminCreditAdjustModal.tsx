"use client";

import { useEffect, useRef, useState } from "react";
import { Coins, Minus, Plus, X } from "lucide-react";
import { toast } from "sonner";
import { adjustAdminUserCredits } from "@/lib/api/admin";
import { parseApiError } from "@/lib/api/errors";

type AdminCreditAdjustModalProps = {
  user: {
    id: number;
    email: string;
    credit_balance: number;
  } | null;
  onClose: () => void;
  onAdjusted: (userId: number, newBalance: number) => void;
};

const QUICK_GRANTS = [100, 500, 1_000, 5_000];

export function AdminCreditAdjustModal({
  user,
  onClose,
  onAdjusted,
}: AdminCreditAdjustModalProps) {
  const [direction, setDirection] = useState<"grant" | "debit">("grant");
  const [amountInput, setAmountInput] = useState("");
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (!user) return;
    setDirection("grant");
    setAmountInput("");
    setReason("");
    setSubmitting(false);
    const t = setTimeout(() => inputRef.current?.focus(), 60);
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape" && !submitting) onClose();
    }
    document.addEventListener("keydown", handleKey);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      clearTimeout(t);
      document.removeEventListener("keydown", handleKey);
      document.body.style.overflow = previousOverflow;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  if (!user) return null;

  const parsedAmount = parseInt(amountInput.replace(/\s/g, ""), 10);
  const amountValid = Number.isFinite(parsedAmount) && parsedAmount > 0;
  const signedAmount = amountValid ? (direction === "grant" ? parsedAmount : -parsedAmount) : 0;
  const projectedBalance = user.credit_balance + signedAmount;
  const wouldGoNegative = direction === "debit" && projectedBalance < 0;
  const canSubmit = amountValid && !wouldGoNegative && !submitting;

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!canSubmit || !user) return;
    setSubmitting(true);
    try {
      const trimmedReason = reason.trim() || undefined;
      const res = await adjustAdminUserCredits(user.id, signedAmount, trimmedReason);
      onAdjusted(res.user_id, res.credit_balance);
      const verb = signedAmount > 0 ? "Начислено" : "Списано";
      const absLabel = Math.abs(signedAmount).toLocaleString("ru-RU");
      toast.success(`${verb} ${absLabel} кр. → ${user.email}. Новый баланс: ${res.credit_balance.toLocaleString("ru-RU")}.`);
      onClose();
    } catch (err) {
      toast.error(parseApiError(err).message || "Не удалось изменить баланс");
      setSubmitting(false);
    }
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !submitting) onClose();
      }}
      className="fixed inset-0 z-[1700] flex items-center justify-center bg-[rgba(15,23,42,0.55)] px-4 backdrop-blur-md"
    >
      <div className="w-full max-w-md origin-center animate-[avatar-menu-in_220ms_cubic-bezier(0.16,1,0.3,1)] overflow-hidden rounded-[28px] border border-stone-200 bg-white shadow-[0_30px_120px_rgba(15,23,42,0.32)]">
        <div className="relative overflow-hidden border-b border-emerald-100 bg-[radial-gradient(circle_at_top,_rgba(110,231,183,0.28),rgba(255,255,255,0.96)_62%)] px-6 pb-5 pt-6">
          <span className="pointer-events-none absolute -right-12 -top-12 h-32 w-32 rounded-full bg-emerald-200/40 blur-3xl" />
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            aria-label="Закрыть"
            className="absolute right-3 top-3 inline-flex h-8 w-8 items-center justify-center rounded-full text-stone-500 transition hover:bg-white hover:text-stone-900 disabled:opacity-50"
          >
            <X className="h-4 w-4" />
          </button>
          <div className="relative flex items-start gap-3">
            <span className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-2xl border border-emerald-200 bg-white text-emerald-700 shadow-sm">
              <Coins className="h-5 w-5" />
            </span>
            <div className="min-w-0">
              <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-emerald-700">
                Корректировка баланса
              </p>
              <h2 className="mt-1 text-2xl font-semibold tracking-[-0.03em] text-stone-950">
                {user.email}
              </h2>
              <p className="mt-1.5 text-[13px] text-stone-600">
                Текущий баланс:{" "}
                <span className="font-semibold tabular-nums text-stone-900">
                  {user.credit_balance.toLocaleString("ru-RU")}
                </span>{" "}
                кр. · ID #{user.id}
              </p>
            </div>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 px-6 py-5">
          <div className="grid grid-cols-2 gap-2 rounded-2xl border border-stone-200 bg-stone-50 p-1">
            <button
              type="button"
              onClick={() => setDirection("grant")}
              className={`inline-flex items-center justify-center gap-1.5 rounded-xl px-3 py-2 text-sm font-semibold transition ${
                direction === "grant"
                  ? "bg-emerald-600 text-white shadow"
                  : "text-stone-600 hover:bg-white"
              }`}
            >
              <Plus className="h-4 w-4" /> Начислить
            </button>
            <button
              type="button"
              onClick={() => setDirection("debit")}
              className={`inline-flex items-center justify-center gap-1.5 rounded-xl px-3 py-2 text-sm font-semibold transition ${
                direction === "debit"
                  ? "bg-rose-600 text-white shadow"
                  : "text-stone-600 hover:bg-white"
              }`}
            >
              <Minus className="h-4 w-4" /> Списать
            </button>
          </div>

          <div>
            <label className="block text-[11px] font-semibold uppercase tracking-[0.16em] text-stone-500">
              Количество кредитов
            </label>
            <div className="mt-1.5 flex items-center gap-2">
              <input
                ref={inputRef}
                type="number"
                min={1}
                step={1}
                inputMode="numeric"
                value={amountInput}
                onChange={(e) => setAmountInput(e.target.value)}
                placeholder="например, 1000"
                className="h-11 w-full rounded-xl border border-stone-200 bg-white px-3 text-base font-semibold tabular-nums text-stone-900 outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-200"
              />
            </div>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {QUICK_GRANTS.map((value) => (
                <button
                  type="button"
                  key={value}
                  onClick={() => setAmountInput(String(value))}
                  className="rounded-full border border-stone-200 bg-white px-2.5 py-0.5 text-xs font-medium text-stone-600 transition hover:border-emerald-300 hover:text-emerald-700"
                >
                  {value.toLocaleString("ru-RU")}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-[11px] font-semibold uppercase tracking-[0.16em] text-stone-500">
              Причина <span className="font-normal lowercase tracking-normal text-stone-400">(необязательно)</span>
            </label>
            <input
              type="text"
              value={reason}
              maxLength={200}
              onChange={(e) => setReason(e.target.value)}
              placeholder="например, компенсация ошибки"
              className="mt-1.5 h-11 w-full rounded-xl border border-stone-200 bg-white px-3 text-sm text-stone-900 outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-200"
            />
          </div>

          {amountValid ? (
            <div
              className={`rounded-2xl border px-3 py-2.5 text-sm ${
                wouldGoNegative
                  ? "border-rose-200 bg-rose-50 text-rose-700"
                  : direction === "grant"
                  ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                  : "border-amber-200 bg-amber-50 text-amber-800"
              }`}
            >
              {wouldGoNegative ? (
                <>Баланс уйдёт в минус ({projectedBalance.toLocaleString("ru-RU")}). Уменьшите сумму.</>
              ) : (
                <>
                  После операции баланс:{" "}
                  <span className="font-semibold tabular-nums">
                    {projectedBalance.toLocaleString("ru-RU")} кр.
                  </span>{" "}
                  ({signedAmount > 0 ? "+" : ""}
                  {signedAmount.toLocaleString("ru-RU")})
                </>
              )}
            </div>
          ) : null}

          <div className="flex justify-end gap-2 pt-1">
            <button
              type="button"
              onClick={onClose}
              disabled={submitting}
              className="rounded-xl border border-stone-200 bg-white px-4 py-2.5 text-sm font-semibold text-stone-700 transition hover:bg-stone-50 disabled:opacity-50"
            >
              Отмена
            </button>
            <button
              type="submit"
              disabled={!canSubmit}
              className={`inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold text-white transition disabled:opacity-50 ${
                direction === "grant"
                  ? "bg-emerald-600 shadow-[0_10px_24px_-12px_rgba(16,185,129,0.6)] hover:bg-emerald-700"
                  : "bg-rose-600 shadow-[0_10px_24px_-12px_rgba(225,29,72,0.5)] hover:bg-rose-700"
              }`}
            >
              {direction === "grant" ? <Plus className="h-4 w-4" /> : <Minus className="h-4 w-4" />}
              {submitting
                ? "Применяем…"
                : direction === "grant"
                ? "Начислить"
                : "Списать"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
