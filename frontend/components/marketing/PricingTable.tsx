import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import type { UsageStatus } from "@/lib/api/usage";

const plans = [
  {
    name: "Бесплатный",
    features: ["3 анализа в день", "Базовый доступ к инструментам", "Поддержка сообщества"],
    cta: "Начать бесплатно",
    ctaHref: "/register",
    variant: "secondary" as const,
  },
  {
    name: "Про",
    features: [
      "Безлимитные анализы (MVP)",
      "Приоритетная очередь",
      "Форматы экспорта",
    ],
    cta: "Перейти на Про",
    ctaHref: "/register",
    variant: "primary" as const,
  },
  {
    name: "Бизнес",
    features: ["SSO", "On-prem / приватный деплой", "Индивидуальные лимиты"],
    cta: "Связаться с отделом продаж",
    ctaHref: "mailto:sales@smartanalyzer.example",
    variant: "secondary" as const,
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
    <div className="grid gap-8 md:grid-cols-3">
      {plans.map((plan) => {
        const isProPlan = plan.name === "Про";
        const useUpgradeButton = isProPlan && showUpgradeButton;

        return (
          <Card
            key={plan.name}
            className={plan.name === "Про" ? "ring-2 ring-emerald-600" : ""}
          >
            <h3 className="text-xl font-semibold text-gray-900">{plan.name}</h3>
            <ul className="mt-4 space-y-2">
              {plan.features.map((f) => (
                <li key={f} className="text-sm text-gray-600">
                  {f}
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
                  >
                    {upgrading ? "Обновление…" : "Upgrade to Pro"}
                  </Button>
                ) : (
                  <Button
                    href={isProPlan && isPro ? "#" : plan.ctaHref}
                    variant={plan.variant}
                  >
                    {isProPlan && isPro ? "Текущий план" : plan.cta}
                  </Button>
                )}
              </div>
            )}
          </Card>
        );
      })}
    </div>
  );
}
