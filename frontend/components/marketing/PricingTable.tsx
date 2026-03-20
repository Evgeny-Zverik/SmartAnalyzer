import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import type { UsageStatus } from "@/lib/api/usage";

const plans = [
  {
    key: "50",
    badge: "Старт",
    limit: "до 50 запросов",
    description: "Для редкого использования и аккуратного старта",
    price: "2 000 ₽/мес",
    cta: "Выбрать 50",
    ctaHref: "/register",
    variant: "secondary" as const,
    tone: "border-zinc-200 bg-[linear-gradient(160deg,rgba(255,255,255,0.98),rgba(247,247,247,0.96))]",
    badgeTone: "border-zinc-300 bg-zinc-100 text-zinc-700",
  },
  {
    key: "200",
    badge: "Оптимальный",
    limit: "до 200 запросов",
    description: "Для периодической рабочей нагрузки",
    price: "6 000 ₽/мес",
    cta: "Перейти на Про",
    ctaHref: "/register",
    variant: "primary" as const,
    tone: "border-emerald-300 bg-[linear-gradient(160deg,rgba(239,253,246,0.98),rgba(220,252,238,0.95))]",
    badgeTone: "border-emerald-300 bg-emerald-100 text-emerald-800",
    featured: true,
  },
  {
    key: "400",
    badge: "Рост",
    limit: "до 400 запросов",
    description: "Для частого использования в течение месяца",
    price: "8 500 ₽/мес",
    cta: "Выбрать 400",
    ctaHref: "mailto:sales@smartanalyzer.example",
    variant: "secondary" as const,
    tone: "border-sky-200 bg-[linear-gradient(160deg,rgba(250,252,255,0.98),rgba(236,244,255,0.95))]",
    badgeTone: "border-sky-300 bg-sky-100 text-sky-800",
  },
  {
    key: "600",
    badge: "Максимум",
    limit: "до 600 запросов",
    description: "Для интенсивной ежедневной работы",
    price: "10 000 ₽/мес",
    cta: "Выбрать 600",
    ctaHref: "mailto:sales@smartanalyzer.example",
    variant: "secondary" as const,
    tone: "border-violet-200 bg-[linear-gradient(160deg,rgba(252,251,255,0.98),rgba(243,239,255,0.95))]",
    badgeTone: "border-violet-300 bg-violet-100 text-violet-800",
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
  const visiblePlans = compact ? plans.slice(0, 3) : plans;

  return (
    <div className={`grid gap-6 ${compact ? "md:grid-cols-3" : "md:grid-cols-2 xl:grid-cols-4"}`}>
      {visiblePlans.map((plan) => {
        const isProPlan = plan.key === "200";
        const useUpgradeButton = isProPlan && showUpgradeButton;

        return (
          <Card
            key={plan.key}
            className={`group relative h-full overflow-hidden rounded-[30px] border p-0 shadow-[0_16px_48px_rgba(28,25,23,0.08)] transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_26px_72px_rgba(28,25,23,0.14)] ${plan.tone}`}
          >
            <div className="pointer-events-none absolute -right-8 -top-8 h-32 w-32 rounded-full bg-white/40 blur-2xl transition-opacity duration-300 group-hover:opacity-100" />
            {plan.featured ? (
              <div className="absolute right-4 top-4 rounded-full border border-emerald-300 bg-emerald-100 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-emerald-800">
                Рекомендуем
              </div>
            ) : null}

            <div className="relative flex h-full flex-col p-6">
              <div className={`inline-flex w-fit items-center rounded-full border px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] ${plan.badgeTone}`}>
                {plan.badge}
              </div>
              <p className="mt-4 text-3xl font-semibold leading-tight tracking-[-0.03em] text-zinc-900">{plan.limit}</p>
              <p className="mt-3 min-h-[78px] text-[17px] leading-7 text-zinc-600">{plan.description}</p>
              <div className="mt-5 rounded-2xl border border-white/70 bg-white/65 px-4 py-4">
                <p className="text-5xl font-semibold leading-none tracking-[-0.03em] text-zinc-800">{plan.price}</p>
                <p className="mt-2 text-xs font-medium uppercase tracking-[0.14em] text-zinc-500">Лимит в месяц</p>
              </div>

              {!compact && (
                <div className="mt-6">
                  {useUpgradeButton ? (
                    <Button
                      type="button"
                      variant={plan.variant}
                      disabled={upgrading}
                      onClick={onUpgradePro}
                      className={`w-full rounded-full ${isProPlan ? "bg-zinc-900 hover:bg-zinc-800 focus:ring-zinc-600" : "border-zinc-300 bg-white/90 hover:bg-white"}`}
                    >
                      {upgrading ? "Обновление…" : "Перейти на Про"}
                    </Button>
                  ) : (
                    <Button
                      href={isProPlan && isPro ? "#" : plan.ctaHref}
                      variant={plan.variant}
                      className={`w-full rounded-full ${isProPlan ? "bg-zinc-900 hover:bg-zinc-800 focus:ring-zinc-600" : "border-zinc-300 bg-white/90 hover:bg-white"}`}
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
