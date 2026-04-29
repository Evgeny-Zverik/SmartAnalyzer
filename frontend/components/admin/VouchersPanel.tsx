"use client";

import { useEffect, useState } from "react";
import { Coins, Copy, Plus, Ticket, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { CreateVoucherModal } from "@/components/admin/CreateVoucherModal";
import {
  deleteAdminVoucher,
  listAdminVouchers,
  type Voucher,
} from "@/lib/api/vouchers";
import { parseApiError } from "@/lib/api/errors";
import { Skeleton } from "@/components/ui/Skeleton";

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

export function VouchersPanel() {
  const [items, setItems] = useState<Voucher[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  const [deletingId, setDeletingId] = useState<number | null>(null);

  const reload = async () => {
    setLoading(true);
    try {
      const res = await listAdminVouchers();
      setItems(res.items);
    } catch (err) {
      toast.error(parseApiError(err).message || "Не удалось загрузить ваучеры");
      setItems([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void reload();
  }, []);

  async function handleDelete(v: Voucher) {
    if (!confirm(`Удалить ваучер ${v.code}? Активации сохранятся? Нет — каскадно удалятся.`)) {
      return;
    }
    setDeletingId(v.id);
    try {
      await deleteAdminVoucher(v.id);
      setItems((prev) => (prev ? prev.filter((x) => x.id !== v.id) : prev));
      toast.success("Ваучер удалён");
    } catch (err) {
      toast.error(parseApiError(err).message || "Не удалось удалить");
    } finally {
      setDeletingId(null);
    }
  }

  function copyCode(code: string) {
    void navigator.clipboard.writeText(code);
    toast.success("Код скопирован");
  }

  return (
    <section className="mt-6 rounded-3xl border border-zinc-200 bg-white/95 shadow-[0_14px_50px_rgba(15,23,42,0.07)]">
      <div className="flex flex-col gap-4 border-b border-zinc-100 px-5 py-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-emerald-300 bg-emerald-100/70 text-emerald-700">
            <Ticket className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-zinc-900">
              Список ваучеров {items ? `— ${items.length}` : ""}
            </h2>
            <p className="text-xs text-zinc-500">
              Коды для пополнения баланса кредитов пользователей
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => setCreating(true)}
          className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white shadow-[0_10px_24px_-12px_rgba(16,185,129,0.6)] transition hover:bg-emerald-700"
        >
          <Plus className="h-4 w-4" />
          Создать ваучер
        </button>
      </div>

      {loading ? (
        <div className="space-y-3 px-5 py-5">
          {Array.from({ length: 5 }).map((_, index) => (
            <Skeleton key={index} className="h-12 w-full rounded-2xl" />
          ))}
        </div>
      ) : !items || items.length === 0 ? (
        <p className="px-5 py-10 text-center text-sm text-zinc-500">
          Ваучеров пока нет
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-zinc-100 text-left text-[11px] uppercase tracking-wider text-zinc-500">
                <th className="px-5 py-2 font-semibold">Код</th>
                <th className="px-3 py-2 font-semibold">Кредиты</th>
                <th className="px-3 py-2 font-semibold">Активации</th>
                <th className="px-3 py-2 font-semibold">Привязка</th>
                <th className="px-3 py-2 font-semibold">Срок</th>
                <th className="px-5 py-2 text-right font-semibold">Действия</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {items.map((v) => {
                const exhausted = v.used_count >= v.usage_limit;
                const expired =
                  v.valid_until && new Date(v.valid_until) < new Date();
                return (
                  <tr key={v.id} className="hover:bg-zinc-50/70">
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-2">
                        <code className="rounded-md border border-zinc-200 bg-zinc-50 px-2 py-1 text-[12px] font-semibold tabular-nums text-zinc-800">
                          {v.code}
                        </code>
                        <button
                          type="button"
                          onClick={() => copyCode(v.code)}
                          title="Скопировать"
                          className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-zinc-200 bg-white text-zinc-500 transition hover:border-emerald-300 hover:text-emerald-700"
                        >
                          <Copy className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </td>
                    <td className="px-3 py-3">
                      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-semibold text-emerald-700 ring-1 ring-emerald-200">
                        <Coins className="h-3.5 w-3.5" />
                        {v.credits.toLocaleString("ru-RU")}
                      </span>
                    </td>
                    <td className="px-3 py-3 tabular-nums">
                      <span
                        className={`text-sm font-semibold ${
                          exhausted ? "text-zinc-400" : "text-zinc-800"
                        }`}
                      >
                        {v.used_count} / {v.usage_limit}
                      </span>
                    </td>
                    <td className="px-3 py-3 text-xs text-zinc-600">
                      {v.bound_user_email ? (
                        <span className="inline-flex max-w-[220px] truncate rounded-full bg-sky-50 px-2 py-0.5 font-medium text-sky-700 ring-1 ring-sky-200">
                          {v.bound_user_email}
                        </span>
                      ) : (
                        <span className="text-zinc-400">любой</span>
                      )}
                    </td>
                    <td className="px-3 py-3 text-xs text-zinc-600">
                      {v.valid_from || v.valid_until ? (
                        <div className="space-y-0.5 leading-tight">
                          <div>с {formatDate(v.valid_from)}</div>
                          <div className={expired ? "text-rose-600" : ""}>
                            до {formatDate(v.valid_until)}
                          </div>
                        </div>
                      ) : (
                        <span className="text-zinc-400">бессрочно</span>
                      )}
                    </td>
                    <td className="px-5 py-3 text-right">
                      <button
                        type="button"
                        onClick={() => void handleDelete(v)}
                        disabled={deletingId === v.id}
                        title="Удалить"
                        className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-rose-200 bg-rose-50 text-rose-600 transition hover:border-rose-300 hover:bg-rose-100 disabled:opacity-50"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {creating && (
        <CreateVoucherModal
          onClose={() => setCreating(false)}
          onCreated={(v) => {
            setItems((prev) => (prev ? [v, ...prev] : [v]));
            setCreating(false);
          }}
        />
      )}
    </section>
  );
}
