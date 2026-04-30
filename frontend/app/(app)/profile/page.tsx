"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import {
  ArrowRight,
  Calendar,
  Check,
  Coins,
  Copy,
  KeyRound,
  LayoutDashboard,
  LogOut,
  Mail,
  Plus,
  ShieldCheck,
  Sparkles,
  TrendingUp,
} from "lucide-react";
import { toast } from "sonner";
import { logout as authLogout, me, requestPasswordReset, type User } from "@/lib/api/auth";
import { listCreditTransactions, type CreditTransaction } from "@/lib/api/billing";
import { RedeemVoucherCard } from "@/components/billing/RedeemVoucherCard";
import { buildLoginRedirectHref } from "@/lib/auth/redirect";
import { getToken } from "@/lib/auth/token";
import { isUnauthorized } from "@/lib/api/errors";

const ADMIN_EMAIL = "1@mail.com";

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString("ru-RU", {
      day: "numeric",
      month: "long",
      year: "numeric",
    });
  } catch {
    return iso;
  }
}

const TOOL_LABELS: Record<string, string> = {
  "document-analyzer": "Анализатор документов",
  "contract-checker": "Проверка договоров",
  "data-extractor": "Сравнение документов",
  "tender-analyzer": "Обзор судебной практики",
  "risk-analyzer": "Поиск рисков",
  "handwriting-recognition": "Распознавание рукописных документов",
  "legal-style-translator": "Перевод на юридический",
  "legal-text-simplifier": "Пересказ юридического текста",
  "spelling-checker": "Проверка правописания",
  "foreign-language-translator": "Перевод с иностранного",
  "legal-document-design-review": "Оформление документов",
  // document-analyzer sub-plugins → показываем как родительский инструмент
  key_points: "Анализатор документов",
  dates_deadlines: "Анализатор документов",
  risk_analyzer: "Анализатор документов",
  suggested_edits: "Анализатор документов",
};

const PACKAGE_LABELS: Record<string, string> = {
  start: "Пакет «Start»",
  pro: "Пакет «Pro»",
  business: "Пакет «Business»",
};

function describeTransaction(tx: CreditTransaction): string {
  if (tx.reason === "purchase") {
    if (tx.reference && PACKAGE_LABELS[tx.reference]) return PACKAGE_LABELS[tx.reference];
    return "Пополнение баланса";
  }
  if (tx.reason === "tool_run") {
    if (tx.reference && TOOL_LABELS[tx.reference]) return TOOL_LABELS[tx.reference];
    return "Использование инструмента";
  }
  if (tx.reason === "refund") return "Возврат";
  if (tx.reason === "bonus") return "Бонусные кредиты";
  if (tx.reason === "adjustment") return "Корректировка администратора";
  if (tx.reason === "admin_grant") return "Начисление администратором";
  if (tx.reason === "admin_debit") return "Списание администратором";
  if (tx.reason === "voucher_redeem") {
    return tx.reference ? `Ваучер ${tx.reference}` : "Активация ваучера";
  }
  return tx.reason;
}

function planLabel(plan: string): string {
  switch (plan) {
    case "free":
      return "Free";
    case "start":
      return "Start";
    case "pro":
      return "Pro";
    case "business":
      return "Business";
    default:
      return plan.charAt(0).toUpperCase() + plan.slice(1);
  }
}

