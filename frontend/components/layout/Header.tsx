"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/Button";
import { getToken, clearToken, onAuthChange } from "@/lib/auth/token";

export function Header() {
  const router = useRouter();
  const [loggedIn, setLoggedIn] = useState(false);

  useEffect(() => {
    setLoggedIn(!!getToken());
    return onAuthChange(() => setLoggedIn(!!getToken()));
  }, []);

  function handleLogout() {
    clearToken();
    setLoggedIn(false);
    router.push("/");
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
            className="text-sm font-medium text-gray-600 hover:text-gray-900"
          >
            Инструменты
          </Link>
          <Link
            href="/pricing"
            className="text-sm font-medium text-gray-600 hover:text-gray-900"
          >
            Тарифы
          </Link>
          {loggedIn ? (
            <>
              <Link
                href="/dashboard"
                className="text-sm font-medium text-gray-600 hover:text-gray-900"
              >
                Dashboard
              </Link>
              <Link
                href="/settings"
                className="text-sm font-medium text-gray-600 hover:text-gray-900"
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
