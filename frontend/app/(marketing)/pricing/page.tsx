"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  ArrowRight,
  BadgeCheck,
  Clock3,
  CreditCard,
  FileCheck2,
  History,
  LockKeyhole,
  ReceiptText,
  Scale,
  ShieldCheck,
  Sparkles,
  UserRound,
  WalletCards,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { PricingTable } from "@/components/marketing/PricingTable";
import { getToken } from "@/lib/auth/token";
import { getUsageStatus, type UsageStatus } from "@/lib/api/usage";
import { purchaseCredits, type CreditPackage } from "@/lib/api/billing";

const costExamples = [
  ["AI-вопрос по документу", "30-60+", "Короткие уточнения, поиск пунктов и объяснения"],
  ["OCR и рукопись", "40+", "Распознавание сканов, фото и PDF-страниц"],
  ["Анализ договора", "80-160+", "Риски, стороны, даты, обязательства и выводы"],
  ["Сравнение документов", "160+", "Разница версий, новые риски и удалённые условия"],
];

const trustItems = [
  {
    icon: LockKeyhole,
    title: "Данные под контролем",
    text: "Перед анализом можно включить обезличивание и убрать чувствительные фрагменты.",
  },
  {
    icon: ReceiptText,
    title: "Прозрачное списание",
    text: "Показываем минимальную стоимость действия и фиксируем итоговое списание в истории.",
  },
  {
    icon: BadgeCheck,
    title: "Без сгорания",
    text: "Пакеты остаются на балансе, пока вы реально не запускаете AI-операции.",
  },
];

const balanceEvents: Array<{
  title: string;
  amount: string;
  icon: LucideIcon;
}> = [
  { title: "Анализ договора поставки", amount: "-120", icon: FileCheck2 },
  { title: "OCR PDF, 8 страниц", amount: "-32", icon: Scale },
  { title: "Пополнение Pro", amount: "+7 000", icon: CreditCard },
];

