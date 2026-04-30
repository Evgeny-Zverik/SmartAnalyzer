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
                ? "border-amber-300 bg-[#fff7cc]"
                : "border-zinc-200 bg-white"
            }`}
          >
            <p className="text-lg font-semibold text-zinc-950">{plan.name}</p>
            <p className="mt-2 text-sm font-semibold text-amber-700">
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
    <section className="overflow-hidden rounded-[36px] border border-stone-200 bg-white p-5 text-stone-950 shadow-[0_30px_90px_rgba(28,25,23,0.08)] sm:p-7">
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <div className="inline-flex items-center gap-2 rounded-full border border-amber-200 bg-[#fff7cc] px-3 py-1 text-[11px] font-bold uppercase tracking-[0.18em] text-stone-900">
            <Sparkles className="h-3.5 w-3.5" />
            Выбор пакета
          </div>
          <h2 className="mt-3 text-3xl font-semibold tracking-[-0.03em]">
            Цены
          </h2>
          <p className="mt-2 max-w-2xl text-base font-medium leading-7 text-stone-600">
            Выберите пакет кредитов. Кредиты не сгорают и списываются только за
            действия.
          </p>
        </div>
        <div className="rounded-[24px] border border-stone-200 bg-stone-50 px-4 py-3 text-sm text-stone-600">
          Выбрано:{" "}
          <span className="font-bold text-stone-950">{selectedPlan.name}</span>
          <span className="mx-2 text-stone-300">/</span>
          <span className="font-bold text-amber-700">
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
                  ? "border-amber-300 bg-[#fff7cc] shadow-[0_20px_70px_rgba(245,158,11,0.14)]"
                  : "border-stone-200 bg-white hover:border-amber-300 hover:bg-[#fffaf0]"
              }`}
              aria-pressed={active}
            >
              {plan.save && (
                <span className="absolute right-0 top-0 rounded-bl-[18px] bg-stone-950 px-4 py-1.5 text-xs font-bold uppercase tracking-[0.08em] text-white">
                  {plan.save}
                </span>
              )}

              <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <div className="flex min-w-0 items-start gap-4">
                  <span
                    className={`mt-1 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border ${
                      active
                        ? "border-stone-950 bg-stone-950 text-[#ffd43b]"
                        : "border-stone-300 text-transparent"
                    }`}
                  >
                    <Check className="h-3 w-3" />
                  </span>
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p
                        className={`text-2xl font-bold ${active ? "text-stone-950" : "text-stone-950"}`}
                      >
                        {plan.name}
                      </p>
                      {plan.badge && (
                        <span className="rounded-full border border-amber-200 bg-white px-2.5 py-1 text-[11px] font-bold uppercase tracking-[0.12em] text-stone-900">
                          {plan.badge}
                        </span>
                      )}
                    </div>
                    <div className="mt-2 flex flex-wrap items-center gap-2 text-sm font-semibold text-stone-600">
                      <span>Вы получаете</span>
                      <span className="rounded-full bg-white px-3 py-1 text-stone-950 ring-1 ring-stone-200">
                        {plan.credits}
                      </span>
                    </div>
                    <p className="mt-3 text-sm font-semibold text-amber-700">
                      {plan.fit}
                    </p>
                    <p className="mt-2 text-sm font-semibold text-stone-500">
                      {plan.estimate}
                    </p>
                  </div>
                </div>
                <p className="shrink-0 text-3xl font-bold tracking-[-0.04em] text-stone-950 sm:text-right">
                  {plan.price}
                </p>
              </div>

              <p className="mt-6 max-w-3xl text-base font-semibold leading-7 text-stone-700">
                {plan.description}
              </p>
            </button>
          );
        })}
      </div>

      <div className="mt-8 flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
        <a
          href="#credit-spend"
          className="inline-flex items-center gap-2 text-sm font-semibold text-stone-700 hover:text-amber-700"
        >
          <CircleHelp className="h-4 w-4" />
          Подробнее о стоимости кредитов и списаниях
        </a>

        {selected === "enterprise" ? (
          <Button
            href="mailto:sales@smartanalyzer.example"
            className="min-w-[220px] px-7 py-4 text-base font-bold"
          >
            Связаться <ArrowUpRight className="ml-2 h-5 w-5" />
          </Button>
        ) : canPurchase ? (
          <Button
            type="button"
            disabled={purchasing}
            onClick={() => onPurchaseCredits(selected)}
            className="min-w-[220px] px-7 py-4 text-base font-bold"
          >
            {purchasing ? "Пополнение..." : `Приобрести ${selectedPlan.price}`}
          </Button>
        ) : (
          <Button
            href={registerHref}
            className="min-w-[220px] px-7 py-4 text-base font-bold"
          >
            Зарегистрироваться и купить {selectedPlan.name}
          </Button>
        )}
      </div>

      <div
        id="credit-explainer"
        className="mt-8 rounded-[24px] border border-stone-200 bg-stone-50 p-5"
      >
        <h3 className="text-xl font-bold">Что такое кредит?</h3>
        <p className="mt-3 max-w-5xl text-base leading-7 text-stone-600">
          Кредит SmartAnalyzer — внутренняя единица оплаты AI-операций. Анализ,
          OCR, сравнение документов и AI-вопросы списывают разное количество
          кредитов в зависимости от сложности. Срок действия пакета не
          ограничен.
        </p>
        {!isLoggedIn && (
          <p className="mt-3 text-sm font-semibold text-amber-700">
            Бесплатный старт: 100 кредитов после регистрации, без карты.
          </p>
        )}
      </div>
    </section>
  );
}
