"use client";

import { useEffect, useState } from "react";
import { PricingTable } from "@/components/marketing/PricingTable";
import { getToken } from "@/lib/auth/token";
import { getUsageStatus, type UsageStatus } from "@/lib/api/usage";
import { upgradePlan } from "@/lib/api/billing";

export default function PricingPage() {
  const [usage, setUsage] = useState<UsageStatus | null>(null);
  const [upgrading, setUpgrading] = useState(false);
  const [upgradeDone, setUpgradeDone] = useState(false);

  useEffect(() => {
    if (getToken()) {
      getUsageStatus().then(setUsage).catch(() => setUsage(null));
    }
  }, []);

  async function handleUpgrade() {
    setUpgrading(true);
    setUpgradeDone(false);
    try {
      await upgradePlan("pro");
      const next = await getUsageStatus();
      setUsage(next);
      setUpgradeDone(true);
    } finally {
      setUpgrading(false);
    }
  }

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top,_rgba(232,249,243,0.7),rgba(252,251,247,0.96)_42%,rgba(246,244,239,0.96))]">
      <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
        <section className="relative overflow-hidden rounded-[34px] border border-stone-200/80 bg-[linear-gradient(135deg,rgba(255,255,255,0.95),rgba(248,245,237,0.94))] p-6 shadow-[0_24px_80px_rgba(28,25,23,0.08)] sm:p-8">
          <div className="pointer-events-none absolute right-0 top-0 h-36 w-36 rounded-full bg-emerald-200/30 blur-3xl" />
          <div className="pointer-events-none absolute bottom-0 left-1/3 h-px w-1/2 bg-gradient-to-r from-transparent via-stone-400/30 to-transparent" />

          <div className="relative">
            <div className="inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.24em] text-emerald-700">
              Планы и лимиты
            </div>
            <h1 className="mt-5 max-w-4xl text-4xl font-semibold leading-[0.96] tracking-[-0.05em] text-stone-900 sm:text-5xl">
              Выберите тариф под текущую нагрузку и масштаб роста команды.
            </h1>
            <p className="mt-5 max-w-3xl text-base leading-8 text-stone-600">
              Бесплатный план подойдёт для первичного старта, Про закрывает регулярную рабочую нагрузку, а Бизнес рассчитан на
              корпоративные требования и приватный контур.
            </p>

            <div className="mt-6 flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center rounded-full border border-stone-300 bg-white/80 px-3 py-1 text-xs font-medium text-stone-700">
                Текущий план: {usage?.plan === "pro" ? "Про" : "Бесплатный"}
              </span>
              <span className="inline-flex items-center rounded-full border border-stone-300 bg-white/80 px-3 py-1 text-xs font-medium text-stone-700">
                Анализов за день: {usage?.limits.daily_runs_per_tool ?? "Без лимита"}
              </span>
            </div>
          </div>
        </section>

        {upgradeDone && (
          <div
            className="mx-auto mt-5 max-w-3xl rounded-2xl border border-emerald-200 bg-emerald-50/90 px-4 py-3 text-center text-sm font-medium text-emerald-700"
            role="status"
          >
            План обновлён на Про.
          </div>
        )}

        <div className="mt-10">
          <PricingTable
            usage={usage}
            onUpgradePro={handleUpgrade}
            upgrading={upgrading}
          />
        </div>

        <section className="mt-8 grid gap-4 md:grid-cols-3">
          {[
            ["Запуск за минуты", "Подключение без сложной настройки и долгого внедрения."],
            ["Контроль лимитов", "Прозрачная модель доступа и понятный апгрейд под рост нагрузки."],
            ["Поддержка роста", "От персональной работы до командного и корпоративного контуров."],
          ].map(([title, text]) => (
            <div key={title} className="rounded-2xl border border-stone-200 bg-white/80 p-4">
              <h2 className="text-sm font-semibold uppercase tracking-[0.16em] text-stone-700">{title}</h2>
              <p className="mt-2 text-sm leading-6 text-stone-600">{text}</p>
            </div>
          ))}
        </section>
      </div>
    </main>
  );
}
