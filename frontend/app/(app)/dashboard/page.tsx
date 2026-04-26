"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import {
  ArrowRight,
  ArrowUpRight,
  Coins,
  FileStack,
  FilePlus2,
  FileWarning,
  FolderOpen,
  Gauge,
  Loader2,
  Plus,
  Scale,
  Sparkles,
  Ticket,
  TrendingUp,
  UploadCloud,
} from "lucide-react";
import { getToken } from "@/lib/auth/token";
import { isUnauthorized } from "@/lib/api/errors";
import { logout as authLogout, me, type User } from "@/lib/api/auth";
import { buildLoginRedirectHref } from "@/lib/auth/redirect";
import { requestReauth } from "@/lib/auth/session";
import { getDashboardSummary, type DashboardSummary } from "@/lib/api/dashboard";
import { AnalysisModal } from "@/components/analyses/AnalysisModal";
import { RedeemVoucherModal } from "@/components/billing/RedeemVoucherModal";

const TOOL_LABELS: Record<string, string> = {
  "document-analyzer": "Анализатор документов",
  "contract-checker": "Проверка договоров",
  "data-extractor": "Сравнение документов",
  "tender-analyzer": "Обзор судебной практики",
  "risk-analyzer": "Поиск рисков",
  "handwriting-recognition": "Распознавание рукописных",
  "legal-style-translator": "Перевод на юридический",
  "legal-text-simplifier": "Пересказ юридического",
  "spelling-checker": "Проверка правописания",
  "foreign-language-translator": "Перевод с иностранного",
  "legal-document-design-review": "Оформление документов",
  key_points: "Ключевые тезисы",
  dates_deadlines: "Даты и сроки",
  risk_analyzer: "Анализ рисков",
  suggested_edits: "Правки",
};

const REASON_LABELS: Record<string, string> = {
  voucher_redeem: "Активация ваучера",
  admin_grant: "Начисление администратора",
  admin_debit: "Списание администратора",
  package_purchase: "Покупка пакета",
  analysis_run: "Анализ",
  refund: "Возврат",
};

function relativeTime(iso: string): string {
  const dt = new Date(iso);
  const diff = (Date.now() - dt.getTime()) / 1000;
  if (diff < 60) return "только что";
  if (diff < 3600) return `${Math.floor(diff / 60)} мин назад`;
  if (diff < 86400) return `${Math.floor(diff / 3600)} ч назад`;
  if (diff < 86400 * 7) return `${Math.floor(diff / 86400)} дн назад`;
  return dt.toLocaleDateString("ru-RU", { day: "2-digit", month: "short" });
}

function formatBytes(n: number): string {
  if (n < 1024) return `${n} Б`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} КБ`;
  return `${(n / 1024 / 1024).toFixed(1)} МБ`;
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; cls: string }> = {
    completed: { label: "Готово", cls: "bg-emerald-50 text-emerald-700 ring-emerald-200" },
    running: { label: "Выполняется", cls: "bg-sky-50 text-sky-700 ring-sky-200" },
    pending: { label: "В очереди", cls: "bg-amber-50 text-amber-700 ring-amber-200" },
    failed: { label: "Ошибка", cls: "bg-rose-50 text-rose-700 ring-rose-200" },
  };
  const v = map[status] ?? { label: status, cls: "bg-zinc-100 text-zinc-700 ring-zinc-200" };
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold ring-1 ${v.cls}`}>
      {v.label}
    </span>
  );
}

function Sparkline({ data }: { data: number[] }) {
  const w = 100;
  const h = 28;
  const max = Math.max(1, ...data);
  const step = data.length > 1 ? w / (data.length - 1) : 0;
  const points = data
    .map((v, i) => `${(i * step).toFixed(2)},${(h - (v / max) * h).toFixed(2)}`)
    .join(" ");
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="h-7 w-full" preserveAspectRatio="none">
      <polyline
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
        strokeLinecap="round"
        points={points}
      />
    </svg>
  );
}

