import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import type { UsageStatus } from "@/lib/api/usage";

const plans = [
  {
    key: "15",
    badge: "Базовый",
    limit: "до 15 запросов",
    description: "Бесплатно для теста сервиса и первых точечных сценариев без регулярной нагрузки",
    price: "Бесплатно",
    cta: "Начать тест",
    ctaHref: "/register",
    variant: "secondary" as const,
    tone: "border-stone-200 bg-[linear-gradient(160deg,rgba(255,255,255,0.98),rgba(245,244,241,0.96))]",
    badgeTone: "border-stone-300 bg-stone-100 text-stone-700",
  },
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
    <div className={`grid gap-4 ${compact ? "md:grid-cols-3" : "md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5"}`}>
      {visiblePlans.map((plan) => {
        const isProPlan = plan.key === "200";
        const useUpgradeButton = isProPlan && showUpgradeButton;
        const isFreePlan = plan.key === "15";
        const accentBand = isFreePlan
          ? "from-stone-300/30 via-stone-100/18 to-transparent"
          : isProPlan
            ? "from-emerald-400/32 via-teal-200/14 to-transparent"
            : plan.key === "400"
              ? "from-sky-300/28 via-blue-100/14 to-transparent"
              : plan.key === "600"
                ? "from-violet-300/28 via-fuchsia-100/14 to-transparent"
                : "from-zinc-300/24 via-zinc-100/14 to-transparent";
        const buttonTone = isProPlan
          ? "bg-zinc-900 hover:bg-zinc-800 focus:ring-zinc-600"
          : isFreePlan
            ? "border-stone-300 bg-stone-100/90 text-stone-900 hover:bg-stone-200/80 focus:ring-stone-400"
            : "border-zinc-300 bg-white/92 hover:bg-white focus:ring-zinc-400";

        return (
          <Card
            key={plan.key}
            className={`group relative h-full overflow-hidden rounded-[28px] border p-0 shadow-[0_18px_52px_rgba(28,25,23,0.08)] transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_28px_78px_rgba(28,25,23,0.14)] ${plan.tone}`}
          >
            <div className={`pointer-events-none absolute inset-x-0 top-0 h-20 bg-gradient-to-b ${accentBand}`} />
            <div className="pointer-events-none absolute -right-8 -top-8 h-32 w-32 rounded-full bg-white/45 blur-2xl transition-opacity duration-300 group-hover:opacity-100" />
            <div className="relative flex h-full flex-col p-5 xl:p-4">
              <div className="flex items-start justify-between gap-3">
                <div className={`inline-flex w-fit items-center rounded-full border px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] ${plan.badgeTone}`}>
                  {plan.badge}
                </div>
                {isFreePlan && (
                  <span className="inline-flex items-center rounded-full border border-emerald-300/80 bg-emerald-100/80 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-emerald-800">
                    Тест
                  </span>
                )}
              </div>
              <p className="mt-5 text-[2.2rem] font-semibold leading-[0.94] tracking-[-0.06em] text-zinc-950 xl:text-[1.95rem]">
                {plan.limit}
              </p>
              <p className="mt-3 min-h-[108px] text-[15px] leading-7 text-zinc-600 xl:min-h-[96px] xl:text-[13px] xl:leading-6">
                {plan.description}
              </p>
              <div className="mt-5 border-t border-zinc-200/80 pt-4">
                <p className={`font-semibold leading-[0.88] tracking-[-0.06em] ${isFreePlan ? "text-[2.2rem] xl:text-[1.95rem]" : "text-[2.9rem] xl:text-[2.45rem]"} text-zinc-900`}>
                  {plan.price}
                </p>
                <div className="mt-3 space-y-2">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-zinc-500">Лимит в месяц</p>
                  <div className="h-px w-full bg-gradient-to-r from-transparent via-zinc-300/80 to-transparent" />
                </div>
              </div>

              {!compact && (
                <div className="mt-auto pt-6">
                  {useUpgradeButton ? (
                    <Button
                      type="button"
                      variant={plan.variant}
                      disabled={upgrading}
                      onClick={onUpgradePro}
                      className={`w-full rounded-full ${buttonTone}`}
                    >
                      {upgrading ? "Обновление…" : "Перейти на Про"}
                    </Button>
                  ) : (
                    <Button
                      href={isProPlan && isPro ? "#" : plan.ctaHref}
                      variant={plan.variant}
                      className={`w-full rounded-full ${buttonTone}`}
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
