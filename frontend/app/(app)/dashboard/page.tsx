"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/Button";
import { getToken } from "@/lib/auth/token";
import { isUnauthorized } from "@/lib/api/errors";
import { logout as authLogout, me, type User } from "@/lib/api/auth";
import { getUsageStatus, type UsageStatus } from "@/lib/api/usage";

export default function DashboardPage() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [usage, setUsage] = useState<UsageStatus | null>(null);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    const token = getToken();
    if (!token) {
      router.replace("/login");
      return;
    }
    me()
      .then((u) => {
        setUser(u);
        return getUsageStatus().then(setUsage).catch(() => setUsage(null));
      })
      .catch((err) => {
        if (isUnauthorized(err)) {
          authLogout();
        }
        router.replace("/login");
      })
      .finally(() => setChecking(false));
  }, [router]);

  function handleLogout() {
    authLogout();
    router.push("/");
    router.refresh();
  }

  if (checking) {
    return (
      <main className="min-h-screen bg-gray-50 p-8 flex items-center justify-center">
        <p className="text-gray-500">Загрузка…</p>
      </main>
    );
  }

  if (!user) {
    return null;
  }

  return (
    <main className="min-h-screen bg-gray-50">
      <header className="border-b border-gray-200 bg-white">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4 sm:px-6 lg:px-8">
          <Link
            href="/"
            className="text-xl font-semibold text-gray-900 hover:text-gray-700"
          >
            SmartAnalyzer
          </Link>
          <Button variant="secondary" type="button" onClick={handleLogout}>
            Выйти
          </Button>
        </div>
      </header>
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <h1 className="text-2xl font-bold text-gray-900 mb-2">
          Привет, {user.email}
        </h1>
        <p className="text-gray-600 mb-8">
          Добро пожаловать в личный кабинет.
        </p>
        <section className="mb-8">
          <h2 className="text-lg font-semibold text-gray-900 mb-2">
            Недавние анализы
          </h2>
          <p className="text-gray-500 text-sm">Список появится после подключения истории.</p>
        </section>
        <section>
          <h2 className="text-lg font-semibold text-gray-900 mb-2">
            План
          </h2>
          <div className="rounded-lg border border-gray-200 bg-white p-4">
            <span className="inline-flex items-center rounded-full px-2.5 py-0.5 text-sm font-medium bg-gray-100 text-gray-800">
              {usage ? (usage.plan === "pro" ? "Pro" : "Free") : "—"}
            </span>
            <p className="mt-2 text-sm text-gray-600">
              {usage
                ? usage.limits.daily_runs_per_tool != null
                  ? `Осталось запусков сегодня (Document Analyzer): ${Math.max(0, usage.limits.daily_runs_per_tool - (usage.usage_today["document-analyzer"] ?? 0))}`
                  : "Unlimited"
                : "—"}
            </p>
          </div>
        </section>
      </div>
    </main>
  );
}
