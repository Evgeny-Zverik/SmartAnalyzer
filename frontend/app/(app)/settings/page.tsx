"use client";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { logout as authLogout } from "@/lib/api/auth";
import { getToken } from "@/lib/auth/token";
import { buildLoginRedirectHref } from "@/lib/auth/redirect";
import { requestReauth } from "@/lib/auth/session";
import { clearDocumentAnalyzerEncryptionCache } from "@/lib/features/documentAnalyzerEncryption";
import { saveFeatureModulesCache } from "@/lib/features/toolFeatureGate";
import {
  getFeatureModules,
  getSettings,
  updateFeatureModule,
  updateSettings,
  type FeatureModuleState,
} from "@/lib/api/settings";
import { isUnauthorized } from "@/lib/api/errors";

const COMPRESSION_OPTIONS = [
  { value: "", label: "По умолчанию (сервер)" },
  { value: "off", label: "Выключена" },
  { value: "safe", label: "Безопасная" },
  { value: "aggressive", label: "Агрессивная" },
];

function ExampleSnippet({ value }: { value: string }) {
  return (
    <div className="mt-3 overflow-hidden rounded-2xl border border-zinc-800 bg-[linear-gradient(160deg,#020617,#0b1220)] shadow-[0_14px_30px_rgba(2,6,23,0.36)]">
      <div className="flex items-center justify-between border-b border-white/10 px-3 py-2">
        <div className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full bg-rose-400/90" />
          <span className="h-2.5 w-2.5 rounded-full bg-amber-400/90" />
          <span className="h-2.5 w-2.5 rounded-full bg-emerald-400/90" />
        </div>
        <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-zinc-400">Сценарий</span>
      </div>
      <pre className="overflow-x-auto px-3 py-3 text-[12px] leading-6 text-emerald-100">
        <code>{value}</code>
      </pre>
    </div>
  );
}

const ENCRYPTION_TOOLTIP =
  "Все ваши диалоги полностью зашифрованы и недоступны даже для нас. Мы используем алгоритм шифрования AES-GCM для максимальной защиты данных.";

