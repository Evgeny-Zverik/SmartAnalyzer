"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useMemo, useState } from "react";
import { Loader2, UserPlus } from "lucide-react";
import { Alert } from "@/components/ui/Alert";
import { Input } from "@/components/ui/Input";
import { PasswordInput } from "@/components/ui/PasswordInput";
import { parseApiError } from "@/lib/api/errors";
import { register } from "@/lib/api/auth";
import { getSafeReturnTo } from "@/lib/auth/redirect";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

type Strength = { score: 0 | 1 | 2 | 3 | 4; label: string; color: string };

function passwordStrength(pw: string): Strength {
  if (!pw) return { score: 0, label: "", color: "bg-zinc-200" };
  let score = 0;
  if (pw.length >= 8) score++;
  if (/[A-Z]/.test(pw) && /[a-z]/.test(pw)) score++;
  if (/\d/.test(pw)) score++;
  if (/[^A-Za-z0-9]/.test(pw)) score++;
  const map: Record<number, Strength> = {
    0: { score: 0, label: "Слишком короткий", color: "bg-rose-400" },
    1: { score: 1, label: "Слабый", color: "bg-rose-400" },
    2: { score: 2, label: "Сносный", color: "bg-amber-400" },
    3: { score: 3, label: "Хороший", color: "bg-amber-300" },
    4: { score: 4, label: "Сильный", color: "bg-[#ffd43b]" },
  };
  return map[score];
}

export default function RegisterPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState("");
  const [emailTouched, setEmailTouched] = useState(false);
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [confirmTouched, setConfirmTouched] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const emailValid = EMAIL_RE.test(email.trim());
  const showEmailError = emailTouched && email.length > 0 && !emailValid;
  const strength = useMemo(() => passwordStrength(password), [password]);
  const passwordsMatch = password === confirmPassword;
  const showMismatch =
    confirmTouched && confirmPassword.length > 0 && !passwordsMatch;
  const canSubmit =
    emailValid && password.length >= 8 && passwordsMatch && !loading;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;
    setError(null);
    setLoading(true);
    try {
      await register(email.trim(), password);
      router.push(
        getSafeReturnTo(searchParams.get("returnTo")) ?? "/dashboard",
      );
      router.refresh();
    } catch (err) {
      const parsed = parseApiError(err);
      const message =
        parsed.status === 409
          ? "Этот email уже зарегистрирован"
          : parsed.message || "Ошибка регистрации";
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
            Создать аккаунт
          </h1>
          <p className="mt-1 text-sm text-zinc-500">
            Бесплатный старт, без карты. Регистрация занимает 30 секунд.
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
          <div>
            <PasswordInput
              label="Пароль"
              autoComplete="new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Минимум 8 символов"
              hint="Используйте буквы, цифры и символы"
              required
              minLength={8}
            />
            {password.length > 0 && (
              <div className="mt-2">
                <div className="flex gap-1">
                  {[0, 1, 2, 3].map((i) => (
                    <div
                      key={i}
                      className={`h-1 flex-1 rounded-full transition-colors ${
                        i < strength.score ? strength.color : "bg-zinc-200"
                      }`}
                    />
                  ))}
                </div>
                {strength.label && (
                  <p className="mt-1 text-xs text-zinc-500">{strength.label}</p>
                )}
              </div>
            )}
          </div>
          <PasswordInput
            label="Подтверждение пароля"
            autoComplete="new-password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            onBlur={() => setConfirmTouched(true)}
            error={showMismatch ? "Пароли не совпадают" : undefined}
            placeholder="Повторите пароль"
            required
          />

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
                Создаём аккаунт…
              </>
            ) : (
              <>
                <UserPlus className="h-4 w-4" />
                Зарегистрироваться
              </>
            )}
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-zinc-600">
          Уже есть аккаунт?{" "}
          <Link
            href="/login"
            className="font-semibold text-stone-900 hover:text-amber-600"
          >
            Войти
          </Link>
        </p>
      </div>

      <p className="mt-4 text-center text-xs text-zinc-400">
        Регистрируясь, вы соглашаетесь с условиями использования и политикой
        конфиденциальности.
      </p>
    </main>
  );
}
