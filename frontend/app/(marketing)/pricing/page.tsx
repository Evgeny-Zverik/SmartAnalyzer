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
    <main className="min-h-screen">
      <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
        <h1 className="text-center text-3xl font-bold text-gray-900">Тарифы</h1>
        <p className="mx-auto mt-4 max-w-2xl text-center text-gray-600">
          Выберите план под ваши задачи
        </p>
        {upgradeDone && (
          <p className="mx-auto mt-4 max-w-2xl text-center text-emerald-600 font-medium" role="status">
            План обновлён на Pro.
          </p>
        )}
        <div className="mt-12">
          <PricingTable
            usage={usage}
            onUpgradePro={handleUpgrade}
            upgrading={upgrading}
          />
        </div>
      </div>
    </main>
  );
}
