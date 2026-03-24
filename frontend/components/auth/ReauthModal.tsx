"use client";

import { useEffect, useState } from "react";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { login } from "@/lib/api/auth";
import { parseApiError } from "@/lib/api/errors";
import { clearReauthRequest, onReauthRequired } from "@/lib/auth/session";

export function ReauthModal() {
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    return onReauthRequired(() => {
      setOpen(true);
      setPassword("");
      setError(null);
    });
  }, []);

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

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[1600] flex items-center justify-center bg-[rgba(15,23,42,0.45)] px-4 backdrop-blur-sm">
      <div className="w-full max-w-md overflow-hidden rounded-[28px] border border-stone-200 bg-white shadow-[0_30px_120px_rgba(15,23,42,0.28)]">
        <div className="border-b border-stone-200 bg-[radial-gradient(circle_at_top,_rgba(110,231,183,0.22),rgba(255,255,255,0.96)_62%)] px-6 py-5">
          <p className="text-[11px] font-semibold uppercase tracking-[0.26em] text-emerald-700">Session expired</p>
          <h2 className="mt-2 text-2xl font-semibold tracking-[-0.04em] text-stone-950">Повторный вход</h2>
          <p className="mt-2 text-sm leading-6 text-stone-600">
            Сессия истекла. Войдите снова, и страница перезагрузится на том же месте.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 px-6 py-6">
          <Input
            label="Email"
            type="email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
          <Input
            label="Пароль"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
          {error ? <Alert variant="error">{error}</Alert> : null}
          <div className="flex items-center justify-end gap-3 pt-2">
            <Button type="submit" disabled={loading} className="min-w-[180px]">
              {loading ? "Восстанавливаем…" : "Войти и продолжить"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