function ActivityChart({ data }: { data: { date: string; count: number }[] }) {
  const max = Math.max(1, ...data.map((d) => d.count));
  return (
    <div className="flex h-28 items-end gap-[3px]">
      {data.map((d) => {
        const pct = (d.count / max) * 100;
        return (
          <div
            key={d.date}
            className="group relative flex-1 rounded-t bg-emerald-100 transition hover:bg-emerald-300"
            style={{ height: `${Math.max(pct, d.count > 0 ? 8 : 2)}%` }}
            title={`${d.date}: ${d.count}`}
          >
            {d.count > 0 && (
              <div
                className="absolute inset-0 rounded-t bg-emerald-500"
                style={{ opacity: 0.6 + 0.4 * (d.count / max) }}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}

export default function DashboardPage() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [voucherOpen, setVoucherOpen] = useState(false);
  const [analysisId, setAnalysisId] = useState<number | null>(null);

  useEffect(() => {
    const token = getToken();
    if (!token) {
      router.replace(buildLoginRedirectHref());
      return;
    }
    let cancelled = false;
    me()
      .then(async (u) => {
        if (cancelled) return;
        setUser(u);
        const data = await getDashboardSummary();
        if (!cancelled) setSummary(data);
      })
      .catch((err) => {
        if (cancelled) return;
        if (isUnauthorized(err)) {
          authLogout();
          requestReauth({ reason: "dashboard" });
          return;
        }
        router.replace(buildLoginRedirectHref());
      })
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [router]);

  const sparkline = useMemo(
    () => (summary ? summary.activity_30d.slice(-14).map((p) => p.count) : []),
    [summary]
  );

  if (loading) {
    return (
      <main className="flex min-h-[60vh] items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-zinc-400" />
      </main>
    );
  }

  if (!user || !summary) return null;

  const greeting = (() => {
    const h = new Date().getHours();
    if (h < 5) return "Доброй ночи";
    if (h < 12) return "Доброе утро";
    if (h < 18) return "Добрый день";
    return "Добрый вечер";
  })();
  const userName = user.email.split("@")[0];
  const balance = summary.credit_balance.toLocaleString("ru-RU");
  const totalToolCount = summary.tool_breakdown.reduce((s, t) => s + t.count, 0);

  return (
    <main className="relative min-h-[calc(100vh-104px)] overflow-hidden bg-[linear-gradient(170deg,#f7f8f7,#f3f4f6_45%,#eef2ff)] px-4 py-6 sm:px-6 lg:px-8">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute left-[-8%] top-[-14%] h-72 w-72 rounded-full bg-emerald-200/35 blur-3xl" />
        <div className="absolute right-[-12%] top-[20%] h-96 w-96 rounded-full bg-sky-200/30 blur-3xl" />
      </div>

      <div className="relative mx-auto flex w-full max-w-[1520px] flex-col gap-6">
        {/* Greeting + plan */}
        <section className="flex flex-col gap-4 rounded-[28px] border border-zinc-200/90 bg-white/85 px-6 py-5 shadow-[0_20px_70px_rgba(15,23,42,0.08)] backdrop-blur lg:flex-row lg:items-center lg:justify-between">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-emerald-300 bg-emerald-50 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.24em] text-emerald-700">
              <Sparkles className="h-3.5 w-3.5" />
              Аналитический центр
            </div>
            <h1 className="mt-2 text-3xl font-semibold tracking-[-0.03em] text-zinc-900 sm:text-4xl">
              {greeting}, {userName}
            </h1>
            <p className="mt-1 text-sm text-zinc-600 sm:text-base">
              Тариф «{summary.plan}». На балансе {balance} кредитов — этого хватит примерно на{" "}
              {Math.max(0, Math.floor(summary.credit_balance / 120))} анализов.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => setVoucherOpen(true)}
              className="inline-flex items-center gap-2 rounded-xl border border-zinc-300 bg-white px-4 py-2.5 text-sm font-semibold text-zinc-800 shadow-sm transition hover:bg-zinc-50"
            >
              <Ticket className="h-4 w-4" />
              Активировать ваучер
            </button>
            <Link
              href="/pricing"
              className="inline-flex items-center gap-2 rounded-xl bg-zinc-900 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-zinc-700"
            >
              <Plus className="h-4 w-4" />
              Пополнить баланс
            </Link>
          </div>
        </section>

        {/* KPI cards */}
        <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <KpiCard
            icon={<Coins className="h-4 w-4" />}
            label="Баланс"
            value={balance}
            unit="кр."
            accent="emerald"
            footer={`Списано сегодня: ${summary.credits_spent_today.toLocaleString("ru-RU")} кр.`}
          />
          <KpiCard
            icon={<FileStack className="h-4 w-4" />}
            label="Документы"
            value={summary.counts.documents.toLocaleString("ru-RU")}
            accent="sky"
            footer={`${summary.counts.folders} пользовательских папок`}
          />
          <KpiCard
            icon={<TrendingUp className="h-4 w-4" />}
            label="Анализов всего"
            value={summary.counts.analyses.toLocaleString("ru-RU")}
            accent="violet"
            footer={`+${summary.counts.analyses_7d} за 7 дней`}
            chart={<div className="text-violet-500"><Sparkline data={sparkline} /></div>}
          />
          <KpiCard
            icon={<Gauge className="h-4 w-4" />}
            label="Расход за 7 дней"
            value={summary.credits_spent_7d.toLocaleString("ru-RU")}
            unit="кр."
            accent="amber"
            footer={`≈ ${Math.round(summary.credits_spent_7d / 7).toLocaleString("ru-RU")} кр./день`}
          />
        </section>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
          {/* Left column: quick actions + recent analyses */}
          <div className="flex flex-col gap-6 lg:col-span-8">
            {/* Quick actions */}
            <section className="rounded-[24px] border border-zinc-200/90 bg-white/85 p-5 shadow-[0_10px_40px_rgba(15,23,42,0.06)] backdrop-blur">
              <h2 className="mb-3 text-sm font-semibold uppercase tracking-[0.18em] text-zinc-500">
                Быстрые действия
              </h2>
              <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
                <QuickAction
                  href="/dashboard/files"
                  icon={<UploadCloud className="h-5 w-5" />}
                  label="Загрузить документ"
                  hint="PDF, DOCX, XLSX"
                  color="emerald"
                />
                <QuickAction
                  href="/tools/document-analyzer"
                  icon={<FilePlus2 className="h-5 w-5" />}
                  label="Новый анализ"
                  hint="Документ → отчёт"
                  color="violet"
                />
                <QuickAction
                  href="/tools/tender-analyzer"
                  icon={<Scale className="h-5 w-5" />}
                  label="Поиск практики"
                  hint="Судебные решения"
                  color="sky"
                />
                <QuickAction
                  href="/dashboard/files"
                  icon={<FolderOpen className="h-5 w-5" />}
                  label="Все папки"
                  hint="Документы и анализы"
                  color="amber"
                />
              </div>
            </section>

            {/* Recent analyses */}
            <section className="rounded-[24px] border border-zinc-200/90 bg-white/85 p-5 shadow-[0_10px_40px_rgba(15,23,42,0.06)] backdrop-blur">
              <div className="mb-3 flex items-center justify-between">
                <h2 className="text-sm font-semibold uppercase tracking-[0.18em] text-zinc-500">
                  Последние анализы
                </h2>
                <Link
                  href="/dashboard/files"
                  className="inline-flex items-center gap-1 text-xs font-semibold text-zinc-700 transition hover:text-zinc-900"
                >
                  Все
                  <ArrowRight className="h-3.5 w-3.5" />
                </Link>
              </div>
              {summary.recent_analyses.length === 0 ? (
                <EmptyHint
                  icon={<FilePlus2 className="h-5 w-5" />}
                  title="Анализов пока нет"
                  description="Загрузите документ и запустите первый анализ — это займёт меньше минуты."
                  ctaLabel="Запустить анализ"
                  ctaHref="/tools/document-analyzer"
                />
              ) : (
                <ul className="divide-y divide-zinc-100">
                  {summary.recent_analyses.map((a) => (
                    <li key={a.analysis_id}>
                      <button
                        onClick={() => setAnalysisId(a.analysis_id)}
                        className="group flex w-full items-center justify-between gap-3 py-3 text-left transition hover:bg-zinc-50/60"
                      >
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <p className="truncate text-sm font-medium text-zinc-900">{a.filename}</p>
                            <StatusBadge status={a.status} />
                          </div>
                          <p className="mt-0.5 text-xs text-zinc-500">
                            {TOOL_LABELS[a.tool_slug] ?? a.tool_slug} · {relativeTime(a.created_at)}
                          </p>
                        </div>
                        <ArrowUpRight className="h-4 w-4 text-zinc-400 transition group-hover:text-zinc-700" />
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            {/* Pending documents */}
            {summary.pending_documents.length > 0 && (
              <section className="rounded-[24px] border border-amber-200/70 bg-gradient-to-br from-amber-50/70 via-white to-white p-5 shadow-[0_10px_40px_rgba(15,23,42,0.06)]">
                <div className="mb-3 flex items-center justify-between">
                  <h2 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-[0.18em] text-amber-800">
                    <FileWarning className="h-4 w-4" />
                    Без анализа
                  </h2>
                  <span className="text-[11px] font-semibold text-amber-700">
                    {summary.pending_documents.length} док.
                  </span>
                </div>
                <ul className="grid grid-cols-1 gap-2 md:grid-cols-2">
                  {summary.pending_documents.map((d) => (
                    <li
                      key={d.document_id}
                      className="flex items-center justify-between gap-3 rounded-xl border border-amber-200/60 bg-white/80 px-3 py-2.5"
                    >
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-zinc-900">{d.filename}</p>
                        <p className="mt-0.5 text-[11px] text-zinc-500">
                          {formatBytes(d.size_bytes)} · {relativeTime(d.created_at)}
                        </p>
                      </div>
                      <Link
                        href="/tools/document-analyzer"
                        className="inline-flex flex-shrink-0 items-center gap-1 rounded-lg bg-amber-600 px-2.5 py-1.5 text-[11px] font-semibold text-white shadow-sm transition hover:bg-amber-700"
                      >
                        Анализ
                        <ArrowRight className="h-3 w-3" />
                      </Link>
                    </li>
                  ))}
                </ul>
              </section>
            )}
          </div>

          {/* Right column: activity, breakdown, ledger */}
          <div className="flex flex-col gap-6 lg:col-span-4">
            {/* Activity chart */}
            <section className="rounded-[24px] border border-zinc-200/90 bg-white/85 p-5 shadow-[0_10px_40px_rgba(15,23,42,0.06)] backdrop-blur">
              <div className="mb-3 flex items-center justify-between">
                <h2 className="text-sm font-semibold uppercase tracking-[0.18em] text-zinc-500">
                  Активность · 30 дней
                </h2>
                <span className="text-xs font-semibold text-zinc-700">
                  {summary.counts.analyses_30d} анализов
                </span>
              </div>
              <ActivityChart data={summary.activity_30d} />
              <div className="mt-2 flex justify-between text-[10px] text-zinc-400">
                <span>{summary.activity_30d[0]?.date.slice(5)}</span>
                <span>сегодня</span>
              </div>
            </section>

            {/* Tool breakdown */}
            <section className="rounded-[24px] border border-zinc-200/90 bg-white/85 p-5 shadow-[0_10px_40px_rgba(15,23,42,0.06)] backdrop-blur">
              <h2 className="mb-3 text-sm font-semibold uppercase tracking-[0.18em] text-zinc-500">
                Топ инструментов
              </h2>
              {summary.tool_breakdown.length === 0 ? (
                <p className="py-4 text-center text-xs text-zinc-500">Нет данных</p>
              ) : (
                <ul className="space-y-2.5">
                  {summary.tool_breakdown.map((t) => {
                    const pct = totalToolCount ? (t.count / totalToolCount) * 100 : 0;
                    return (
                      <li key={t.tool_slug}>
                        <div className="flex items-center justify-between text-xs">
                          <span className="truncate font-medium text-zinc-700">
                            {TOOL_LABELS[t.tool_slug] ?? t.tool_slug}
                          </span>
                          <span className="font-semibold tabular-nums text-zinc-900">{t.count}</span>
                        </div>
                        <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-zinc-100">
                          <div
                            className="h-full rounded-full bg-gradient-to-r from-emerald-400 to-sky-500"
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </section>

            {/* Recent ledger */}
            <section className="rounded-[24px] border border-zinc-200/90 bg-white/85 p-5 shadow-[0_10px_40px_rgba(15,23,42,0.06)] backdrop-blur">
              <div className="mb-3 flex items-center justify-between">
                <h2 className="text-sm font-semibold uppercase tracking-[0.18em] text-zinc-500">
                  Движение баланса
                </h2>
                <Link
                  href="/profile"
                  className="text-xs font-semibold text-zinc-700 transition hover:text-zinc-900"
                >
                  Все →
                </Link>
              </div>
              {summary.recent_ledger.length === 0 ? (
                <p className="py-4 text-center text-xs text-zinc-500">Операций пока нет</p>
              ) : (
                <ul className="divide-y divide-zinc-100">
                  {summary.recent_ledger.map((tx) => (
                    <li key={tx.id} className="flex items-center justify-between gap-2 py-2.5">
                      <div className="min-w-0">
                        <p className="truncate text-xs font-medium text-zinc-800">
                          {REASON_LABELS[tx.reason] ?? tx.reason}
                          {tx.reference && (
                            <span className="ml-1 text-zinc-400">· {tx.reference}</span>
                          )}
                        </p>
                        <p className="mt-0.5 text-[10px] text-zinc-500">
                          {relativeTime(tx.created_at)}
                        </p>
                      </div>
                      <div
                        className={`flex-shrink-0 text-xs font-semibold tabular-nums ${
                          tx.amount >= 0 ? "text-emerald-600" : "text-rose-600"
                        }`}
                      >
                        {tx.amount > 0 ? "+" : ""}
                        {tx.amount.toLocaleString("ru-RU")}
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </div>
        </div>
      </div>

      <RedeemVoucherModal open={voucherOpen} onClose={() => setVoucherOpen(false)} />
      <AnalysisModal analysisId={analysisId} onClose={() => setAnalysisId(null)} />
    </main>
  );
}

function KpiCard({
  icon,
  label,
  value,
  unit,
  footer,
  accent,
  chart,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  unit?: string;
  footer?: string;
  accent: "emerald" | "sky" | "violet" | "amber";
  chart?: React.ReactNode;
}) {
  const accents = {
    emerald: "text-emerald-700 bg-emerald-50 ring-emerald-200",
    sky: "text-sky-700 bg-sky-50 ring-sky-200",
    violet: "text-violet-700 bg-violet-50 ring-violet-200",
    amber: "text-amber-700 bg-amber-50 ring-amber-200",
  } as const;
  return (
    <div className="rounded-2xl border border-zinc-200/90 bg-white/85 p-4 shadow-[0_10px_40px_rgba(15,23,42,0.06)] backdrop-blur">
      <div className="flex items-center justify-between">
        <span
          className={`inline-flex h-8 w-8 items-center justify-center rounded-lg ring-1 ${accents[accent]}`}
        >
          {icon}
        </span>
        <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-zinc-400">
          {label}
        </span>
      </div>
      <div className="mt-3 flex items-baseline gap-1">
        <p className="text-2xl font-semibold tracking-tight text-zinc-900">{value}</p>
        {unit && <span className="text-xs font-medium text-zinc-500">{unit}</span>}
      </div>
      {chart && <div className="mt-1">{chart}</div>}
      {footer && <p className="mt-1 text-[11px] text-zinc-500">{footer}</p>}
    </div>
  );
}

function QuickAction({
  href,
  icon,
  label,
  hint,
  color,
}: {
  href: string;
  icon: React.ReactNode;
  label: string;
  hint: string;
  color: "emerald" | "violet" | "sky" | "amber";
}) {
  const colors = {
    emerald: "border-emerald-200 bg-emerald-50/60 text-emerald-700 hover:bg-emerald-50",
    violet: "border-violet-200 bg-violet-50/60 text-violet-700 hover:bg-violet-50",
    sky: "border-sky-200 bg-sky-50/60 text-sky-700 hover:bg-sky-50",
    amber: "border-amber-200 bg-amber-50/60 text-amber-700 hover:bg-amber-50",
  } as const;
  return (
    <Link
      href={href}
      className={`group flex flex-col gap-2 rounded-2xl border p-3 transition ${colors[color]}`}
    >
      <div className="flex items-center justify-between">
        <span className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-white/80 shadow-sm">
          {icon}
        </span>
        <ArrowUpRight className="h-4 w-4 opacity-0 transition group-hover:opacity-100" />
      </div>
      <div>
        <p className="text-sm font-semibold text-zinc-900">{label}</p>
        <p className="text-[11px] text-zinc-500">{hint}</p>
      </div>
    </Link>
  );
}

function EmptyHint({
  icon,
  title,
  description,
  ctaLabel,
  ctaHref,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
  ctaLabel: string;
  ctaHref: string;
}) {
  return (
    <div className="rounded-2xl border border-dashed border-zinc-300 bg-zinc-50/60 px-5 py-8 text-center">
      <span className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-white text-zinc-700 shadow-sm">
        {icon}
      </span>
      <h3 className="mt-3 text-sm font-semibold text-zinc-900">{title}</h3>
      <p className="mx-auto mt-1 max-w-md text-xs text-zinc-500">{description}</p>
      <Link
        href={ctaHref}
        className="mt-3 inline-flex items-center gap-1.5 rounded-xl bg-zinc-900 px-3.5 py-2 text-xs font-semibold text-white transition hover:bg-zinc-700"
      >
        {ctaLabel}
        <ArrowRight className="h-3.5 w-3.5" />
      </Link>
    </div>
  );
}
