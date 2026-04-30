"use client";

import { useState } from "react";
import { Ticket } from "lucide-react";
import { toast } from "sonner";
import { redeemVoucher } from "@/lib/api/vouchers";
import { parseApiError } from "@/lib/api/errors";
import { notifyCreditsChanged } from "@/lib/billing/creditBus";

type Props = {
  onRedeemed?: (newBalance: number) => void;
};

export function RedeemVoucherCard({ onRedeemed }: Props) {
  const [code, setCode] = useState("");
  const [submitting, setSubmitting] = useState(false);

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
      onRedeemed?.(res.credit_balance);
      setCode("");
    } catch (err) {
      toast.error(parseApiError(err).message || "Не удалось активировать ваучер");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="rounded-2xl border border-stone-200 bg-white p-5">
      <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-stone-500">
        <Ticket className="h-3.5 w-3.5" />
        Активировать ваучер
      </div>
      <p className="mt-1 text-xs text-stone-500">
        Введите код, чтобы пополнить баланс кредитов
      </p>
      <form onSubmit={handleSubmit} className="mt-3 flex gap-2">
        <input
          type="text"
          value={code}
          onChange={(e) => setCode(e.target.value)}
          placeholder="XXXX-XXXX-XXXX-XXXX"
          autoComplete="off"
          spellCheck={false}
          className="h-10 flex-1 rounded-xl border border-stone-200 bg-stone-50 px-3 text-sm font-semibold tracking-wide tabular-nums text-stone-900 outline-none transition focus:border-[#ffd43b] focus:bg-white focus:ring-2 focus:ring-amber-200"
        />
        <button
          type="submit"
          disabled={!code.trim() || submitting}
          className="inline-flex items-center justify-center rounded-xl bg-amber-600 px-4 text-sm font-semibold text-white shadow-[0_10px_24px_-12px_rgba(245,158,11,0.6)] transition hover:bg-amber-700 disabled:opacity-50"
        >
          {submitting ? "…" : "Применить"}
        </button>
      </form>
    </div>
  );
}
