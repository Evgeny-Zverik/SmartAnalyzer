"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { ArrowLeft, Loader2, Mail, MailCheck } from "lucide-react";
import { Alert } from "@/components/ui/Alert";
import { Input } from "@/components/ui/Input";
import { parseApiError } from "@/lib/api/errors";
import { requestPasswordReset } from "@/lib/api/auth";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [emailTouched, setEmailTouched] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  const emailValid = useMemo(() => EMAIL_RE.test(email.trim()), [email]);
  const showEmailError = emailTouched && email.length > 0 && !emailValid;
  const canSubmit = emailValid && !loading;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;
    setError(null);
    setLoading(true);
    try {
      await requestPasswordReset(email.trim());
      setSent(true);
    } catch (err) {
      setError(parseApiError(err).message || "Не удалось отправить письмо");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="w-full">
      <div className="rounded-[32px] border border-zinc-200/80 bg-white p-7 shadow-[0_24px_70px_rgba(28,25,23,0.08)] sm:p-8">
        {sent ? (
          <div className="text-center">
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-[20px] border border-amber-200 bg-[#fff7cc] text-stone-950">
              <MailCheck className="h-6 w-6" />
            </div>
            <h1 className="text-2xl font-semibold tracking-[-0.02em] text-zinc-900">
              Проверьте почту
            </h1>
            <p className="mt-2 text-sm text-zinc-600">
              Если адрес <span className="font-semibold text-zinc-900">{email}</span> зарегистрирован,
              мы отправили на него письмо со ссылкой для восстановления пароля.
              Ссылка действует 1 час.
            </p>
            <p className="mt-4 text-xs text-zinc-500">
              Не пришло письмо? Проверьте папку «Спам» или попробуйте снова через минуту.
            </p>
            <Link
              href="/login"
              className="mt-6 inline-flex items-center gap-1 text-sm font-semibold text-stone-900 hover:text-amber-600"
            >
              <ArrowLeft className="h-4 w-4" />
              Вернуться ко входу
            </Link>
          </div>
        ) : (
          <>
            <div className="mb-6">
              <h1 className="text-2xl font-semibold tracking-[-0.02em] text-zinc-900">
                Восстановление пароля
              </h1>
              <p className="mt-1 text-sm text-zinc-500">
                Укажите email — отправим ссылку для смены пароля.
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
                    Отправляем…
                  </>
                ) : (
                  <>
                    <Mail className="h-4 w-4" />
                    Отправить ссылку
                  </>
                )}
              </button>
            </form>
            <p className="mt-6 text-center text-sm text-zinc-600">
              Вспомнили пароль?{" "}
              <Link
                href="/login"
                className="font-semibold text-stone-900 hover:text-amber-600"
              >
                Войти
              </Link>
            </p>
          </>
        )}
      </div>
    </main>
  );
}
