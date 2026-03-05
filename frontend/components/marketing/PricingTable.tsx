import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";

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
};

export function PricingTable({ compact = false }: PricingTableProps) {
  return (
    <div className="grid gap-8 md:grid-cols-3">
      {plans.map((plan) => (
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
              <Button href={plan.ctaHref} variant={plan.variant}>
                {plan.cta}
              </Button>
            </div>
          )}
        </Card>
      ))}
    </div>
  );
}
