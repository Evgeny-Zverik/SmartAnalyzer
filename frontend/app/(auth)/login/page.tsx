"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useMemo, useState } from "react";
import { Loader2, LogIn } from "lucide-react";
import { Alert } from "@/components/ui/Alert";
import { Input } from "@/components/ui/Input";
import { PasswordInput } from "@/components/ui/PasswordInput";
import { parseApiError } from "@/lib/api/errors";
import { login } from "@/lib/api/auth";
import { getSafeReturnTo } from "@/lib/auth/redirect";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function LoginPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState("");
  const [emailTouched, setEmailTouched] = useState(false);
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const emailValid = useMemo(() => EMAIL_RE.test(email.trim()), [email]);
  const showEmailError = emailTouched && email.length > 0 && !emailValid;
  const canSubmit = emailValid && password.length > 0 && !loading;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;
    setError(null);
    setLoading(true);
    try {
      await login(email.trim(), password);
      const returnTo = getSafeReturnTo(searchParams.get("returnTo"));
      router.replace(returnTo ?? "/dashboard");
      router.refresh();
    } catch (err) {
      const parsed = parseApiError(err);
      const message =
        parsed.status === 401
          ? "Неверный email или пароль"
          : parsed.message || "Ошибка входа";
      setError(message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="w-full">
      <div className="rounded-[32px] border border-zinc-200/80 bg-white p-7 shadow-[0_24px_70px_rgba(28,25,23,0.08)] sm:p-8">
        <div className="mb-6">
          <h1 className="text-2xl font-semibold tracking-[-0.02em] text-zinc-900">
            Вход в аккаунт
          </h1>
          <p className="mt-1 text-sm text-zinc-500">
            Введите email и пароль или создайте новый аккаунт.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4" noValidate>
          <Input
            label="Email"
            type="email"
            inputMode="email"
            autoComplete="email"
            autoFocus
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            onBlur={() => setEmailTouched(true)}
            error={showEmailError ? "Введите корректный email" : undefined}
            placeholder="you@example.com"
            required
          />
          <PasswordInput
            label="Пароль"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
            required
          />

          <div className="flex items-center justify-between text-sm">
            <label className="inline-flex items-center gap-2 text-zinc-600">
              <input
                type="checkbox"
                className="h-4 w-4 rounded border-zinc-300 text-amber-400 focus:ring-amber-300"
                defaultChecked
              />
              Запомнить меня
            </label>
            <Link
              href="/forgot-password"
              className="font-medium text-stone-900 hover:text-amber-600"
            >
              Забыли пароль?
            </Link>
          </div>

          {error && (
            <div className="animate-[fadeIn_120ms_ease-out]">
              <Alert variant="error">{error}</Alert>
            </div>
          )}

          <button
            type="submit"
            disabled={!canSubmit}
            className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-zinc-900 px-4 py-2.5 text-sm font-semibold text-white shadow-[0_14px_40px_rgba(24,24,27,0.25)] transition hover:bg-zinc-800 focus:outline-none focus:ring-2 focus:ring-zinc-700 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Входим…
              </>
            ) : (
              <>
                <LogIn className="h-4 w-4" />
                Войти
              </>
            )}
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-zinc-600">
          Нет аккаунта?{" "}
          <Link
            href="/register"
            className="font-semibold text-stone-900 hover:text-amber-600"
          >
            Зарегистрироваться
          </Link>
        </p>
      </div>

      <p className="mt-4 text-center text-xs text-zinc-400">
        Продолжая, вы соглашаетесь с условиями использования и политикой
        конфиденциальности.
      </p>
    </main>
  );
}
