"use client";

import { useEffect, useMemo, useState } from "react";
import {
  ArrowDownRight,
  ArrowUpRight,
  Banknote,
  Coins,
  CreditCard,
  Crown,
  Gauge,
  PiggyBank,
  RefreshCw,
  TrendingUp,
  Users as UsersIcon,
  Wallet,
} from "lucide-react";
import { toast } from "sonner";
import { isUnauthorized } from "@/lib/api/errors";
import { logout as authLogout } from "@/lib/api/auth";
import { requestReauth } from "@/lib/auth/session";
import { getAdminRevenue, type RevenueDashboard as RevenueData } from "@/lib/api/admin";

const PERIOD_OPTIONS: { value: number; label: string }[] = [
  { value: 7, label: "7 дн" },
  { value: 30, label: "30 дн" },
  { value: 90, label: "90 дн" },
  { value: 180, label: "180 дн" },
  { value: 365, label: "Год" },
  { value: 730, label: "2 года" },
];

const TOOL_LABELS: Record<string, string> = {
  "document-analyzer": "Анализатор документов",
  "data-extractor": "Сравнение документов",
  "tender-analyzer": "Обзор судебной практики",
  "handwriting-recognition": "Распознавание рукописи",
  "risk-analyzer": "Анализатор рисков",
  "legal-style-translator": "Перевод на юридический",
  "legal-text-simplifier": "Пересказ юр. текста",
  "spelling-checker": "Проверка правописания",
  "foreign-language-translator": "Перевод с иностранного",
  "legal-document-design-review": "Дизайн документов",
  key_points: "Ключевые тезисы",
  dates_deadlines: "Сроки",
  risk_analyzer: "Риски (плагин)",
  suggested_edits: "Правки",
  "contract-checker": "Проверка договоров",
};

function formatRub(value: number): string {
  return new Intl.NumberFormat("ru-RU", {
    style: "currency",
    currency: "RUB",
    maximumFractionDigits: 0,
  }).format(value);
}

function formatNumber(value: number): string {
  return new Intl.NumberFormat("ru-RU").format(value);
}

