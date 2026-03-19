"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/Button";
import { logout as authLogout } from "@/lib/api/auth";
import { getToken, onAuthChange } from "@/lib/auth/token";

export function Header() {
  const router = useRouter();
  const pathname = usePathname();
  const [loggedIn, setLoggedIn] = useState(false);
  const [authReady, setAuthReady] = useState(false);

  useEffect(() => {
    setLoggedIn(!!getToken());
    setAuthReady(true);
    return onAuthChange(() => setLoggedIn(!!getToken()));
  }, []);

  function handleLogout() {
    authLogout();
    setLoggedIn(false);
    router.push("/");
  }

  function navClass(href: string): string {
    const isActive = href === "/"
      ? pathname === "/"
      : pathname === href || pathname.startsWith(`${href}/`);
    return `inline-flex items-center rounded-full px-3 py-2 text-sm font-medium transition ${
      isActive
        ? "bg-stone-900 text-stone-50 shadow-[0_10px_30px_rgba(28,25,23,0.16)]"
        : "text-stone-600 hover:bg-white/70 hover:text-stone-900"
    }`;
  }

  return (
    <header className="sticky top-0 z-[1000] isolate pointer-events-auto border-b border-stone-200/80 bg-[linear-gradient(180deg,rgba(255,255,255,0.94),rgba(250,248,243,0.9))] backdrop-blur-xl">
      <div className="mx-auto max-w-7xl px-4 py-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between gap-4 rounded-[28px] border border-stone-200/80 bg-white/80 px-4 py-3 shadow-[0_12px_40px_rgba(28,25,23,0.08)] backdrop-blur sm:px-5">
        <Link href="/" className="group flex items-center gap-3">
          <span className="flex h-11 w-11 items-center justify-center rounded-2xl border border-emerald-200 bg-[radial-gradient(circle_at_top,_rgba(110,231,183,0.32),rgba(255,255,255,0.96)_62%)] text-sm font-semibold text-emerald-700 shadow-[0_10px_30px_rgba(16,185,129,0.12)]">
            SA
          </span>
          <span className="flex flex-col">
            <span className="text-xl font-semibold tracking-[-0.04em] text-stone-900 transition group-hover:text-stone-700">
              SmartAnalyzer
            </span>
            <span className="text-[11px] uppercase tracking-[0.24em] text-stone-400">
              Document intelligence
            </span>
          </span>
        </Link>
        <nav className="flex items-center gap-2 rounded-full border border-stone-200/80 bg-stone-100/80 px-2 py-2">
          <Link href="/tools" className={navClass("/tools")}>
            Инструменты
          </Link>
          <Link href="/pricing" className={navClass("/pricing")}>
            Тарифы
          </Link>
          {!authReady ? (
            <div
              aria-hidden="true"
              className="h-12 w-[360px] rounded-2xl opacity-0 pointer-events-none"
            />
          ) : loggedIn ? (
            <>
              <Link href="/dashboard" className={navClass("/dashboard")}>
                Кабинет
              </Link>
              <Link href="/settings" className={navClass("/settings")}>
                Настройки
              </Link>
              <button
                onClick={handleLogout}
                type="button"
                className="inline-flex items-center rounded-full px-3 py-2 text-sm font-medium text-stone-600 transition hover:bg-white/70 hover:text-stone-900"
              >
                Выйти
              </button>
            </>
          ) : (
            <>
              <Link
                href="/login"
                className="inline-flex items-center rounded-full px-3 py-2 text-sm font-medium text-stone-600 transition hover:bg-white/70 hover:text-stone-900"
              >
                Войти
              </Link>
              <Button href="/register" variant="primary" className="rounded-full bg-stone-900 px-5 hover:bg-stone-800 focus:ring-stone-500">
                Попробовать бесплатно
              </Button>
            </>
          )}
        </nav>
        </div>
      </div>
    </header>
  );
}
