"use client";

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

  function handleHardNavigate(href: string) {
    if (pathname === href) return;
    window.location.href = href;
  }

  return (
    <header className="sticky top-0 z-[1000] isolate pointer-events-auto border-b border-gray-200 bg-white/95 backdrop-blur">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4 sm:px-6 lg:px-8">
        <a
          href="/"
          onMouseDown={(e) => {
            if (e.button !== 0) return;
            e.preventDefault();
            handleHardNavigate("/");
          }}
          className="text-xl font-semibold text-gray-900 hover:text-gray-700"
        >
          SmartAnalyzer
        </a>
        <nav className="flex items-center gap-6">
          <a
            href="/tools"
            onMouseDown={(e) => {
              if (e.button !== 0) return;
              e.preventDefault();
              handleHardNavigate("/tools");
            }}
            className={navClass("/tools")}
          >
            Инструменты
          </a>
          <a
            href="/pricing"
            onMouseDown={(e) => {
              if (e.button !== 0) return;
              e.preventDefault();
              handleHardNavigate("/pricing");
            }}
            className={navClass("/pricing")}
          >
            Тарифы
          </a>
          {!authReady ? (
            <div
              aria-hidden="true"
              className="h-10 w-[360px] rounded-xl bg-gray-100/80"
            />
          ) : loggedIn ? (
            <>
              <a
                href="/dashboard"
                onMouseDown={(e) => {
                  if (e.button !== 0) return;
                  e.preventDefault();
                  handleHardNavigate("/dashboard");
                }}
                className={navClass("/dashboard")}
              >
                Dashboard
              </a>
              <a
                href="/settings"
                onMouseDown={(e) => {
                  if (e.button !== 0) return;
                  e.preventDefault();
                  handleHardNavigate("/settings");
                }}
                className={navClass("/settings")}
              >
                Настройки
              </a>
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
              <a
                href="/login"
                onMouseDown={(e) => {
                  if (e.button !== 0) return;
                  e.preventDefault();
                  handleHardNavigate("/login");
                }}
                className="text-sm font-medium text-gray-600 hover:text-gray-900"
              >
                Войти
              </a>
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