export default function SettingsPage() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<string>("document_analyzer");
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
  const [featureModules, setFeatureModules] = useState<FeatureModuleState[]>([]);
  const [expandedKeys, setExpandedKeys] = useState<Set<string>>(new Set());
  const [togglingKey, setTogglingKey] = useState<string | null>(null);

  useEffect(() => {
    if (!getToken()) {
      router.replace(buildLoginRedirectHref());
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
      getFeatureModules().then((modules) => {
        setFeatureModules(modules);
        saveFeatureModulesCache(modules);
      }),
    ])
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

  async function handleFeatureToggle(featureKey: string, enabled: boolean) {
    setTogglingKey(featureKey);
    try {
      const updated = await updateFeatureModule(featureKey, enabled);
      setFeatureModules(updated);
      saveFeatureModulesCache(updated);
      clearDocumentAnalyzerEncryptionCache();
    } catch (error) {
      if (isUnauthorized(error)) {
        authLogout();
        requestReauth({ reason: "settings_save" });
        return;
      }
      toast.error("Не удалось обновить модуль");
    } finally {
      setTogglingKey(null);
    }
  }

  const parentFeatures = featureModules.filter((item) => item.kind === "feature");
  const featureTabLabels: Record<string, string> = {
    document_analyzer: "Плагины Анализатора документов",
    handwriting_recognition: "Распознавание рукописных документов",
    contract_checker: "AI Юрист",
    data_extractor: "Сравнение документов",
    tender_analyzer: "Обзор судебной практики",
    risk_analyzer: "Анализатор рисков",
    legal_style_translator: "Перевод на юридический",
    legal_text_simplifier: "Пересказ юридического текста",
    spelling_checker: "Проверка правописания",
    foreign_language_translator: "Перевод с иностранного языка",
    legal_document_design_review: "Дизайн юридических документов",
  };
  const featureTabs = parentFeatures.map((feature) => ({
    key: feature.key,
    label: featureTabLabels[feature.key] ?? feature.name,
  }));
  const tabs = [...featureTabs, { key: "settings", label: "Настройки анализа" }];
  const selectedParentFeature =
    parentFeatures.find((feature) => feature.key === activeTab) ?? parentFeatures[0] ?? null;
  const enabledParentFeatures = parentFeatures.filter((feature) => feature.effective_enabled);
  const disabledParentFeatures = parentFeatures.filter((feature) => !feature.effective_enabled);

  useEffect(() => {
    if (activeTab === "settings") return;
    if (!selectedParentFeature && parentFeatures[0]) {
      setActiveTab(parentFeatures[0].key);
    }
  }, [activeTab, parentFeatures, selectedParentFeature]);

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center bg-[linear-gradient(180deg,#f8fafc,#f5f5f4)]">
        <p className="rounded-full border border-zinc-200 bg-white px-4 py-2 text-sm text-zinc-500 shadow-sm">Загрузка...</p>
      </div>
    );
  }

  return (
    <div className="min-h-[calc(100vh-104px)] bg-[radial-gradient(circle_at_top_right,rgba(16,185,129,0.12),transparent_34%),linear-gradient(180deg,#f8fafc,#f5f5f4)]">
      <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
        <section className="mb-6 rounded-[30px] border border-zinc-200/90 bg-white/85 px-5 py-5 shadow-[0_18px_60px_rgba(15,23,42,0.08)] backdrop-blur sm:px-6">
          <p className="inline-flex items-center rounded-full border border-emerald-300 bg-emerald-50 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.22em] text-emerald-700">
            Settings
          </p>
          <h1 className="mt-3 text-3xl font-semibold tracking-[-0.03em] text-zinc-900 sm:text-4xl">
            Управление модулями и анализом
          </h1>
          <p className="mt-2 max-w-3xl text-sm leading-7 text-zinc-600 sm:text-base">
            Включайте и отключайте инструменты, настраивайте поведение анализа и параметры LLM в одном рабочем экране.
          </p>
        </section>

        <section className="mb-6 rounded-3xl border border-zinc-200 bg-white/90 p-5 shadow-[0_14px_50px_rgba(15,23,42,0.07)] sm:p-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-zinc-600">Сводка модулей</p>
            <div className="flex flex-wrap items-center gap-2 text-xs">
              <span className="rounded-full border border-emerald-300 bg-emerald-50 px-3 py-1 font-semibold text-emerald-700">
                Включено: {enabledParentFeatures.length}
              </span>
              <span className="rounded-full border border-zinc-300 bg-zinc-50 px-3 py-1 font-semibold text-zinc-600">
                Выключено: {disabledParentFeatures.length}
              </span>
            </div>
          </div>

          <div className="mt-4 grid gap-4 lg:grid-cols-2">
            <div className="rounded-2xl border border-emerald-200 bg-emerald-50/55 p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-emerald-700">Сейчас включено</p>
              <div className="mt-3 flex flex-wrap gap-2">
                {enabledParentFeatures.length > 0 ? (
                  enabledParentFeatures.map((feature) => (
                    <span
                      key={feature.key}
                      className="inline-flex items-center rounded-full border border-emerald-300 bg-white px-3 py-1 text-xs font-medium text-emerald-800"
                    >
                      {featureTabLabels[feature.key] ?? feature.name}
                    </span>
                  ))
                ) : (
                  <span className="text-sm text-emerald-700">Нет включенных модулей</span>
                )}
              </div>
            </div>

            <div className="rounded-2xl border border-zinc-200 bg-zinc-50/75 p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-zinc-600">Сейчас выключено</p>
              <div className="mt-3 flex flex-wrap gap-2">
                {disabledParentFeatures.length > 0 ? (
                  disabledParentFeatures.map((feature) => (
                    <span
                      key={feature.key}
                      className="inline-flex items-center rounded-full border border-zinc-300 bg-white px-3 py-1 text-xs font-medium text-zinc-700"
                    >
                      {featureTabLabels[feature.key] ?? feature.name}
                    </span>
                  ))
                ) : (
                  <span className="text-sm text-zinc-600">Все модули включены</span>
                )}
              </div>
            </div>
          </div>
        </section>

        {/* Tabs */}
        <div className="mb-6 rounded-2xl border border-zinc-200 bg-white/90 p-2 shadow-sm">
          <div className="flex flex-wrap gap-2">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              type="button"
              onClick={() => setActiveTab(tab.key)}
              className={`rounded-xl px-4 py-2.5 text-sm font-medium transition ${
                activeTab === tab.key
                  ? "bg-zinc-900 text-white shadow-[0_10px_30px_rgba(24,24,27,0.2)]"
                  : "text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900"
              }`}
            >
              {tab.label}
            </button>
          ))}
          </div>
        </div>

        {/* Feature Tabs */}
        {activeTab !== "settings" && selectedParentFeature && (
          <div className="space-y-6">
            {/* Section header */}
            <div className="rounded-2xl border border-zinc-200 bg-white/90 px-5 py-3 shadow-sm">
              <span className="text-xs font-semibold uppercase tracking-[0.22em] text-zinc-500">
                {selectedParentFeature.key === "document_analyzer" ? "Модули анализа" : "Настройки фичи"}
              </span>
            </div>

            {parentFeatures.length === 0 && (
              <p className="text-sm text-zinc-500">Плагины не найдены.</p>
            )}

            <div className="space-y-3">
              {(() => {
                const feature = selectedParentFeature;
                const children = featureModules.filter((item) => item.parent_key === feature.key);
                const isOpen = expandedKeys.has(feature.key);
                const isLocked = !feature.available_for_plan;
                const isPending = togglingKey === feature.key;
                const toggleExpand = () =>
                  setExpandedKeys((prev) => {
                    const next = new Set(prev);
                    if (next.has(feature.key)) next.delete(feature.key);
                    else next.add(feature.key);
                    return next;
                  });

                return (
                  <div
                    key={feature.key}
                    className={`group relative overflow-hidden rounded-3xl border bg-white shadow-[0_14px_50px_rgba(15,23,42,0.07)] transition ${
                      isOpen ? "border-zinc-300 ring-1 ring-zinc-200" : "border-zinc-200"
                    }`}
                  >
                    <div className="pointer-events-none absolute right-0 top-0 h-24 w-24 rounded-full bg-emerald-200/25 blur-2xl opacity-70 transition group-hover:opacity-100" />
                    <div className="relative flex flex-col gap-3 px-5 py-5 sm:flex-row sm:items-start">
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="inline-flex items-center rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-emerald-700">
                            Feature
                          </span>
                          <span className="text-base font-semibold tracking-[-0.02em] text-zinc-900">{feature.name}</span>
                          {isLocked && (
                            <span className="rounded-full border border-zinc-300 bg-zinc-100 px-2 py-0.5 text-xs font-medium text-zinc-500">Pro</span>
                          )}
                        </div>
                        <p className="mt-2 text-sm leading-6 text-zinc-600">{feature.description}</p>
                        <ExampleSnippet value={feature.example} />
                      </div>
                      <div className="flex items-center justify-between gap-3 sm:flex-col sm:items-end">
                        <button
                          type="button"
                          role="switch"
                          aria-checked={feature.effective_enabled}
                          aria-label={`Toggle ${feature.name}`}
                          disabled={isLocked || isPending}
                          onClick={() => void handleFeatureToggle(feature.key, !feature.user_enabled)}
                          className={`relative inline-flex h-7 w-12 flex-shrink-0 items-center rounded-full border transition-colors ${
                            isLocked || isPending
                              ? "cursor-not-allowed border-zinc-300 bg-zinc-300"
                              : feature.effective_enabled
                                ? "border-emerald-500 bg-emerald-500"
                                : "border-zinc-300 bg-zinc-300"
                          }`}
                        >
                          <span
                            className={`inline-block h-5 w-5 rounded-full bg-white shadow transition-transform ${
                              feature.effective_enabled ? "translate-x-[24px]" : "translate-x-0.5"
                            }`}
                          />
                        </button>
                        {children.length > 0 && (
                          <button
                            type="button"
                            onClick={toggleExpand}
                            className="inline-flex items-center gap-1 rounded-full border border-zinc-200 bg-zinc-50 px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.14em] text-zinc-600 transition hover:bg-zinc-100"
                          >
                            Модули
                            <svg
                              className={`h-4 w-4 transition-transform ${isOpen ? "rotate-180" : ""}`}
                              fill="none"
                              viewBox="0 0 24 24"
                              stroke="currentColor"
                              strokeWidth={2}
                            >
                              <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                            </svg>
                          </button>
                        )}
                      </div>
                    </div>

                    {isOpen && children.length > 0 && (
                      <div className="border-t border-zinc-100 bg-zinc-50/70 px-5 py-5">
                        <div className="mb-4 rounded-xl border border-zinc-200 bg-white px-4 py-3">
                          <p className="text-xs font-semibold uppercase tracking-wide text-zinc-400">
                            Дочерние модули
                          </p>
                          <p className="mt-1 text-xs text-zinc-500">
                            Родительский toggle управляет полным подключением workspace и всех модулей внутри.
                          </p>
                        </div>

                        <div className="space-y-3">
                          {children.map((module) => {
                            const moduleLocked = !module.available_for_plan;
                            const modulePending = togglingKey === module.key;
                            const inheritedOff = module.blocked_reason === "parent_disabled";

                            return (
                              <div
                                key={module.key}
                                className={`rounded-2xl border px-4 py-4 shadow-sm ${
                                  inheritedOff
                                    ? "border-zinc-200 bg-zinc-50 text-zinc-500"
                                    : "border-zinc-200 bg-white"
                                }`}
                              >
                                <div className="flex items-center gap-3">
                                  <div className="min-w-0 flex-1">
                                    <div className="flex items-center gap-2">
                                      <span className="text-sm font-semibold text-zinc-900">
                                        {module.name}
                                      </span>
                                      {moduleLocked && (
                                        <span className="rounded-full border border-zinc-300 bg-zinc-100 px-2 py-0.5 text-xs font-medium text-zinc-500">Pro</span>
                                      )}
                                    </div>
                                    <p className="mt-1 text-xs text-zinc-500">{module.description}</p>
                                    <ExampleSnippet value={module.example} />
                                    {inheritedOff && (
                                      <p className="mt-2 text-xs text-amber-600">
                                        Выключен родительским модулем.
                                      </p>
                                    )}
                                    {moduleLocked && (
                                      <p className="mt-2 text-xs text-zinc-400">
                                        Недоступно на текущем тарифе.
                                      </p>
                                    )}
                                  </div>
                                  <button
                                    type="button"
                                    role="switch"
                                    aria-checked={module.effective_enabled}
                                    aria-label={`Toggle ${module.name}`}
                                    disabled={moduleLocked || inheritedOff || modulePending}
                                    onClick={() => void handleFeatureToggle(module.key, !module.user_enabled)}
                                    className={`relative inline-flex h-6 w-10 flex-shrink-0 items-center rounded-full transition-colors ${
                                      moduleLocked || inheritedOff || modulePending
                                        ? "cursor-not-allowed bg-zinc-300"
                                        : module.effective_enabled
                                          ? "bg-emerald-500"
                                          : "bg-zinc-300"
                                    }`}
                                  >
                                    <span
                                      className={`inline-block h-5 w-5 rounded-full bg-white shadow transition-transform ${
                                        module.effective_enabled ? "translate-x-[18px]" : "translate-x-0.5"
                                      }`}
                                    />
                                  </button>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })()}
            </div>
          </div>
        )}

        {/* Tab: Settings */}
        {activeTab === "settings" && (
          <div className="space-y-6">
            {/* Секция: Подключение к LLM */}
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

            {/* Секция: Параметры анализа */}
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
              <Button onClick={handleSave} disabled={saving} className="min-w-[160px] rounded-xl bg-zinc-900 hover:bg-zinc-800 focus:ring-zinc-700">
                {saving ? "Сохраняем..." : "Сохранить"}
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