export default function ProfilePage() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [transactions, setTransactions] = useState<CreditTransaction[]>([]);
  const [emailCopied, setEmailCopied] = useState(false);
  const [resetting, setResetting] = useState(false);

  useEffect(() => {
    const token = getToken();
    if (!token) {
      router.replace(buildLoginRedirectHref("/profile"));
      return;
    }
    let cancelled = false;
    me()
      .then((u) => {
        if (cancelled) return;
        setUser(u);
        setLoading(false);
      })
      .catch((err) => {
        if (cancelled) return;
        if (isUnauthorized(err)) {
          router.replace(buildLoginRedirectHref("/profile"));
          return;
        }
        toast.error("Не удалось загрузить профиль");
        setLoading(false);
      });
    listCreditTransactions()
      .then((items) => {
        if (cancelled) return;
        setTransactions(items);
      })
      .catch(() => {
        // silent fail — list is optional
      });
    return () => {
      cancelled = true;
    };
  }, [router]);

  const spendings = useMemo(() => transactions.filter((t) => t.amount < 0), [transactions]);
  const topups = useMemo(() => transactions.filter((t) => t.amount > 0), [transactions]);

  const avatarInitial = useMemo(() => (user?.email || "S").slice(0, 1).toUpperCase(), [user]);
  const accountName = user?.email ? user.email.split("@")[0] : "—";
  const isAdmin = user?.email?.toLowerCase() === ADMIN_EMAIL;

  async function handleCopyEmail() {
    if (!user?.email) return;
    try {
      await navigator.clipboard.writeText(user.email);
      setEmailCopied(true);
      setTimeout(() => setEmailCopied(false), 1600);
    } catch {
      toast.error("Не удалось скопировать");
    }
  }

  async function handleRequestPasswordChange() {
    if (!user?.email || resetting) return;
    setResetting(true);
    try {
      await requestPasswordReset(user.email);
      toast.success("Письмо для смены пароля отправлено");
    } catch {
      toast.error("Не удалось отправить письмо");
    } finally {
      setResetting(false);
    }
  }

  function handleLogout() {
    authLogout();
    router.push("/");
  }

  if (loading || !user) {
    return (
      <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
        <div className="h-48 animate-pulse rounded-[32px] border border-stone-200 bg-stone-100" />
        <div className="mt-6 grid gap-4 sm:grid-cols-3">
          <div className="h-28 animate-pulse rounded-[24px] border border-stone-200 bg-stone-100" />
          <div className="h-28 animate-pulse rounded-[24px] border border-stone-200 bg-stone-100" />
          <div className="h-28 animate-pulse rounded-[24px] border border-stone-200 bg-stone-100" />
        </div>
      </div>
    );
  }

  const balanceLabel = user.credit_balance.toLocaleString("ru-RU");
  const memberSince = formatDate(user.created_at);

  return (
    <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 sm:py-14 lg:px-8">
      {/* Hero card */}
      <section className="relative overflow-hidden rounded-[36px] border border-stone-200 bg-white p-6 shadow-[0_18px_60px_rgba(28,25,23,0.08)] sm:p-8">
        <div className="relative flex flex-col gap-6 sm:flex-row sm:items-center">
          <div className="flex h-24 w-24 flex-shrink-0 items-center justify-center rounded-[28px] border border-stone-200 bg-stone-950 text-3xl font-bold text-[#ffd43b] shadow-[0_18px_40px_rgba(28,25,23,0.16)]">
            <span className="select-none">
              {avatarInitial}
            </span>
          </div>

          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="truncate text-2xl font-bold tracking-[-0.02em] text-stone-950 sm:text-3xl">
                {accountName}
              </h1>
              <span className="inline-flex items-center gap-1 rounded-full border border-amber-200 bg-[#fff7cc] px-2.5 py-0.5 text-xs font-semibold text-amber-700">
                <Sparkles className="h-3 w-3" />
                {planLabel(user.plan)}
              </span>
              {isAdmin && (
                <span className="inline-flex items-center gap-1 rounded-full border border-amber-200 bg-amber-50 px-2.5 py-0.5 text-xs font-semibold text-amber-700">
                  <ShieldCheck className="h-3 w-3" />
                  Администратор
                </span>
              )}
            </div>
            <button
              type="button"
              onClick={handleCopyEmail}
              className="mt-2 inline-flex items-center gap-2 rounded-full border border-stone-200 bg-stone-50 px-3 py-1.5 text-sm text-stone-600 transition hover:border-stone-300 hover:bg-stone-100"
            >
              <Mail className="h-3.5 w-3.5" />
              <span className="truncate">{user.email}</span>
              {emailCopied ? (
                <Check className="h-3.5 w-3.5 text-amber-600" />
              ) : (
                <Copy className="h-3.5 w-3.5 text-stone-400" />
              )}
            </button>
            <p className="mt-2 flex items-center gap-1.5 text-xs text-stone-400">
              <Calendar className="h-3.5 w-3.5" />С нами с {memberSince}
            </p>
          </div>
        </div>
      </section>

      {/* Stats */}
      <section className="mt-6 grid gap-4 sm:grid-cols-3">
        <div className="relative overflow-hidden rounded-[28px] border border-amber-200 bg-[#fff7cc] p-5">
          <div className="relative">
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-amber-700">
              <Coins className="h-3.5 w-3.5" />
              Баланс
            </div>
            <div className="mt-3">
              <p className="inline-flex items-center gap-2 text-4xl font-bold tracking-[-0.03em] text-stone-950 tabular-nums">
                <Coins className="h-7 w-7 flex-shrink-0 text-amber-600" aria-label="кредиты" />
                <span>{balanceLabel}</span>
              </p>
              <Link
                href="/pricing"
                className="mt-3 inline-flex w-fit items-center gap-1.5 rounded-full bg-[#ffd43b] px-4 py-2 text-sm font-bold text-stone-950 shadow-[0_12px_30px_rgba(245,158,11,0.18)] transition hover:bg-[#f6c343]"
              >
                <Plus className="h-4 w-4" strokeWidth={3} />
                Пополнить
              </Link>
            </div>
          </div>
        </div>

        <div className="rounded-[24px] border border-stone-200 bg-white p-5">
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-stone-500">
            <TrendingUp className="h-3.5 w-3.5" />
            Тариф
          </div>
          <p className="mt-2 text-2xl font-semibold tracking-[-0.01em] text-stone-950">
            {planLabel(user.plan)}
          </p>
          <p className="mt-1 text-xs text-stone-500">
            {user.plan === "free" ? "Стартовый план" : "Активные возможности"}
          </p>
        </div>

        <div className="rounded-[24px] border border-stone-200 bg-white p-5">
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-stone-500">
            <Calendar className="h-3.5 w-3.5" />
            Дата регистрации
          </div>
          <p className="mt-2 text-2xl font-semibold tracking-[-0.01em] text-stone-950">
            {memberSince}
          </p>
          <p className="mt-1 text-xs text-stone-500">ID: {user.id}</p>
        </div>
      </section>

      {/* Redeem voucher */}
      <section className="mt-4">
        <RedeemVoucherCard
          onRedeemed={(newBalance) =>
            setUser((prev) => (prev ? { ...prev, credit_balance: newBalance } : prev))
          }
        />
      </section>

      {/* Two-column section: spending + top-ups */}
      <section className="mt-6 grid gap-4 md:grid-cols-2">
        {/* Spending */}
        <div className="rounded-[24px] border border-stone-200 bg-white p-5">
          <div className="flex items-center justify-between">
            <h2 className="flex items-center gap-2 text-base font-semibold tracking-[-0.01em] text-stone-950">
              <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-rose-50 text-rose-600 ring-1 ring-rose-100">
                <Coins className="h-3.5 w-3.5" />
              </span>
              Списания
            </h2>
            <span className="text-[11px] font-semibold uppercase tracking-wider text-stone-400">
              {spendings.length}
            </span>
          </div>
          {spendings.length === 0 ? (
            <p className="mt-4 rounded-[18px] border border-dashed border-stone-200 bg-stone-50 p-6 text-center text-sm text-stone-500">
              Пока нет списаний
            </p>
          ) : (
            <ul className="mt-3 divide-y divide-stone-100">
              {spendings.slice(0, 5).map((tx) => (
                <li key={tx.id} className="flex items-center justify-between gap-3 py-2.5">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-stone-800">
                      {describeTransaction(tx)}
                    </p>
                    {tx.document_name && (
                      <p className="mt-0.5 truncate text-[12px] text-stone-500" title={tx.document_name}>
                        {tx.document_name}
                        {tx.pages != null && (
                          <span className="ml-1 text-stone-400">· {tx.pages} стр.</span>
                        )}
                      </p>
                    )}
                    <p className="mt-0.5 text-[11px] text-stone-400">{formatDate(tx.created_at)}</p>
                  </div>
                  <div className="flex-shrink-0 text-sm font-semibold tabular-nums text-rose-600">
                    {tx.amount.toLocaleString("ru-RU")}
                    <span className="ml-0.5 text-[11px] font-medium text-stone-400">кр.</span>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Top-ups */}
        <div className="rounded-[24px] border border-amber-200/70 bg-gradient-to-br from-[#fff7cc]/60 via-white to-white p-5">
          <div className="flex items-center justify-between">
            <h2 className="flex items-center gap-2 text-base font-semibold tracking-[-0.01em] text-stone-950">
              <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#fff7cc] text-amber-700 ring-1 ring-amber-200">
                <Plus className="h-3.5 w-3.5" strokeWidth={3} />
              </span>
              Пополнения
            </h2>
            <Link
              href="/pricing"
              className="text-xs font-semibold text-amber-700 transition hover:text-stone-900"
            >
              Пополнить →
            </Link>
          </div>
          {topups.length === 0 ? (
            <p className="mt-4 rounded-[18px] border border-dashed border-amber-200/60 bg-white/70 p-6 text-center text-sm text-stone-500">
              Пополнений ещё не было
            </p>
          ) : (
            <ul className="mt-3 divide-y divide-amber-100/70">
              {topups.slice(0, 5).map((tx) => (
                <li key={tx.id} className="flex items-center justify-between gap-3 py-2.5">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-stone-800">
                      {describeTransaction(tx)}
                    </p>
                    <p className="mt-0.5 text-[11px] text-stone-400">{formatDate(tx.created_at)}</p>
                  </div>
                  <div className="flex-shrink-0 text-sm font-semibold tabular-nums text-amber-700">
                    +{tx.amount.toLocaleString("ru-RU")}
                    <span className="ml-0.5 text-[11px] font-medium text-amber-600/70">кр.</span>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>

      {/* Quick actions */}
      <section className="mt-6">
        <div className="rounded-[24px] border border-stone-200 bg-white p-5">
          <h2 className="text-base font-semibold tracking-[-0.01em] text-stone-950">
            Быстрые действия
          </h2>
          <div className="mt-3 flex flex-col gap-1.5">
            <Link
              href="/dashboard"
              className="group/item flex items-center gap-3 rounded-[18px] border border-transparent px-3 py-2.5 text-sm font-medium text-stone-700 transition hover:border-stone-200 hover:bg-stone-50 hover:text-stone-950"
            >
              <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-stone-100 text-stone-600 ring-1 ring-stone-200/80 transition group-hover/item:bg-stone-200">
                <LayoutDashboard className="h-4 w-4" />
              </span>
              <span className="flex-1">Кабинет</span>
              <ArrowRight className="h-4 w-4 text-stone-400 transition group-hover/item:translate-x-0.5 group-hover/item:text-stone-700" />
            </Link>
            <button
              type="button"
              onClick={handleRequestPasswordChange}
              disabled={resetting}
              className="group/item flex items-center gap-3 rounded-[18px] border border-transparent px-3 py-2.5 text-left text-sm font-medium text-stone-700 transition hover:border-stone-200 hover:bg-stone-50 hover:text-stone-950 disabled:cursor-wait disabled:opacity-60"
            >
              <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-amber-50 text-amber-700 ring-1 ring-amber-100 transition group-hover/item:bg-amber-100">
                <KeyRound className="h-4 w-4" />
              </span>
              <span className="flex-1">
                {resetting ? "Отправляем письмо…" : "Сменить пароль"}
              </span>
              <ArrowRight className="h-4 w-4 text-stone-400 transition group-hover/item:translate-x-0.5 group-hover/item:text-stone-700" />
            </button>
            {isAdmin && (
              <Link
                href="/admin"
                className="group/item flex items-center gap-3 rounded-[18px] border border-transparent px-3 py-2.5 text-sm font-medium text-stone-700 transition hover:border-stone-200 hover:bg-stone-50 hover:text-stone-950"
              >
                <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#fff7cc] text-amber-700 ring-1 ring-amber-100 transition group-hover/item:bg-[#fff7cc]">
                  <ShieldCheck className="h-4 w-4" />
                </span>
                <span className="flex-1">Админ-панель</span>
                <ArrowRight className="h-4 w-4 text-stone-400 transition group-hover/item:translate-x-0.5 group-hover/item:text-stone-700" />
              </Link>
            )}

            <div className="my-1 h-px bg-stone-200/80" />

            <button
              type="button"
              onClick={handleLogout}
              className="group/item flex items-center gap-3 rounded-[18px] border border-transparent px-3 py-2.5 text-left text-sm font-medium text-rose-700 transition hover:border-rose-100 hover:bg-rose-50 hover:text-rose-800"
            >
              <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-rose-50 text-rose-600 ring-1 ring-rose-100 transition group-hover/item:bg-rose-100">
                <LogOut className="h-4 w-4" />
              </span>
              <span className="flex-1">Выйти</span>
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}
