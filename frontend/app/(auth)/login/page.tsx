"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { parseApiError } from "@/lib/api/errors";
import { login } from "@/lib/api/auth";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await login(email, password);
      router.push("/dashboard");
      router.refresh();
    } catch (err) {
      const parsed = parseApiError(err);
      setError(parsed.message || "Ошибка входа");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="w-full max-w-md">
      <Card className="p-8">
        <h1 className="text-2xl font-bold text-gray-900 mb-6">Вход</h1>
        <form onSubmit={handleSubmit} className="space-y-4">
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
          {error && <Alert variant="error">{error}</Alert>}
          <Button type="submit" disabled={loading} className="w-full">
            {loading ? "Вход…" : "Войти"}
          </Button>
        </form>
        <p className="mt-6 text-center text-sm text-gray-600">
          Нет аккаунта?{" "}
          <Link href="/register" className="font-medium text-emerald-600 hover:text-emerald-700">
            Зарегистрироваться
          </Link>
        </p>
      </Card>
    </main>
  );
}
