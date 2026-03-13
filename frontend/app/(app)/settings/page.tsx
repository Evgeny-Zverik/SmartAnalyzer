"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Header } from "@/components/layout/Header";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { getToken } from "@/lib/auth/token";
import { getSettings, updateSettings } from "@/lib/api/settings";
import { isUnauthorized } from "@/lib/api/errors";
import { listPlugins, type PluginAvailabilityItem } from "@/lib/plugins/api";

const COMPRESSION_OPTIONS = [
  { value: "", label: "По умолчанию (сервер)" },
  { value: "off", label: "Выключена" },
  { value: "safe", label: "Безопасная" },
  { value: "aggressive", label: "Агрессивная" },
];

type Tab = "plugins" | "settings";

export default function SettingsPage() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<Tab>("plugins");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Settings state
  const [baseUrl, setBaseUrl] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [apiKeySet, setApiKeySet] = useState(false);
  const [model, setModel] = useState("");
  const [compression, setCompression] = useState("");
  const [analysisMode, setAnalysisMode] = useState<"fast" | "deep">("fast");

  // Plugins state
  const [plugins, setPlugins] = useState<PluginAvailabilityItem[]>([]);
  const [expandedPlugins, setExpandedPlugins] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!getToken()) {
      router.replace("/login");
      return;
    }
    Promise.all([
      getSettings().then((s) => {
        setBaseUrl(s.llm_base_url ?? "");
        setApiKeySet(s.llm_api_key_set);
        setModel(s.llm_model ?? "");
        setCompression(s.compression_level ?? "");
        setAnalysisMode(s.analysis_mode === "deep" ? "deep" : "fast");
      }),
      listPlugins().then(setPlugins).catch(() => {}),
    ])
      .catch((err) => {
        if (isUnauthorized(err)) {
          router.replace("/login");
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
      <>
        <Header />
        <div className="flex min-h-[60vh] items-center justify-center">
          <p className="text-gray-500">Загрузка...</p>
        </div>
      </>
    );
  }

  const TABS: { key: Tab; label: string }[] = [
    { key: "plugins", label: "Плагины Анализатора документов" },
    { key: "settings", label: "Настройки анализа" },
  ];

  return (
    <>
      <Header />
      <div className="mx-auto max-w-2xl px-4 py-10 sm:px-6 lg:px-8">
        {/* Tabs */}
        <div className="mb-8 flex border-b border-gray-200">
          {TABS.map((tab) => (
            <button
              key={tab.key}
              type="button"
              onClick={() => setActiveTab(tab.key)}
              className={`-mb-px px-5 py-3 text-sm font-medium transition ${
                activeTab === tab.key
                  ? "border-b-2 border-emerald-600 text-emerald-600"
                  : "text-gray-500 hover:text-gray-700"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Tab: Plugins */}
        {activeTab === "plugins" && (
          <div className="space-y-6">
            {/* Section header */}
            <div className="rounded-xl bg-gray-100 px-5 py-3">
              <span className="text-xs font-semibold uppercase tracking-wider text-gray-500">
                Модули анализа
              </span>
            </div>

            {plugins.length === 0 && (
              <p className="text-sm text-gray-500">Плагины не найдены.</p>
            )}

            <div className="space-y-3">
              {plugins.map((p) => {
                const isOpen = expandedPlugins.has(p.manifest.id);
                const isPro = !p.available_for_plan;
                const toggle = () =>
                  setExpandedPlugins((prev) => {
                    const next = new Set(prev);
                    if (next.has(p.manifest.id)) next.delete(p.manifest.id);
                    else next.add(p.manifest.id);
                    return next;
                  });

                return (
                  <div
                    key={p.manifest.id}
                    className={`overflow-hidden rounded-2xl border bg-white shadow-sm transition ${
                      isOpen ? "border-gray-300 ring-1 ring-gray-200" : "border-gray-200"
                    }`}
                  >
                    {/* Header row */}
                    <div className="flex items-center gap-3 px-5 py-4">
                      {isPro && (
                        <svg className="h-4 w-4 flex-shrink-0 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
                        </svg>
                      )}
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-semibold text-gray-900">
                            {p.manifest.name}
                          </span>
                          {isPro && (
                            <span className="text-xs font-medium text-gray-400">
                              Pro
                            </span>
                          )}
                        </div>
                      </div>
                      {/* Switch */}
                      <button
                        type="button"
                        role="switch"
                        aria-checked={!isPro}
                        className={`relative inline-flex h-6 w-10 flex-shrink-0 cursor-pointer rounded-full transition-colors ${
                          !isPro ? "bg-emerald-500" : "bg-gray-300"
                        }`}
                        onClick={(e) => e.stopPropagation()}
                      >
                        <span
                          className={`pointer-events-none inline-block h-5 w-5 translate-y-0.5 rounded-full bg-white shadow transition-transform ${
                            !isPro ? "translate-x-[18px]" : "translate-x-0.5"
                          }`}
                        />
                      </button>
                      {/* Chevron */}
                      <button
                        type="button"
                        onClick={toggle}
                        className="flex-shrink-0 rounded-lg p-1 text-gray-400 transition hover:bg-gray-100 hover:text-gray-600"
                      >
                        <svg
                          className={`h-5 w-5 transition-transform ${isOpen ? "rotate-180" : ""}`}
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                          strokeWidth={2}
                        >
                          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                        </svg>
                      </button>
                    </div>

                    {/* Expanded details */}
                    {isOpen && (
                      <div className="border-t border-gray-100 bg-gray-50/50 px-5 py-5">
                        <p className="text-sm text-gray-600">{p.manifest.description}</p>

                        <div className="mt-4 grid grid-cols-2 gap-x-6 gap-y-3 text-xs">
                          <div>
                            <span className="font-medium text-gray-400">Категория</span>
                            <p className="mt-0.5 font-medium text-gray-900">{p.manifest.category}</p>
                          </div>
                          <div>
                            <span className="font-medium text-gray-400">Версия</span>
                            <p className="mt-0.5 font-medium text-gray-900">{p.manifest.version}</p>
                          </div>
                          <div>
                            <span className="font-medium text-gray-400">Тариф</span>
                            <p className="mt-0.5 font-medium text-gray-900">{p.manifest.required_plan}</p>
                          </div>
                          <div>
                            <span className="font-medium text-gray-400">UI слоты</span>
                            <p className="mt-0.5 font-medium text-gray-900">
                              {p.manifest.ui_slots.join(", ") || "—"}
                            </p>
                          </div>
                        </div>

                        <div className="mt-4">
                          <span className="text-xs font-medium text-gray-400">Поддерживаемые форматы</span>
                          <div className="mt-1.5 flex flex-wrap gap-1.5">
                            {p.manifest.supported_inputs.map((input) => (
                              <span
                                key={input}
                                className="inline-flex rounded-full bg-gray-200/70 px-2.5 py-0.5 text-xs font-medium text-gray-700"
                              >
                                {input}
                              </span>
                            ))}
                          </div>
                        </div>

                        <div className="mt-3">
                          <span className="text-xs font-medium text-gray-400">Возможности</span>
                          <div className="mt-1.5 flex flex-wrap gap-1.5">
                            {p.manifest.capabilities.map((cap) => (
                              <span
                                key={cap}
                                className="inline-flex rounded-full bg-emerald-100/70 px-2.5 py-0.5 text-xs font-medium text-emerald-700"
                              >
                                {cap}
                              </span>
                            ))}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Tab: Settings */}
        {activeTab === "settings" && (
          <div className="space-y-6">
            {/* Секция: Подключение к LLM */}
            <section className="rounded-2xl border border-gray-200 bg-white shadow-sm">
              <div className="border-b border-gray-100 px-6 py-4">
                <h2 className="text-lg font-semibold text-gray-900">Подключение к LLM</h2>
                <p className="mt-0.5 text-sm text-gray-500">Укажите сервер и ключ для анализа документов</p>
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

            {/* Секция: Параметры анализа */}
            <section className="rounded-2xl border border-gray-200 bg-white shadow-sm">
              <div className="border-b border-gray-100 px-6 py-4">
                <h2 className="text-lg font-semibold text-gray-900">Параметры анализа</h2>
                <p className="mt-0.5 text-sm text-gray-500">Настройте поведение анализатора</p>
              </div>
              <div className="space-y-5 px-6 py-5">
                <div className="w-full">
                  <label className="mb-1.5 block text-sm font-medium text-gray-700">
                    Режим анализа
                  </label>
                  <div className="flex rounded-xl border border-gray-300 bg-gray-100 p-1">
                    <button
                      type="button"
                      onClick={() => setAnalysisMode("fast")}
                      className={`flex-1 rounded-lg px-4 py-2.5 text-sm font-medium transition ${
                        analysisMode === "fast"
                          ? "bg-white text-gray-900 shadow-sm"
                          : "text-gray-600 hover:text-gray-900"
                      }`}
                    >
                      Быстрый
                    </button>
                    <button
                      type="button"
                      onClick={() => setAnalysisMode("deep")}
                      className={`flex-1 rounded-lg px-4 py-2.5 text-sm font-medium transition ${
                        analysisMode === "deep"
                          ? "bg-white text-gray-900 shadow-sm"
                          : "text-gray-600 hover:text-gray-900"
                      }`}
                    >
                      Глубокий
                    </button>
                  </div>
                  <p className="mt-1.5 text-xs text-gray-500">
                    Быстрый — один проход, подходит для локальных моделей. Глубокий — детальный структурный анализ.
                  </p>
                </div>

                <div className="w-full">
                  <label className="mb-1.5 block text-sm font-medium text-gray-700">
                    Сжатие контекста
                  </label>
                  <select
                    value={compression}
                    onChange={(e) => setCompression(e.target.value)}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-gray-900 shadow-sm transition focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                  >
                    {COMPRESSION_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </section>

            {/* Кнопка сохранения */}
            <div className="flex justify-end">
              <Button onClick={handleSave} disabled={saving} className="min-w-[160px]">
                {saving ? "Сохраняем..." : "Сохранить"}
              </Button>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