function formatDate(value: string): string {
  try {
    const d = new Date(value);
    return d.toLocaleString("ru-RU", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
  } catch {
    return value;
  }
}

function formatDateOnly(value: string): string {
  try {
    return new Date(value).toLocaleDateString("ru-RU", { day: "2-digit", month: "short" });
  } catch {
    return value;
  }
}

function toolLabel(slug: string): string {
  return TOOL_LABELS[slug] ?? slug;
}

function KpiCard({
  title,
  value,
  hint,
  icon: Icon,
  accent = "emerald",
  delta,
}: {
  title: string;
  value: string;
  hint?: string;
  icon: React.ComponentType<{ className?: string }>;
  accent?: "emerald" | "blue" | "amber" | "rose" | "zinc";
  delta?: { value: string; positive: boolean } | null;
}) {
  const accentMap: Record<string, string> = {
    emerald: "border-emerald-200 bg-emerald-50 text-emerald-700",
    blue: "border-blue-200 bg-blue-50 text-blue-700",
    amber: "border-amber-200 bg-amber-50 text-amber-700",
    rose: "border-rose-200 bg-rose-50 text-rose-700",
    zinc: "border-zinc-200 bg-zinc-100 text-zinc-700",
  };
  return (
    <div className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-[0_8px_24px_rgba(15,23,42,0.05)]">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-zinc-500">{title}</p>
          <p className="mt-2 text-2xl font-semibold tracking-[-0.02em] text-zinc-900">{value}</p>
          {hint && <p className="mt-1 text-xs text-zinc-500">{hint}</p>}
        </div>
        <div className={`flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl border ${accentMap[accent]}`}>
          <Icon className="h-5 w-5" />
        </div>
      </div>
      {delta && (
        <div className={`mt-3 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold ${
          delta.positive ? "bg-emerald-50 text-emerald-700" : "bg-rose-50 text-rose-700"
        }`}>
          {delta.positive ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
          {delta.value}
        </div>
      )}
    </div>
  );
}

function RevenueByDayChart({ rows }: { rows: RevenueData["by_day"] }) {
  const max = Math.max(1, ...rows.map((r) => r.revenue_rub));
  if (rows.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-zinc-200 bg-zinc-50/60 px-4 py-8 text-center text-xs text-zinc-500">
        За выбранный период покупок не было.
      </div>
    );
  }
  return (
    <div className="flex h-40 items-end gap-1 overflow-x-auto pb-1">
      {rows.map((r) => {
        const h = Math.max(2, (r.revenue_rub / max) * 100);
        return (
          <div key={r.date} className="group flex min-w-[18px] flex-1 flex-col items-center gap-1">
            <div className="relative flex w-full justify-center">
              <div
                className="w-full max-w-[28px] rounded-t-md bg-gradient-to-b from-emerald-500 to-emerald-300 transition group-hover:from-emerald-600 group-hover:to-emerald-400"
                style={{ height: `${h}%`, minHeight: "2px" }}
                title={`${formatDateOnly(r.date)}: ${formatRub(r.revenue_rub)} (${r.purchases} покупок)`}
              />
            </div>
            <span className="hidden text-[9px] uppercase tracking-wide text-zinc-400 sm:block">
              {formatDateOnly(r.date).split(" ")[0]}
            </span>
          </div>
        );
      })}
    </div>
  );
}

export function RevenueDashboard() {
  const [days, setDays] = useState<number>(30);
  const [data, setData] = useState<RevenueData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  async function load(silent = false) {
    if (!silent) setLoading(true);
    setRefreshing(true);
    try {
      const result = await getAdminRevenue(days);
      setData(result);
    } catch (err) {
      if (isUnauthorized(err)) {
        authLogout();
        requestReauth({ reason: "admin_revenue" });
        return;
      }
      toast.error("Не удалось загрузить дашборд");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [days]);

  const lifetimeMargin = data?.totals_lifetime.gross_margin_pct ?? 0;
  const periodMargin = data?.totals_period.gross_margin_pct ?? 0;

  const sortedTools = useMemo(() => {
    if (!data) return [];
    return [...data.by_tool_lifetime].sort((a, b) => b.credits_charged - a.credits_charged);
  }, [data]);

  if (loading && !data) {
    return (
      <section className="mt-6 rounded-3xl border border-zinc-200 bg-white/95 px-5 py-10 text-center text-sm text-zinc-500 shadow-[0_14px_50px_rgba(15,23,42,0.07)]">
        Загрузка финансовых данных…
      </section>
    );
  }

  if (!data) {
    return (
      <section className="mt-6 rounded-3xl border border-rose-200 bg-rose-50 px-5 py-6 text-sm text-rose-700">
        Нет данных. Попробуйте обновить страницу.
      </section>
    );
  }

  const lt = data.totals_lifetime;
  const pp = data.totals_period;

  return (
    <section className="mt-6 space-y-6">
      <div className="rounded-3xl border border-zinc-200 bg-white/95 p-5 shadow-[0_14px_50px_rgba(15,23,42,0.07)] sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-emerald-300 bg-emerald-100/70 text-emerald-700">
              <Crown className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-zinc-900">Финансовый дашборд</h2>
              <p className="mt-1 text-sm text-zinc-600">
                Все деньги, кредиты и токены — в одном месте. Только для владельца.
              </p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex flex-wrap gap-1 rounded-xl border border-zinc-200 bg-zinc-50 p-1">
              {PERIOD_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setDays(opt.value)}
                  className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                    days === opt.value
                      ? "bg-zinc-900 text-white shadow"
                      : "text-zinc-600 hover:bg-zinc-200/50"
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
            <button
              type="button"
              onClick={() => void load(true)}
              disabled={refreshing}
              className="inline-flex items-center gap-1.5 rounded-xl border border-zinc-200 bg-white px-3 py-1.5 text-xs font-semibold text-zinc-600 transition hover:bg-zinc-50 disabled:opacity-60"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${refreshing ? "animate-spin" : ""}`} />
              Обновить
            </button>
          </div>
        </div>
      </div>

      {/* KPI cards */}
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <KpiCard
          title="Доход (всё время)"
          value={formatRub(lt.revenue_rub)}
          hint={`${formatNumber(lt.purchases)} покупок · ARPPU ${formatRub(lt.arppu_rub)}`}
          icon={Banknote}
          accent="emerald"
        />
        <KpiCard
          title={`Доход за ${days} дн`}
          value={formatRub(pp.revenue_rub)}
          hint={`${formatNumber(pp.purchases)} покупок · ARPPU ${formatRub(pp.arppu_rub)}`}
          icon={TrendingUp}
          accent="blue"
        />
        <KpiCard
          title="Платящие клиенты"
          value={`${formatNumber(lt.paying_users)} / ${formatNumber(lt.total_users)}`}
          hint={`Конверсия ${lt.paying_conversion_pct}% · активных ${formatNumber(lt.active_users)}`}
          icon={UsersIcon}
          accent="amber"
        />
        <KpiCard
          title="Маржа (всё время)"
          value={`${lifetimeMargin.toFixed(1)}%`}
          hint={`${formatRub(lt.gross_margin_rub)} · затраты на токены ${formatRub(lt.token_cost_rub)}`}
          icon={Gauge}
          accent={lifetimeMargin >= 60 ? "emerald" : lifetimeMargin >= 30 ? "amber" : "rose"}
        />
        <KpiCard
          title="Кредиты выпущены"
          value={formatNumber(lt.credits_issued)}
          hint={`Бонусные ${formatNumber(lt.credits_bonus_issued)}`}
          icon={Coins}
          accent="emerald"
        />
        <KpiCard
          title="Кредиты потрачены"
          value={formatNumber(lt.credits_spent)}
          hint={`За ${days} дн: ${formatNumber(pp.credits_spent)}`}
          icon={Wallet}
          accent="blue"
        />
        <KpiCard
          title="Остаток на балансах"
          value={formatNumber(lt.credits_outstanding)}
          hint="Не сгоревший долг перед клиентами"
          icon={PiggyBank}
          accent="zinc"
        />
        <KpiCard
          title={`Маржа за ${days} дн`}
          value={`${periodMargin.toFixed(1)}%`}
          hint={`${formatRub(pp.gross_margin_rub)} · токены ${formatRub(pp.token_cost_rub)}`}
          icon={Gauge}
          accent={periodMargin >= 60 ? "emerald" : periodMargin >= 30 ? "amber" : "rose"}
        />
      </div>

      {/* By day chart */}
      <div className="rounded-3xl border border-zinc-200 bg-white p-5 shadow-[0_14px_50px_rgba(15,23,42,0.07)]">
        <div className="flex flex-wrap items-end justify-between gap-2">
          <div>
            <h3 className="text-sm font-semibold text-zinc-900">Доход по дням</h3>
            <p className="mt-0.5 text-xs text-zinc-500">Период: {days} дн · {formatNumber(pp.purchases)} покупок</p>
          </div>
          <div className="text-right">
            <p className="text-xs text-zinc-500">Сумма за период</p>
            <p className="text-lg font-semibold text-zinc-900">{formatRub(pp.revenue_rub)}</p>
          </div>
        </div>
        <div className="mt-5">
          <RevenueByDayChart rows={data.by_day} />
        </div>
      </div>

      {/* By package */}
      <div className="grid gap-4 lg:grid-cols-[1fr_1fr]">
        <div className="rounded-3xl border border-zinc-200 bg-white p-5 shadow-[0_14px_50px_rgba(15,23,42,0.07)]">
          <h3 className="text-sm font-semibold text-zinc-900">Продажи пакетов (всё время)</h3>
          <p className="mt-0.5 text-xs text-zinc-500">Структура выручки по тарифным наборам кредитов</p>
          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-[11px] uppercase tracking-wide text-zinc-500">
                  <th className="pb-2 pr-2 font-semibold">Пакет</th>
                  <th className="pb-2 pr-2 font-semibold">Цена</th>
                  <th className="pb-2 pr-2 font-semibold">Покупок</th>
                  <th className="pb-2 pr-2 font-semibold">Кредитов</th>
                  <th className="pb-2 text-right font-semibold">Выручка</th>
                </tr>
              </thead>
              <tbody>
                {data.by_package.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-6 text-center text-xs text-zinc-500">
                      Нет покупок
                    </td>
                  </tr>
                ) : (
                  data.by_package.map((p) => (
                    <tr key={p.package_id} className="border-t border-zinc-100">
                      <td className="py-2.5 pr-2 font-medium text-zinc-900">{p.name}</td>
                      <td className="py-2.5 pr-2 text-zinc-600">{p.price_rub ? formatRub(p.price_rub) : "—"}</td>
                      <td className="py-2.5 pr-2 text-zinc-700">{formatNumber(p.count)}</td>
                      <td className="py-2.5 pr-2 text-zinc-700">{formatNumber(p.credits)}</td>
                      <td className="py-2.5 text-right font-semibold text-emerald-700">
                        {formatRub(p.revenue_rub)}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="rounded-3xl border border-zinc-200 bg-white p-5 shadow-[0_14px_50px_rgba(15,23,42,0.07)]">
          <h3 className="text-sm font-semibold text-zinc-900">Тарифы и юнит-экономика</h3>
          <p className="mt-0.5 text-xs text-zinc-500">
            ₽ за токен, ₽ за кредит и фактический rate каждого пакета
          </p>
          <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
            <div className="rounded-xl border border-zinc-200 bg-zinc-50/60 p-3">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-zinc-500">Input ₽/M</p>
              <p className="mt-1 text-lg font-semibold text-zinc-900">
                {formatRub(data.pricing.input_token_rub_per_million)}
              </p>
            </div>
            <div className="rounded-xl border border-zinc-200 bg-zinc-50/60 p-3">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-zinc-500">Output ₽/M</p>
              <p className="mt-1 text-lg font-semibold text-zinc-900">
                {formatRub(data.pricing.output_token_rub_per_million)}
              </p>
            </div>
            <div className="rounded-xl border border-zinc-200 bg-zinc-50/60 p-3">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-zinc-500">₽ за кредит (cost)</p>
              <p className="mt-1 text-lg font-semibold text-zinc-900">
                {data.pricing.rub_per_credit.toFixed(3)} ₽
              </p>
            </div>
            <div className="rounded-xl border border-zinc-200 bg-zinc-50/60 p-3">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-zinc-500">Пакетов</p>
              <p className="mt-1 text-lg font-semibold text-zinc-900">{data.pricing.packages.length}</p>
            </div>
          </div>
          <div className="mt-4 space-y-2">
            {data.pricing.packages.map((pkg) => {
              const margin = ((pkg.rub_per_credit - data.pricing.rub_per_credit) / pkg.rub_per_credit) * 100;
              return (
                <div
                  key={pkg.id}
                  className="flex items-center justify-between rounded-xl border border-zinc-100 bg-white px-3 py-2 text-xs"
                >
                  <span className="font-semibold capitalize text-zinc-900">{pkg.id}</span>
                  <span className="text-zinc-500">
                    {formatRub(pkg.price_rub)} · {formatNumber(pkg.credits)} кр
                  </span>
                  <span className="font-mono text-zinc-700">{pkg.rub_per_credit.toFixed(3)} ₽/кр</span>
                  <span className={`font-semibold ${margin >= 60 ? "text-emerald-700" : margin >= 30 ? "text-amber-700" : "text-rose-700"}`}>
                    {margin.toFixed(0)}% маржа
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* By tool */}
      <div className="rounded-3xl border border-zinc-200 bg-white p-5 shadow-[0_14px_50px_rgba(15,23,42,0.07)]">
        <h3 className="text-sm font-semibold text-zinc-900">Юнит-экономика по инструментам</h3>
        <p className="mt-0.5 text-xs text-zinc-500">
          Сколько потратили токенов, во сколько они нам обошлись и сколько кредитов «сожгли» клиенты
        </p>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-[11px] uppercase tracking-wide text-zinc-500">
                <th className="pb-2 pr-2 font-semibold">Инструмент</th>
                <th className="pb-2 pr-2 font-semibold">Запусков</th>
                <th className="pb-2 pr-2 font-semibold">Токенов in</th>
                <th className="pb-2 pr-2 font-semibold">Токенов out</th>
                <th className="pb-2 pr-2 font-semibold">Кредитов</th>
                <th className="pb-2 pr-2 font-semibold">Cost ₽</th>
                <th className="pb-2 pr-2 font-semibold">Списано ₽</th>
                <th className="pb-2 text-right font-semibold">Маржа</th>
              </tr>
            </thead>
            <tbody>
              {sortedTools.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-6 text-center text-xs text-zinc-500">
                    Запусков пока не было
                  </td>
                </tr>
              ) : (
                sortedTools.map((t) => {
                  const margin = t.credit_revenue_rub - t.token_cost_rub;
                  const marginPct = t.credit_revenue_rub > 0 ? (margin / t.credit_revenue_rub) * 100 : 0;
                  return (
                    <tr key={t.tool_slug} className="border-t border-zinc-100">
                      <td className="py-2 pr-2 font-medium text-zinc-900">{toolLabel(t.tool_slug)}</td>
                      <td className="py-2 pr-2 text-zinc-700">{formatNumber(t.runs)}</td>
                      <td className="py-2 pr-2 text-zinc-600">{formatNumber(t.tokens_in)}</td>
                      <td className="py-2 pr-2 text-zinc-600">{formatNumber(t.tokens_out)}</td>
                      <td className="py-2 pr-2 text-zinc-700">{formatNumber(t.credits_charged)}</td>
                      <td className="py-2 pr-2 text-rose-600">{formatRub(t.token_cost_rub)}</td>
                      <td className="py-2 pr-2 text-emerald-700">{formatRub(t.credit_revenue_rub)}</td>
                      <td className={`py-2 text-right font-semibold ${
                        margin >= 0 ? "text-emerald-700" : "text-rose-700"
                      }`}>
                        {formatRub(margin)}
                        <span className="ml-1 text-[10px] font-normal text-zinc-500">{marginPct.toFixed(0)}%</span>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Top spenders + Recent purchases */}
      <div className="grid gap-4 xl:grid-cols-[1.1fr_1fr]">
        <div className="rounded-3xl border border-zinc-200 bg-white p-5 shadow-[0_14px_50px_rgba(15,23,42,0.07)]">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-zinc-900">Топ покупателей</h3>
            <span className="text-[10px] uppercase tracking-wide text-zinc-400">всё время</span>
          </div>
          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-[11px] uppercase tracking-wide text-zinc-500">
                  <th className="pb-2 pr-2 font-semibold">Пользователь</th>
                  <th className="pb-2 pr-2 font-semibold">Покупок</th>
                  <th className="pb-2 pr-2 font-semibold">Кредитов</th>
                  <th className="pb-2 pr-2 font-semibold">Баланс</th>
                  <th className="pb-2 text-right font-semibold">Принёс</th>
                </tr>
              </thead>
              <tbody>
                {data.top_spenders.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-6 text-center text-xs text-zinc-500">
                      Покупок ещё не было
                    </td>
                  </tr>
                ) : (
                  data.top_spenders.map((u, idx) => (
                    <tr key={u.user_id} className="border-t border-zinc-100">
                      <td className="py-2 pr-2">
                        <div className="flex items-center gap-2">
                          <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-zinc-100 text-[10px] font-bold text-zinc-700">
                            {idx + 1}
                          </span>
                          <div className="min-w-0">
                            <p className="truncate font-medium text-zinc-900">{u.email}</p>
                            <p className="text-[10px] uppercase tracking-wide text-zinc-400">{u.plan ?? "free"}</p>
                          </div>
                        </div>
                      </td>
                      <td className="py-2 pr-2 text-zinc-700">{u.purchases}</td>
                      <td className="py-2 pr-2 text-zinc-700">{formatNumber(u.credits_purchased)}</td>
                      <td className="py-2 pr-2 text-zinc-600">{formatNumber(u.credit_balance)}</td>
                      <td className="py-2 text-right font-semibold text-emerald-700">
                        {formatRub(u.revenue_rub)}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="rounded-3xl border border-zinc-200 bg-white p-5 shadow-[0_14px_50px_rgba(15,23,42,0.07)]">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-zinc-900">Последние покупки</h3>
            <span className="text-[10px] uppercase tracking-wide text-zinc-400">50 шт</span>
          </div>
          <div className="mt-4 max-h-[420px] space-y-2 overflow-y-auto pr-1">
            {data.recent_purchases.length === 0 ? (
              <p className="py-6 text-center text-xs text-zinc-500">Покупок ещё не было</p>
            ) : (
              data.recent_purchases.map((p) => (
                <div
                  key={p.id}
                  className="flex items-center justify-between gap-3 rounded-xl border border-zinc-100 bg-white px-3 py-2 text-xs"
                >
                  <div className="flex items-center gap-2">
                    <span className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-lg border border-emerald-200 bg-emerald-50 text-emerald-700">
                      <CreditCard className="h-3.5 w-3.5" />
                    </span>
                    <div className="min-w-0">
                      <p className="truncate font-medium text-zinc-900">{p.email}</p>
                      <p className="text-[10px] uppercase tracking-wide text-zinc-400">
                        {p.package ?? "—"} · {formatNumber(p.credits)} кр · {formatDate(p.created_at)}
                      </p>
                    </div>
                  </div>
                  <span className="font-semibold text-emerald-700">{formatRub(p.revenue_rub)}</span>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Plans + cohort */}
      <div className="grid gap-4 lg:grid-cols-[1fr_1.4fr]">
        <div className="rounded-3xl border border-zinc-200 bg-white p-5 shadow-[0_14px_50px_rgba(15,23,42,0.07)]">
          <h3 className="text-sm font-semibold text-zinc-900">Распределение по тарифам</h3>
          <div className="mt-4 space-y-2">
            {data.by_plan.length === 0 ? (
              <p className="text-xs text-zinc-500">Нет пользователей</p>
            ) : (
              data.by_plan.map((row) => {
                const total = data.by_plan.reduce((acc, r) => acc + r.users, 0);
                const pct = total > 0 ? (row.users / total) * 100 : 0;
                return (
                  <div key={row.plan} className="text-sm">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-semibold capitalize text-zinc-900">{row.plan}</span>
                      <span className="text-zinc-500">{formatNumber(row.users)} · {pct.toFixed(0)}%</span>
                    </div>
                    <div className="mt-1 h-2 overflow-hidden rounded-full bg-zinc-100">
                      <div className="h-full bg-gradient-to-r from-emerald-500 to-emerald-300" style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
        <div className="rounded-3xl border border-zinc-200 bg-white p-5 shadow-[0_14px_50px_rgba(15,23,42,0.07)]">
          <h3 className="text-sm font-semibold text-zinc-900">Новые регистрации по дням</h3>
          <p className="mt-0.5 text-xs text-zinc-500">За {days} дн · всего {formatNumber(data.new_users_by_day.reduce((a, r) => a + r.new_users, 0))}</p>
          <div className="mt-4 flex h-32 items-end gap-1 overflow-x-auto">
            {data.new_users_by_day.length === 0 ? (
              <p className="m-auto text-xs text-zinc-500">Нет данных</p>
            ) : (
              (() => {
                const max = Math.max(1, ...data.new_users_by_day.map((r) => r.new_users));
                return data.new_users_by_day.map((r) => (
                  <div key={r.date} className="flex min-w-[14px] flex-1 flex-col items-center gap-1">
                    <div
                      className="w-full max-w-[24px] rounded-t-md bg-gradient-to-b from-blue-500 to-blue-300"
                      style={{ height: `${Math.max(2, (r.new_users / max) * 100)}%` }}
                      title={`${formatDateOnly(r.date)}: ${r.new_users}`}
                    />
                    <span className="hidden text-[9px] uppercase tracking-wide text-zinc-400 sm:block">
                      {formatDateOnly(r.date).split(" ")[0]}
                    </span>
                  </div>
                ));
              })()
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
