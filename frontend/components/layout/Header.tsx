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
    return `text-sm font-medium transition ${
      isActive ? "text-gray-900" : "text-gray-600 hover:text-gray-900"
    }`;
  }

  return (
    <header className="sticky top-0 z-50 border-b border-gray-200 bg-white/95 backdrop-blur">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4 sm:px-6 lg:px-8">
        <Link
          href="/"
          className="text-xl font-semibold text-gray-900 hover:text-gray-700"
        >
          SmartAnalyzer
        </Link>
        <nav className="flex items-center gap-6">
          <Link
            href="/tools"
            className={navClass("/tools")}
          >
            Инструменты
          </Link>
          <Link
            href="/pricing"
            className={navClass("/pricing")}
          >
            Тарифы
          </Link>
          {!authReady ? (
            <div
              aria-hidden="true"
              className="h-10 w-[360px] rounded-xl bg-gray-100/80"
            />
          ) : loggedIn ? (
            <>
              <Link
                href="/dashboard"
                className={navClass("/dashboard")}
              >
                Dashboard
              </Link>
              <Link
                href="/settings"
                className={navClass("/settings")}
              >
                Настройки
              </Link>
              <button
                onClick={handleLogout}
                type="button"
                className="text-sm font-medium text-gray-600 hover:text-gray-900"
              >
                Выйти
              </button>
            </>
          ) : (
            <>
              <Link
                href="/login"
                className="text-sm font-medium text-gray-600 hover:text-gray-900"
              >
                Войти
              </Link>
              <Button href="/register" variant="primary">
                Попробовать бесплатно
              </Button>
            </>
          )}
        </nav>
      </div>
    </header>
  );
}
