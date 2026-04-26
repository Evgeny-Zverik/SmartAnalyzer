"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { Eye, EyeOff, Lock, LogOut } from "lucide-react";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { login, logout as authLogout } from "@/lib/api/auth";
import { parseApiError } from "@/lib/api/errors";
import { clearReauthRequest, onReauthRequired } from "@/lib/auth/session";
import { getLastEmail } from "@/lib/auth/token";

export function ReauthModal() {
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const passwordRef = useRef<HTMLInputElement | null>(null);
  const emailRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    return onReauthRequired(() => {
      setOpen(true);
      setPassword("");
      setError(null);
      setShowPassword(false);
      const last = getLastEmail();
      if (last) setEmail(last);
    });
  }, []);

  useEffect(() => {
    if (!open) return;
    const t = setTimeout(() => {
      if (email && passwordRef.current) passwordRef.current.focus();
      else if (emailRef.current) emailRef.current.focus();
    }, 60);

    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") handleSwitchAccount();
    }
    document.addEventListener("keydown", handleKey);
    return () => {
      clearTimeout(t);
      document.removeEventListener("keydown", handleKey);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError(null);
    try {
      await login(email, password);
      clearReauthRequest();
      setOpen(false);
      window.location.reload();
    } catch (err) {
      const parsed = parseApiError(err);
      setError(parsed.message || "Не удалось восстановить сессию");
    } finally {
      setLoading(false);
    }
  }

  function handleSwitchAccount() {
    authLogout();
    clearReauthRequest();
    setOpen(false);
    const here = typeof window !== "undefined" ? window.location.pathname + window.location.search : "/";
    window.location.href = `/login?redirect=${encodeURIComponent(here)}`;
  }

  if (!open) return null;

  const accountHint = email ? email : null;

  return (
    <div
      className="fixed inset-0 z-[1600] flex items-center justify-center bg-[rgba(15,23,42,0.55)] px-4 backdrop-blur-md"
      role="dialog"
      aria-modal="true"
      aria-labelledby="reauth-title"
    >
      <div className="w-full max-w-md origin-center animate-[avatar-menu-in_220ms_cubic-bezier(0.16,1,0.3,1)] overflow-hidden rounded-[28px] border border-stone-200 bg-white shadow-[0_30px_120px_rgba(15,23,42,0.32)]">
        <div className="relative overflow-hidden border-b border-stone-200 bg-[radial-gradient(circle_at_top,_rgba(110,231,183,0.28),rgba(255,255,255,0.96)_62%)] px-6 pb-5 pt-6">
          <span className="pointer-events-none absolute -right-12 -top-12 h-32 w-32 rounded-full bg-emerald-200/40 blur-3xl" />
          <div className="relative flex items-start gap-3">
            <span className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-2xl border border-emerald-200 bg-white text-emerald-700 shadow-sm">
              <Lock className="h-5 w-5" />
            </span>
            <div className="min-w-0">
              <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-emerald-700">
                Сессия истекла
              </p>
              <h2
                id="reauth-title"
                className="mt-1 text-2xl font-semibold tracking-[-0.03em] text-stone-950"
              >
                Повторный вход
              </h2>
              <p className="mt-1.5 text-[13.5px] leading-relaxed text-stone-600">
                Войдите ещё раз — страница перезагрузится на том же месте, ничего не пропадёт.
              </p>
            </div>
          </div>
        </div>

        <form
          onSubmit={handleSubmit}
          method="POST"
          action="/api/v1/auth/login"
          className="space-y-4 px-6 py-5"
          autoComplete="on"
        >
          {accountHint && (
            <p className="flex items-center gap-1.5 rounded-xl border border-stone-200 bg-stone-50 px-3 py-2 text-[12.5px] text-stone-600">
              <span className="text-stone-400">Аккаунт:</span>
              <span className="truncate font-semibold text-stone-900">{accountHint}</span>
            </p>
          )}
          <Input
            ref={emailRef}
            label="Email"
            name="email"
            type="email"
            autoComplete="username"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
          <div className="relative">
            <Input
              ref={passwordRef}
              label="Пароль"
              name="password"
              type={showPassword ? "text" : "password"}
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="pr-11"
            />
            <button
              type="button"
              onClick={() => setShowPassword((v) => !v)}
              tabIndex={-1}
              aria-label={showPassword ? "Скрыть пароль" : "Показать пароль"}
              className="absolute right-2 top-[34px] flex h-9 w-9 items-center justify-center rounded-lg text-stone-500 transition hover:bg-stone-100 hover:text-stone-800"
            >
              {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>

          {error ? <Alert variant="error">{error}</Alert> : null}

          <div className="flex items-center justify-between pt-1 text-[12.5px]">
            <Link
              href="/forgot-password"
              className="font-medium text-stone-500 transition hover:text-stone-900"
            >
              Забыли пароль?
            </Link>
            <button
              type="button"
              onClick={handleSwitchAccount}
              className="inline-flex items-center gap-1 font-medium text-stone-500 transition hover:text-stone-900"
            >
              <LogOut className="h-3.5 w-3.5" />
              Войти как другой
            </button>
          </div>

          <Button type="submit" disabled={loading} className="w-full">
            {loading ? "Восстанавливаем…" : "Войти и продолжить"}
          </Button>
        </form>
      </div>
    </div>
  );
}
