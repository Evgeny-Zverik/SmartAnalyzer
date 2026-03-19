import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import type { UsageStatus } from "@/lib/api/usage";

const plans = [
  {
    name: "Бесплатный",
    subtitle: "Для старта",
    features: ["3 анализа в день", "Базовый доступ к инструментам", "Поддержка сообщества"],
    cta: "Начать бесплатно",
    ctaHref: "/register",
    variant: "secondary" as const,
    tone: "border-stone-200 bg-[linear-gradient(155deg,rgba(255,255,255,0.95),rgba(247,245,240,0.95))]",
    iconTone: "text-stone-700 bg-white/80 border-stone-200",
  },
  {
    name: "Про",
    subtitle: "Для регулярной работы",
    features: [
      "Безлимитные анализы (MVP)",
      "Приоритетная очередь",
      "Форматы экспорта",
    ],
    cta: "Перейти на Про",
    ctaHref: "/register",
    variant: "primary" as const,
    tone: "border-emerald-300 bg-[linear-gradient(155deg,rgba(236,253,245,0.95),rgba(219,249,237,0.92))]",
    iconTone: "text-emerald-700 bg-emerald-50 border-emerald-200",
    featured: true,
  },
  {
    name: "Бизнес",
    subtitle: "Для компании",
    features: ["SSO", "On-prem / приватный деплой", "Индивидуальные лимиты"],
    cta: "Связаться с отделом продаж",
    ctaHref: "mailto:sales@smartanalyzer.example",
    variant: "secondary" as const,
    tone: "border-sky-200 bg-[linear-gradient(155deg,rgba(248,250,252,0.95),rgba(238,246,255,0.95))]",
    iconTone: "text-sky-700 bg-sky-50 border-sky-200",
  },
];

type PricingTableProps = {
  compact?: boolean;
  usage?: UsageStatus | null;
  onUpgradePro?: () => void | Promise<void>;
  upgrading?: boolean;
};

export function PricingTable({
  compact = false,
  usage = null,
  onUpgradePro,
  upgrading = false,
}: PricingTableProps) {
  const isPro = usage?.plan === "pro";
  const showUpgradeButton = usage != null && !isPro && onUpgradePro;

  return (
    <div className="grid gap-6 md:grid-cols-3">
      {plans.map((plan) => {
        const isProPlan = plan.name === "Про";
        const useUpgradeButton = isProPlan && showUpgradeButton;

        return (
          <Card
            key={plan.name}
            className={`relative h-full overflow-hidden rounded-[28px] border p-0 shadow-[0_16px_48px_rgba(28,25,23,0.08)] transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_24px_70px_rgba(28,25,23,0.12)] ${plan.tone}`}
          >
            <div className="pointer-events-none absolute right-0 top-0 h-24 w-24 rounded-full bg-white/30 blur-2xl" />
            {plan.featured ? (
              <div className="absolute right-4 top-4 rounded-full border border-emerald-300 bg-emerald-100 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-emerald-800">
                Рекомендуем
              </div>
            ) : null}

            <div className="relative flex h-full flex-col p-6">
              <div className={`mb-4 inline-flex w-fit rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] ${plan.iconTone}`}>
                {plan.subtitle}
              </div>
              <h3 className="text-2xl font-semibold tracking-[-0.03em] text-stone-900">{plan.name}</h3>

              <ul className="mt-5 flex-1 space-y-3">
                {plan.features.map((f) => (
                  <li key={f} className="flex items-start gap-2 text-sm leading-6 text-stone-700">
                    <span className="mt-2 h-1.5 w-1.5 rounded-full bg-stone-500/70" />
                    <span>{f}</span>
                  </li>
                ))}
              </ul>

              {!compact && (
                <div className="mt-6">
                  {useUpgradeButton ? (
                    <Button
                      type="button"
                      variant={plan.variant}
                      disabled={upgrading}
                      onClick={onUpgradePro}
                      className={`w-full rounded-full ${isProPlan ? "bg-stone-900 hover:bg-stone-800 focus:ring-stone-600" : ""}`}
                    >
                      {upgrading ? "Обновление…" : "Перейти на Про"}
                    </Button>
                  ) : (
                    <Button
                      href={isProPlan && isPro ? "#" : plan.ctaHref}
                      variant={plan.variant}
                      className={`w-full rounded-full ${isProPlan ? "bg-stone-900 hover:bg-stone-800 focus:ring-stone-600" : ""}`}
                    >
                      {isProPlan && isPro ? "Текущий план" : plan.cta}
                    </Button>
                  )}
                </div>
              )}
            </div>
          </Card>
        );
      })}
    </div>
  );
}
