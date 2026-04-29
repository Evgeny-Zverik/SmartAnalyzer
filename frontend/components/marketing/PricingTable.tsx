"use client";

import { useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { ArrowUpRight, Check, CircleHelp, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/Button";
import type { CreditPackage } from "@/lib/api/billing";
import type { UsageStatus } from "@/lib/api/usage";

type PlanKey = "free" | CreditPackage["id"] | "enterprise";
type PurchasablePlanKey = CreditPackage["id"] | "enterprise";

const plans: Array<{
  key: PlanKey;
  name: string;
  credits: string;
  price: string;
  description: string;
  fit: string;
  estimate: string;
  badge?: string;
  save?: string;
  featured?: boolean;
}> = [
  {
    key: "free",
    name: "Free",
    credits: "100 кредитов",
    price: "0 ₽",
    description:
      "Хватит, чтобы проверить интерфейс, запустить короткий анализ и понять формат результата.",
    fit: "Тест сервиса",
    estimate: "1 короткий анализ или несколько AI-вопросов",
  },
  {
    key: "start",
    name: "Start",
    credits: "2 000 кредитов",
    price: "490 ₽",
    description:
      "Для редкой работы: несколько договоров, OCR небольших файлов и точечные AI-вопросы.",
    fit: "До 20-30 коротких операций",
    estimate: "примерно 12-25 анализов договора",
  },
  {
    key: "pro",
    name: "Pro",
    credits: "7 000 кредитов",
    price: "1 490 ₽",
    description:
      "Оптимальный запас для регулярного анализа, сравнения документов и подготовки отчётов.",
    fit: "Лучший выбор для старта",
    estimate: "примерно 45-85 анализов договора",
    badge: "Рекомендуем",
    save: "лучший старт",
    featured: true,
  },
  {
    key: "business",
    name: "Business",
    credits: "20 000 кредитов",
    price: "3 990 ₽",
    description:
      "Для интенсивной загрузки документов, больших файлов, сравнений и командной работы.",
    fit: "Для активной рабочей недели",
    estimate: "примерно 125-240 анализов договора",
    save: "выгоднее Pro",
  },
  {
    key: "enterprise",
    name: "Enterprise",
    credits: "от 100 000 кредитов",
    price: "Договор",
    description:
      "Корпоративный баланс, лимиты по сотрудникам, закрывающие документы, SLA и SSO.",
    fit: "Для отдела или компании",
    estimate: "объем под команду и регламенты",
  },
];

type PricingTableProps = {
  compact?: boolean;
  usage?: UsageStatus | null;
  onPurchaseCredits?: (packageId: CreditPackage["id"]) => void | Promise<void>;
  purchasing?: boolean;
};

function isCreditPackage(key: PlanKey): key is CreditPackage["id"] {
  return key === "start" || key === "pro" || key === "business";
}

function isPurchasablePlanKey(
  value: string | null,
): value is PurchasablePlanKey {
  return (
    value === "start" ||
    value === "pro" ||
    value === "business" ||
    value === "enterprise"
  );
}

export function PricingTable({
  compact = false,
  usage = null,
  onPurchaseCredits,
  purchasing = false,
}: PricingTableProps) {
  const searchParams = useSearchParams();
  const requestedPackage = searchParams.get("package");
  const [selected, setSelected] = useState<PurchasablePlanKey>(
    isPurchasablePlanKey(requestedPackage) ? requestedPackage : "pro",
  );
  const selectedPlan = useMemo(
    () => plans.find((plan) => plan.key === selected) ?? plans[2],
    [selected],
  );
  const canPurchase =
    usage != null && isCreditPackage(selected) && onPurchaseCredits;
  const isLoggedIn = usage != null;
  const registerHref = `/register?returnTo=${encodeURIComponent(`/pricing?package=${selected}`)}`;
  const visiblePlans = plans.filter(
    (plan): plan is (typeof plans)[number] & { key: PurchasablePlanKey } =>
      plan.key !== "free",
  );

  if (compact) {
    return (
      <div className="grid gap-3 md:grid-cols-3">
        {plans.slice(0, 3).map((plan) => (
          <div
            key={plan.key}
            className={`rounded-[22px] border p-5 shadow-[0_16px_44px_rgba(15,23,42,0.08)] ${
              plan.featured
                ? "border-emerald-300 bg-emerald-50"
                : "border-zinc-200 bg-white"
            }`}
          >
            <p className="text-lg font-semibold text-zinc-950">{plan.name}</p>
            <p className="mt-2 text-sm font-semibold text-emerald-700">
              {plan.credits}
            </p>
            <p className="mt-4 text-3xl font-semibold text-zinc-950">
              {plan.price}
            </p>
          </div>
        ))}
      </div>
    );
  }

  return (
    <section className="overflow-hidden rounded-[32px] border border-slate-800 bg-[#101622] p-5 text-white shadow-[0_30px_90px_rgba(2,6,23,0.28)] sm:p-7">
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <div className="inline-flex items-center gap-2 rounded-full border border-emerald-300/20 bg-emerald-300/10 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.18em] text-emerald-200">
            <Sparkles className="h-3.5 w-3.5" />
            Выбор пакета
          </div>
          <h2 className="mt-3 text-3xl font-semibold tracking-[-0.03em]">
            Цены
          </h2>
          <p className="mt-2 max-w-2xl text-base font-medium leading-7 text-slate-400">
            Выберите пакет кредитов. Кредиты не сгорают и списываются только за
            действия.
          </p>
        </div>
        <div className="rounded-2xl border border-slate-700 bg-slate-900/70 px-4 py-3 text-sm text-slate-300">
          Выбрано:{" "}
          <span className="font-bold text-white">{selectedPlan.name}</span>
          <span className="mx-2 text-slate-600">/</span>
          <span className="font-bold text-emerald-300">
            {selectedPlan.price}
          </span>
        </div>
      </div>

      <div className="mt-8 grid gap-4 lg:grid-cols-2">
        {visiblePlans.map((plan) => {
          const active = selected === plan.key;
          return (
            <button
              key={plan.key}
              type="button"
              onClick={() => setSelected(plan.key)}
              className={`group relative min-h-[184px] overflow-hidden rounded-[24px] border p-5 text-left transition ${
                active
                  ? "border-emerald-400 bg-[linear-gradient(135deg,#18345a,#18283f_45%,#1f4a3a)] shadow-[0_20px_70px_rgba(16,185,129,0.18)]"
                  : "border-slate-800 bg-[#151d2c] hover:border-slate-600 hover:bg-[#192235]"
              }`}
              aria-pressed={active}
            >
              {plan.save && (
                <span className="absolute right-0 top-0 rounded-bl-[18px] bg-[linear-gradient(90deg,#2563eb,#b84def)] px-4 py-1.5 text-xs font-bold uppercase tracking-[0.08em] text-white">
                  {plan.save}
                </span>
              )}

              <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <div className="flex min-w-0 items-start gap-4">
                  <span
                    className={`mt-1 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border ${
                      active
                        ? "border-emerald-300 bg-emerald-400/20 text-emerald-200"
                        : "border-slate-600 text-transparent"
                    }`}
                  >
                    <Check className="h-3 w-3" />
                  </span>
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p
                        className={`text-2xl font-bold ${active ? "text-emerald-300" : "text-white"}`}
                      >
                        {plan.name}
                      </p>
                      {plan.badge && (
                        <span className="rounded-full border border-emerald-300/50 bg-emerald-300/12 px-2.5 py-1 text-[11px] font-bold uppercase tracking-[0.12em] text-emerald-200">
                          {plan.badge}
                        </span>
                      )}
                    </div>
                    <div className="mt-2 flex flex-wrap items-center gap-2 text-sm font-semibold text-slate-200">
                      <span>Вы получаете</span>
                      <span className="rounded-full bg-slate-700/80 px-3 py-1 text-white">
                        {plan.credits}
                      </span>
                    </div>
                    <p className="mt-3 text-sm font-semibold text-emerald-200/90">
                      {plan.fit}
                    </p>
                    <p className="mt-2 text-sm font-semibold text-slate-300">
                      {plan.estimate}
                    </p>
                  </div>
                </div>
                <p className="shrink-0 text-3xl font-bold tracking-[-0.04em] text-white sm:text-right">
                  {plan.price}
                </p>
              </div>

              <p className="mt-6 max-w-3xl text-base font-semibold leading-7 text-slate-100">
                {plan.description}
              </p>
            </button>
          );
        })}
      </div>

      <div className="mt-8 flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
        <a
          href="#credit-spend"
          className="inline-flex items-center gap-2 text-sm font-semibold text-emerald-300 hover:text-emerald-200"
        >
          <CircleHelp className="h-4 w-4" />
          Подробнее о стоимости кредитов и списаниях
        </a>

        {selected === "enterprise" ? (
          <Button
            href="mailto:sales@smartanalyzer.example"
            className="min-w-[220px] rounded-xl bg-[linear-gradient(90deg,#2563eb,#b84def)] px-7 py-4 text-base font-bold text-white hover:opacity-95"
          >
            Связаться <ArrowUpRight className="ml-2 h-5 w-5" />
          </Button>
        ) : canPurchase ? (
          <Button
            type="button"
            disabled={purchasing}
            onClick={() => onPurchaseCredits(selected)}
            className="min-w-[220px] rounded-xl bg-emerald-500 px-7 py-4 text-base font-bold text-slate-950 hover:bg-emerald-400"
          >
            {purchasing ? "Пополнение..." : `Приобрести ${selectedPlan.price}`}
          </Button>
        ) : (
          <Button
            href={registerHref}
            className="min-w-[220px] rounded-xl bg-emerald-500 px-7 py-4 text-base font-bold text-slate-950 hover:bg-emerald-400"
          >
            Зарегистрироваться и купить {selectedPlan.name}
          </Button>
        )}
      </div>

      <div
        id="credit-explainer"
        className="mt-8 rounded-[18px] border border-slate-700 bg-slate-800/70 p-5"
      >
        <h3 className="text-xl font-bold">Что такое кредит?</h3>
        <p className="mt-3 max-w-5xl text-base leading-7 text-slate-200">
          Кредит SmartAnalyzer — внутренняя единица оплаты AI-операций. Анализ,
          OCR, сравнение документов и AI-вопросы списывают разное количество
          кредитов в зависимости от сложности. Срок действия пакета не
          ограничен.
        </p>
        {!isLoggedIn && (
          <p className="mt-3 text-sm font-semibold text-emerald-200">
            Бесплатный старт: 100 кредитов после регистрации, без карты.
          </p>
        )}
      </div>
    </section>
  );
}
