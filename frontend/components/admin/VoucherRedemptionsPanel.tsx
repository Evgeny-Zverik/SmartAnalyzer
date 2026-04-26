"use client";

import { useEffect, useState } from "react";
import { BarChart3, Coins } from "lucide-react";
import { toast } from "sonner";
import {
  listAdminVoucherRedemptions,
  type VoucherRedemption,
} from "@/lib/api/vouchers";
import { parseApiError } from "@/lib/api/errors";

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString("ru-RU", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function VoucherRedemptionsPanel() {
  const [items, setItems] = useState<VoucherRedemption[] | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setLoading(true);
    listAdminVoucherRedemptions()
      .then((res) => setItems(res.items))
      .catch((err) => {
        toast.error(parseApiError(err).message || "Не удалось загрузить логи");
        setItems([]);
      })
      .finally(() => setLoading(false));
  }, []);

  return (
    <section className="mt-6 rounded-3xl border border-zinc-200 bg-white/95 shadow-[0_14px_50px_rgba(15,23,42,0.07)]">
      <div className="flex items-center gap-3 border-b border-zinc-100 px-5 py-4">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-sky-300 bg-sky-100/70 text-sky-700">
          <BarChart3 className="h-5 w-5" />
        </div>
        <div>
          <h2 className="text-lg font-semibold text-zinc-900">
            Логи активаций {items ? `— ${items.length}` : ""}
          </h2>
          <p className="text-xs text-zinc-500">Кто и когда активировал ваучеры</p>
        </div>
      </div>

      {loading ? (
        <p className="px-5 py-10 text-center text-sm text-zinc-500">Загрузка…</p>
      ) : !items || items.length === 0 ? (
        <p className="px-5 py-10 text-center text-sm text-zinc-500">
          Активаций пока нет
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-zinc-100 text-left text-[11px] uppercase tracking-wider text-zinc-500">
                <th className="px-5 py-2 font-semibold">#</th>
                <th className="px-3 py-2 font-semibold">Пользователь</th>
                <th className="px-3 py-2 font-semibold">Код</th>
                <th className="px-3 py-2 font-semibold">Кредиты</th>
                <th className="px-5 py-2 font-semibold">Время</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {items.map((r) => (
                <tr key={r.id} className="hover:bg-zinc-50/70">
                  <td className="px-5 py-3 text-zinc-500 tabular-nums">{r.id}</td>
                  <td className="px-3 py-3 text-zinc-800">{r.user_email}</td>
                  <td className="px-3 py-3">
                    <code className="rounded-md border border-zinc-200 bg-zinc-50 px-2 py-1 text-[12px] font-semibold text-zinc-800">
                      {r.code}
                    </code>
                  </td>
                  <td className="px-3 py-3">
                    <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-semibold text-emerald-700 ring-1 ring-emerald-200">
                      <Coins className="h-3.5 w-3.5" />+
                      {r.credits_granted.toLocaleString("ru-RU")}
                    </span>
                  </td>
                  <td className="px-5 py-3 text-zinc-600">
                    {formatDate(r.created_at)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
