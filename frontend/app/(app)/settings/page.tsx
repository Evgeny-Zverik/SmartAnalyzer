"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { logout as authLogout } from "@/lib/api/auth";
import { getSettings, updateSettings } from "@/lib/api/settings";
import { buildLoginRedirectHref } from "@/lib/auth/redirect";
import { requestReauth } from "@/lib/auth/session";
import { getToken } from "@/lib/auth/token";
import { isUnauthorized } from "@/lib/api/errors";

const COMPRESSION_OPTIONS = [
  { value: "", label: "По умолчанию (сервер)" },
  { value: "off", label: "Выключена" },
  { value: "safe", label: "Безопасная" },
  { value: "aggressive", label: "Агрессивная" },
];

export default function SettingsPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [baseUrl, setBaseUrl] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [apiKeySet, setApiKeySet] = useState(false);
  const [model, setModel] = useState("");
  const [compression, setCompression] = useState("");
  const [analysisMode, setAnalysisMode] = useState<"fast" | "deep">("fast");

  useEffect(() => {
    if (!getToken()) {
      router.replace(buildLoginRedirectHref());
      return;
    }

    getSettings()
      .then((settings) => {
        setBaseUrl(settings.llm_base_url ?? "");
        setApiKeySet(settings.llm_api_key_set);
        setModel(settings.llm_model ?? "");
        setCompression(settings.compression_level ?? "");
        setAnalysisMode(settings.analysis_mode === "deep" ? "deep" : "fast");
      })
      .catch((err) => {
        if (isUnauthorized(err)) {
          authLogout();
          requestReauth({ reason: "settings_load" });
          return;
        }
        toast.error("Не удалось загрузить настройки");
      })
      .finally(() => setLoading(false));
  }, [router]);

  async function handleSave() {
    setSaving(true);
    try {
      const data: Record<string, string | null> = {
        llm_base_url: baseUrl || null,
        llm_model: model || null,
        compression_level: compression || null,
        analysis_mode: analysisMode,
      };
      if (apiKey) {
        data.llm_api_key = apiKey;
      }
      const updated = await updateSettings(data);
      setApiKeySet(updated.llm_api_key_set);
      setApiKey("");
      toast.success("Настройки сохранены");
    } catch {
      toast.error("Ошибка сохранения настроек");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center bg-[linear-gradient(180deg,#f8fafc,#f5f5f4)]">
        <p className="rounded-full border border-zinc-200 bg-white px-4 py-2 text-sm text-zinc-500 shadow-sm">Загрузка...</p>
      </div>
    );
  }

  return (
    <div className="min-h-[calc(100vh-104px)] bg-[radial-gradient(circle_at_top_right,rgba(16,185,129,0.12),transparent_34%),linear-gradient(180deg,#f8fafc,#f5f5f4)]">
      <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6 lg:px-8">
        <section className="mb-6 rounded-[30px] border border-zinc-200/90 bg-white/85 px-5 py-5 shadow-[0_18px_60px_rgba(15,23,42,0.08)] backdrop-blur sm:px-6">
          <p className="inline-flex items-center rounded-full border border-emerald-300 bg-emerald-50 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.22em] text-emerald-700">
            Settings
          </p>
          <h1 className="mt-3 text-3xl font-semibold tracking-[-0.03em] text-zinc-900 sm:text-4xl">
            Настройки анализа
          </h1>
          <p className="mt-2 max-w-3xl text-sm leading-7 text-zinc-600 sm:text-base">
            Параметры подключения к LLM и поведение анализа. Управление фича-модулями перенесено в админ-панель.
          </p>
        </section>

        <div className="space-y-6">
          <section className="rounded-3xl border border-zinc-200 bg-white shadow-[0_14px_50px_rgba(15,23,42,0.07)]">
            <div className="border-b border-zinc-100 px-6 py-4">
              <h2 className="text-lg font-semibold text-zinc-900">Подключение к LLM</h2>
              <p className="mt-0.5 text-sm text-zinc-500">Укажите сервер и ключ для анализа документов</p>
            </div>
            <div className="space-y-5 px-6 py-5">
              <Input
                label="Base URL"
                placeholder="https://api.openai.com/v1"
                value={baseUrl}
                onChange={(e) => setBaseUrl(e.target.value)}
              />
              <Input
                label="API Key"
                type="password"
                placeholder={apiKeySet ? "••••••••  (установлен, оставьте пустым чтобы не менять)" : "sk-..."}
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
              />
              <Input
                label="Модель"
                placeholder="gpt-4o-mini"
                value={model}
                onChange={(e) => setModel(e.target.value)}
              />
            </div>
          </section>

          <section className="rounded-3xl border border-zinc-200 bg-white shadow-[0_14px_50px_rgba(15,23,42,0.07)]">
            <div className="border-b border-zinc-100 px-6 py-4">
              <h2 className="text-lg font-semibold text-zinc-900">Параметры анализа</h2>
              <p className="mt-0.5 text-sm text-zinc-500">Настройте поведение анализатора</p>
            </div>
            <div className="space-y-5 px-6 py-5">
              <div className="w-full">
                <label className="mb-1.5 block text-sm font-medium text-zinc-700">
                  Режим анализа
                </label>
                <div className="flex rounded-xl border border-zinc-300 bg-zinc-100 p-1">
                  <button
                    type="button"
                    onClick={() => setAnalysisMode("fast")}
                    className={`flex-1 rounded-lg px-4 py-2.5 text-sm font-medium transition ${
                      analysisMode === "fast"
                        ? "bg-white text-zinc-900 shadow-sm"
                        : "text-zinc-600 hover:text-zinc-900"
                    }`}
                  >
                    Быстрый
                  </button>
                  <button
                    type="button"
                    onClick={() => setAnalysisMode("deep")}
                    className={`flex-1 rounded-lg px-4 py-2.5 text-sm font-medium transition ${
                      analysisMode === "deep"
                        ? "bg-white text-zinc-900 shadow-sm"
                        : "text-zinc-600 hover:text-zinc-900"
                    }`}
                  >
                    Глубокий
                  </button>
                </div>
                <p className="mt-1.5 text-xs text-zinc-500">
                  Быстрый — один проход, подходит для локальных моделей. Глубокий — детальный структурный анализ.
                </p>
              </div>

              <div className="w-full">
                <label className="mb-1.5 block text-sm font-medium text-zinc-700">
                  Сжатие контекста
                </label>
                <select
                  value={compression}
                  onChange={(e) => setCompression(e.target.value)}
                  className="w-full rounded-lg border border-zinc-300 px-3 py-2.5 text-zinc-900 shadow-sm transition focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                >
                  {COMPRESSION_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </section>

          <div className="flex justify-end">
            <Button onClick={handleSave} disabled={saving} className="min-w-[160px] rounded-xl bg-zinc-900 hover:bg-zinc-800 focus:ring-zinc-700">
              {saving ? "Сохраняем..." : "Сохранить"}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
