"use client";

import { useEffect, useRef, useState } from "react";
import { Dices, Ticket, X } from "lucide-react";
import { toast } from "sonner";
import { createAdminVoucher, type Voucher } from "@/lib/api/vouchers";
import { parseApiError } from "@/lib/api/errors";

const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

function generateCode(): string {
  const part = () =>
    Array.from({ length: 4 }, () =>
      ALPHABET[Math.floor(Math.random() * ALPHABET.length)]
    ).join("");
  return `${part()}-${part()}-${part()}-${part()}`;
}

type Props = {
  onClose: () => void;
  onCreated: (v: Voucher) => void;
};

export function CreateVoucherModal({ onClose, onCreated }: Props) {
  const [code, setCode] = useState("");
  const [credits, setCredits] = useState("1000");
  const [usageLimit, setUsageLimit] = useState("1");
  const [validFrom, setValidFrom] = useState("");
  const [validUntil, setValidUntil] = useState("");
  const [boundEmail, setBoundEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const codeRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape" && !submitting) onClose();
    }
    document.addEventListener("keydown", handleKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", handleKey);
      document.body.style.overflow = prev;
    };
  }, [submitting, onClose]);

  const creditsNum = parseInt(credits, 10);
  const limitNum = parseInt(usageLimit, 10);
  const valid =
    Number.isFinite(creditsNum) &&
    creditsNum > 0 &&
    Number.isFinite(limitNum) &&
    limitNum > 0;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!valid || submitting) return;
    setSubmitting(true);
    try {
      const v = await createAdminVoucher({
        code: code.trim() || null,
        credits: creditsNum,
        usage_limit: limitNum,
        valid_from: validFrom ? new Date(validFrom).toISOString() : null,
        valid_until: validUntil ? new Date(validUntil).toISOString() : null,
        bound_user_email: boundEmail.trim() || null,
      });
      toast.success(`Ваучер ${v.code} создан`);
      onCreated(v);
    } catch (err) {
      toast.error(parseApiError(err).message || "Не удалось создать");
      setSubmitting(false);
    }
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget && !submitting) onClose();
      }}
      className="fixed inset-0 z-[1700] flex items-center justify-center bg-[rgba(15,23,42,0.55)] px-4 backdrop-blur-md"
    >
      <div className="w-full max-w-xl overflow-hidden rounded-[28px] border border-stone-200 bg-white shadow-[0_30px_120px_rgba(15,23,42,0.32)]">
        <div className="relative border-b border-amber-100 bg-[#fff7cc] px-6 pb-5 pt-6">
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
            <span className="flex h-10 w-10 items-center justify-center rounded-[24px] border border-amber-200 bg-white text-amber-700 shadow-sm">
              <Ticket className="h-5 w-5" />
            </span>
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-amber-700">
                Новый ваучер
              </p>
              <h2 className="mt-1 text-2xl font-semibold tracking-[-0.03em] text-stone-950">
                Создание ваучера
              </h2>
            </div>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="grid gap-4 px-6 py-5 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <label className="block text-[11px] font-semibold uppercase tracking-[0.16em] text-stone-500">
              Код
            </label>
            <div className="mt-1.5 flex items-center gap-2">
              <input
                ref={codeRef}
                type="text"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                placeholder="XXXX-XXXX-XXXX-XXXX (или оставьте пустым)"
                className="h-11 w-full rounded-[18px] border border-stone-200 bg-white px-3 font-semibold tabular-nums text-stone-900 outline-none transition focus:border-amber-400 focus:ring-2 focus:ring-amber-200"
              />
              <button
                type="button"
                onClick={() => setCode(generateCode())}
                title="Сгенерировать"
                className="inline-flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-[18px] border border-stone-200 bg-white text-stone-600 transition hover:border-amber-300 hover:text-amber-700"
              >
                <Dices className="h-5 w-5" />
              </button>
            </div>
          </div>

          <div>
            <label className="block text-[11px] font-semibold uppercase tracking-[0.16em] text-stone-500">
              Кредиты на баланс
            </label>
            <input
              type="number"
              min={1}
              value={credits}
              onChange={(e) => setCredits(e.target.value)}
              className="mt-1.5 h-11 w-full rounded-[18px] border border-stone-200 bg-white px-3 font-semibold tabular-nums text-stone-900 outline-none transition focus:border-amber-400 focus:ring-2 focus:ring-amber-200"
            />
          </div>

          <div>
            <label className="block text-[11px] font-semibold uppercase tracking-[0.16em] text-stone-500">
              Лимит активаций
            </label>
            <input
              type="number"
              min={1}
              value={usageLimit}
              onChange={(e) => setUsageLimit(e.target.value)}
              className="mt-1.5 h-11 w-full rounded-[18px] border border-stone-200 bg-white px-3 font-semibold tabular-nums text-stone-900 outline-none transition focus:border-amber-400 focus:ring-2 focus:ring-amber-200"
            />
          </div>

          <div>
            <label className="block text-[11px] font-semibold uppercase tracking-[0.16em] text-stone-500">
              Начало действия
            </label>
            <input
              type="datetime-local"
              value={validFrom}
              onChange={(e) => setValidFrom(e.target.value)}
              className="mt-1.5 h-11 w-full rounded-[18px] border border-stone-200 bg-white px-3 text-sm text-stone-900 outline-none transition focus:border-amber-400 focus:ring-2 focus:ring-amber-200"
            />
          </div>

          <div>
            <label className="block text-[11px] font-semibold uppercase tracking-[0.16em] text-stone-500">
              Конец действия
            </label>
            <input
              type="datetime-local"
              value={validUntil}
              onChange={(e) => setValidUntil(e.target.value)}
              className="mt-1.5 h-11 w-full rounded-[18px] border border-stone-200 bg-white px-3 text-sm text-stone-900 outline-none transition focus:border-amber-400 focus:ring-2 focus:ring-amber-200"
            />
          </div>

          <div className="sm:col-span-2">
            <label className="block text-[11px] font-semibold uppercase tracking-[0.16em] text-stone-500">
              Привязка к пользователю{" "}
              <span className="font-normal lowercase tracking-normal text-stone-400">
                (email — необязательно)
              </span>
            </label>
            <input
              type="email"
              value={boundEmail}
              onChange={(e) => setBoundEmail(e.target.value)}
              placeholder="user@example.com"
              className="mt-1.5 h-11 w-full rounded-[18px] border border-stone-200 bg-white px-3 text-sm text-stone-900 outline-none transition focus:border-amber-400 focus:ring-2 focus:ring-amber-200"
            />
          </div>

          <div className="flex justify-end gap-2 pt-1 sm:col-span-2">
            <button
              type="button"
              onClick={onClose}
              disabled={submitting}
              className="rounded-[18px] border border-stone-200 bg-white px-4 py-2.5 text-sm font-semibold text-stone-700 transition hover:bg-stone-50 disabled:opacity-50"
            >
              Отмена
            </button>
            <button
              type="submit"
              disabled={!valid || submitting}
              className="inline-flex items-center justify-center gap-2 rounded-[18px] bg-[#ffd43b] px-4 py-2.5 text-sm font-semibold text-stone-950 shadow-[0_10px_24px_-12px_rgba(245,158,11,0.6)] transition hover:bg-[#f6c343] disabled:opacity-50"
            >
              {submitting ? "Создаём…" : "Создать"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