export default function PricingPage() {
  const [usage, setUsage] = useState<UsageStatus | null>(null);
  const [purchasing, setPurchasing] = useState(false);
  const [purchaseDone, setPurchaseDone] = useState(false);

  useEffect(() => {
    if (getToken()) {
      getUsageStatus().then(setUsage).catch(() => setUsage(null));
    }
  }, []);

  async function handlePurchase(packageId: CreditPackage["id"]) {
    setPurchasing(true);
    setPurchaseDone(false);
    try {
      await purchaseCredits(packageId);
      const next = await getUsageStatus();
      setUsage(next);
      setPurchaseDone(true);
    } finally {
      setPurchasing(false);
    }
  }

  return (
    <main className="min-h-screen bg-[#f6f4ef] text-stone-950">
      <section className="relative overflow-hidden border-b border-stone-200 bg-[linear-gradient(135deg,#f9f8f4_0%,#eef8f2_46%,#f5f1e8_100%)]">
        <div className="mx-auto max-w-7xl px-4 pb-10 pt-8 sm:px-6 lg:px-8 lg:pb-14">
          <div className="mb-7 flex flex-col gap-3 rounded-[24px] border border-stone-200 bg-white/82 px-4 py-3 shadow-[0_12px_40px_rgba(28,25,23,0.07)] backdrop-blur md:flex-row md:items-center md:justify-between">
            <nav className="flex flex-wrap items-center gap-2">
              <a
                href="#credit-packages"
                className="inline-flex items-center gap-2 rounded-full bg-stone-900 px-4 py-2 text-sm font-semibold text-white"
              >
                <WalletCards className="h-4 w-4" />
                Пакеты
              </a>
              <a
                href="#credit-details"
                className="inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold text-stone-600 hover:bg-stone-100 hover:text-stone-900"
              >
                <CreditCard className="h-4 w-4" />
                Списания
              </a>
              <Link
                href="/dashboard"
                className="inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold text-stone-600 hover:bg-stone-100 hover:text-stone-900"
              >
                <History className="h-4 w-4" />
                История
              </Link>
            </nav>
            <Link
              href="/dashboard"
              className="inline-flex items-center justify-center rounded-full border border-emerald-200 bg-emerald-50 px-4 py-2 text-sm font-semibold text-emerald-800 hover:bg-emerald-100"
            >
              Открыть кабинет
            </Link>
          </div>

          <div className="grid gap-8 lg:grid-cols-[1.08fr_0.92fr] lg:items-center">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-white/82 px-3 py-1.5 text-[11px] font-bold uppercase tracking-[0.2em] text-emerald-700 shadow-sm">
                <Sparkles className="h-3.5 w-3.5" />
                Кредиты SmartAnalyzer
              </div>
              <h1 className="mt-5 max-w-4xl text-5xl font-semibold leading-[0.92] tracking-[-0.055em] text-stone-950 sm:text-6xl lg:text-7xl">
                Платите за анализ, а не за календарь.
              </h1>
              <p className="mt-6 max-w-2xl text-lg leading-8 text-stone-600">
                Пополняйте баланс кредитов и тратьте его только на реальные действия:
                OCR, анализ, сравнение документов и AI-вопросы. Кредиты не сгорают.
              </p>

              <div className="mt-7 flex flex-col gap-3 sm:flex-row">
                <a
                  href="#credit-packages"
                  className="inline-flex items-center justify-center rounded-full bg-stone-950 px-6 py-3 text-sm font-bold text-white shadow-[0_16px_42px_rgba(28,25,23,0.22)] hover:bg-stone-800"
                >
                  Выбрать пакет
                  <ArrowRight className="ml-2 h-4 w-4" />
                </a>
                <a
                  href="#credit-details"
                  className="inline-flex items-center justify-center rounded-full border border-stone-300 bg-white/80 px-6 py-3 text-sm font-bold text-stone-800 hover:bg-white"
                >
                  Посмотреть списания
                </a>
              </div>

              <div className="mt-8 grid max-w-2xl grid-cols-1 gap-3 sm:grid-cols-3">
                {[
                  ["0 ₽/мес", "нет обязательной подписки"],
                  ["100", "кредитов для старта"],
                  ["∞", "срок действия пакета"],
                ].map(([value, label]) => (
                  <div key={label} className="rounded-2xl border border-stone-200 bg-white/76 p-4 shadow-sm">
                    <p className="text-2xl font-bold tracking-[-0.04em] text-stone-950">{value}</p>
                    <p className="mt-1 text-xs font-semibold uppercase tracking-[0.12em] text-stone-500">{label}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="relative">
              <div className="rounded-[34px] border border-stone-900/10 bg-[#111827] p-5 text-white shadow-[0_28px_84px_rgba(15,23,42,0.28)]">
                <div className="flex items-center justify-between border-b border-white/10 pb-4">
                  <div>
                    <p className="text-sm font-semibold text-slate-400">Текущий баланс</p>
                    <p className="mt-1 text-4xl font-bold tracking-[-0.05em]">
                      {usage ? usage.credit_balance.toLocaleString("ru-RU") : "—"}
                      <span className="ml-2 text-base text-emerald-300">кредитов</span>
                    </p>
                  </div>
                  <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-emerald-300/30 bg-emerald-300/10 text-emerald-200">
                    <WalletCards className="h-7 w-7" />
                  </div>
                </div>

                <div className="mt-5 space-y-3">
                  {balanceEvents.map(({ title, amount, icon: Icon }) => (
                    <div key={title} className="flex items-center justify-between rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3">
                      <div className="flex items-center gap-3">
                        <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/[0.08] text-emerald-200">
                          <Icon className="h-5 w-5" />
                        </span>
                        <p className="text-sm font-semibold text-slate-100">{title}</p>
                      </div>
                      <p className={`text-sm font-bold ${String(amount).startsWith("+") ? "text-emerald-300" : "text-slate-300"}`}>
                        {amount}
                      </p>
                    </div>
                  ))}
                </div>

                <div className="mt-5 rounded-2xl bg-[linear-gradient(135deg,#ecfdf5,#dff7ea)] p-4 text-stone-950">
                  <p className="text-sm font-bold">Перед запуском видно примерное списание</p>
                  <p className="mt-1 text-sm leading-6 text-stone-600">
                    Пользователь видит минимальную стоимость до анализа и итоговое списание после результата.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
        {purchaseDone && (
          <div
            className="mx-auto mb-6 max-w-3xl rounded-2xl border border-emerald-200 bg-emerald-50/90 px-4 py-3 text-center text-sm font-medium text-emerald-700"
            role="status"
          >
            Баланс кредитов пополнен.
          </div>
        )}

        <div id="credit-packages" className="scroll-mt-28">
          <PricingTable
            usage={usage}
            onPurchaseCredits={handlePurchase}
            purchasing={purchasing}
          />
        </div>

        <section id="credit-details" className="mt-10 scroll-mt-28">
          <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-emerald-700">Примеры списаний</p>
              <h2 className="mt-2 text-3xl font-semibold tracking-[-0.04em] text-stone-950">
                Пользователь заранее понимает расход.
              </h2>
            </div>
            <p className="max-w-xl text-sm leading-6 text-stone-600">
              Точные значения зависят от размера документа и ответа модели. Для больших файлов итоговое списание может вырасти по фактическим токенам.
            </p>
          </div>

          <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {costExamples.map(([title, credits, text]) => (
              <div key={title} className="rounded-[22px] border border-stone-200 bg-white p-5 shadow-[0_16px_48px_rgba(15,23,42,0.06)]">
                <p className="text-sm font-bold text-stone-950">{title}</p>
                <p className="mt-4 text-4xl font-semibold tracking-[-0.06em] text-emerald-700">{credits}</p>
                <p className="mt-1 text-xs font-bold uppercase tracking-[0.14em] text-stone-400">кредитов</p>
                <p className="mt-4 text-sm leading-6 text-stone-600">{text}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="mt-10 grid gap-4 lg:grid-cols-3">
          {trustItems.map(({ icon: Icon, title, text }) => (
            <div key={title} className="rounded-[24px] border border-stone-200 bg-white/86 p-5 shadow-[0_14px_44px_rgba(15,23,42,0.06)]">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-emerald-200 bg-emerald-50 text-emerald-700">
                <Icon className="h-5 w-5" />
              </div>
              <h3 className="mt-4 text-lg font-bold tracking-[-0.02em] text-stone-950">{title}</h3>
              <p className="mt-2 text-sm leading-6 text-stone-600">{text}</p>
            </div>
          ))}
        </section>

        <section className="mt-10 rounded-[30px] border border-emerald-200 bg-[linear-gradient(135deg,rgba(236,253,245,0.94),rgba(255,255,255,0.96))] p-5 shadow-[0_14px_44px_rgba(16,185,129,0.08)] sm:p-6">
          <div className="grid gap-4 md:grid-cols-[0.9fr_1.1fr] md:items-center">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-emerald-700">Безопасность данных</p>
              <h2 className="mt-2 text-2xl font-semibold tracking-[-0.04em] text-stone-950">
                Для документов, где важна конфиденциальность.
              </h2>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-2xl border border-emerald-200 bg-white/82 px-4 py-3 text-sm leading-7 text-stone-700">
                <div className="mb-3 inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-emerald-200 bg-emerald-50 text-emerald-700">
                  <UserRound className="h-5 w-5" />
                </div>
                <p>В модель передаются только предварительно обезличенные данные.</p>
              </div>
              <div className="rounded-2xl border border-emerald-200 bg-white/82 px-4 py-3 text-sm leading-7 text-stone-700">
                <div className="mb-3 inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-emerald-200 bg-emerald-50 text-emerald-700">
                  <ShieldCheck className="h-5 w-5" />
                </div>
                <p>Чувствительные payload-данные можно хранить и передавать в зашифрованном контуре.</p>
              </div>
            </div>
          </div>
        </section>

        <section className="mt-10 rounded-[30px] bg-stone-950 p-6 text-white shadow-[0_24px_80px_rgba(15,23,42,0.2)] sm:p-8">
          <div className="flex flex-col gap-5 md:flex-row md:items-center md:justify-between">
            <div>
                <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.08] px-3 py-1 text-[11px] font-bold uppercase tracking-[0.18em] text-emerald-200">
                <Clock3 className="h-3.5 w-3.5" />
                без обязательств
              </div>
              <h2 className="mt-4 max-w-2xl text-3xl font-semibold leading-tight tracking-[-0.04em]">
                Начните с небольшого пакета и пополняйте баланс по мере работы.
              </h2>
            </div>
            <a
              href="#credit-packages"
              className="inline-flex items-center justify-center rounded-full bg-emerald-400 px-6 py-3 text-sm font-bold text-stone-950 hover:bg-emerald-300"
            >
              Выбрать пакет
              <ArrowRight className="ml-2 h-4 w-4" />
            </a>
          </div>
        </section>
      </div>
    </main>
  );
}
