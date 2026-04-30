"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Ticket, X } from "lucide-react";
import { toast } from "sonner";
import { redeemVoucher } from "@/lib/api/vouchers";
import { parseApiError } from "@/lib/api/errors";
import { notifyCreditsChanged } from "@/lib/billing/creditBus";

type Props = {
  open: boolean;
  onClose: () => void;
};

export function RedeemVoucherModal({ open, onClose }: Props) {
  const [code, setCode] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (!open) return;
    setCode("");
    setSubmitting(false);
    const t = setTimeout(() => inputRef.current?.focus(), 60);
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape" && !submitting) onClose();
    }
    document.addEventListener("keydown", handleKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      clearTimeout(t);
      document.removeEventListener("keydown", handleKey);
      document.body.style.overflow = prev;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  if (!open) return null;
  if (typeof document === "undefined") return null;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!code.trim() || submitting) return;
    setSubmitting(true);
    try {
      const res = await redeemVoucher(code.trim());
      toast.success(
        `+${res.credits_granted.toLocaleString("ru-RU")} кр. на баланс`
      );
      notifyCreditsChanged(res.credit_balance);
      onClose();
    } catch (err) {
      toast.error(parseApiError(err).message || "Не удалось активировать ваучер");
      setSubmitting(false);
    }
  }

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget && !submitting) onClose();
      }}
      className="fixed inset-0 z-[1700] flex items-center justify-center bg-[rgba(15,23,42,0.55)] px-4 backdrop-blur-md"
    >
      <div className="w-full max-w-sm overflow-hidden rounded-[28px] border border-stone-200 bg-white shadow-[0_30px_120px_rgba(15,23,42,0.32)]">
        <div className="relative border-b border-amber-100 bg-[radial-gradient(circle_at_top,_rgba(253,224,71,0.28),rgba(255,255,255,0.96)_62%)] px-6 pb-5 pt-6">
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            aria-label="Закрыть"
            className="absolute right-3 top-3 inline-flex h-8 w-8 items-center justify-center rounded-full text-stone-500 transition hover:bg-white hover:text-stone-900 disabled:opacity-50"
          >
            <X className="h-4 w-4" />
          </button>
          <div className="flex items-start gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-2xl border border-amber-200 bg-white text-amber-700 shadow-sm">
              <Ticket className="h-5 w-5" />
            </span>
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-amber-700">
                Ваучер
              </p>
              <h2 className="mt-1 text-xl font-semibold tracking-[-0.02em] text-stone-950">
                Активировать ваучер
              </h2>
              <p className="mt-1 text-[12px] text-stone-600">
                Введите код, чтобы пополнить баланс кредитов
              </p>
            </div>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3 px-6 py-5">
          <input
            ref={inputRef}
            type="text"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            placeholder="XXXX-XXXX-XXXX-XXXX"
            autoComplete="off"
            spellCheck={false}
            className="h-11 w-full rounded-xl border border-stone-200 bg-stone-50 px-3 text-sm font-semibold tracking-wide tabular-nums text-stone-900 outline-none transition focus:border-[#ffd43b] focus:bg-white focus:ring-2 focus:ring-amber-200"
          />
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
              disabled={!code.trim() || submitting}
              className="inline-flex items-center justify-center rounded-xl bg-amber-600 px-4 py-2.5 text-sm font-semibold text-white shadow-[0_10px_24px_-12px_rgba(245,158,11,0.6)] transition hover:bg-amber-700 disabled:opacity-50"
            >
              {submitting ? "Применяем…" : "Применить"}
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body
  );
}
