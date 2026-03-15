"use client";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { getToken } from "@/lib/auth/token";
import { clearDocumentAnalyzerEncryptionCache } from "@/lib/features/documentAnalyzerEncryption";
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
    <pre className="mt-2 overflow-x-auto rounded-xl bg-gray-950 px-3 py-2 text-[11px] leading-5 text-emerald-100 shadow-sm">
      <code>{value}</code>
    </pre>
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
      getFeatureModules().then(setFeatureModules),
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

  async function handleFeatureToggle(featureKey: string, enabled: boolean) {
    setTogglingKey(featureKey);
    try {
      const updated = await updateFeatureModule(featureKey, enabled);
      setFeatureModules(updated);
      clearDocumentAnalyzerEncryptionCache();
    } catch (error) {
      if (isUnauthorized(error)) {
        router.replace("/login");
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
  };
  const featureTabs = parentFeatures.map((feature) => ({
    key: feature.key,
    label: featureTabLabels[feature.key] ?? feature.name,
  }));
  const tabs = [...featureTabs, { key: "settings", label: "Настройки анализа" }];
  const selectedParentFeature =
    parentFeatures.find((feature) => feature.key === activeTab) ?? parentFeatures[0] ?? null;

  useEffect(() => {
    if (activeTab === "settings") return;
    if (!selectedParentFeature && parentFeatures[0]) {
      setActiveTab(parentFeatures[0].key);
    }
  }, [activeTab, parentFeatures, selectedParentFeature]);

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <p className="text-gray-500">Загрузка...</p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-10 sm:px-6 lg:px-8">
        {/* Tabs */}
        <div className="mb-8 flex border-b border-gray-200">
          {tabs.map((tab) => (
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

        {/* Feature Tabs */}
        {activeTab !== "settings" && selectedParentFeature && (
          <div className="space-y-6">
            {/* Section header */}
            <div className="rounded-xl bg-gray-100 px-5 py-3">
              <span className="text-xs font-semibold uppercase tracking-wider text-gray-500">
                {selectedParentFeature.key === "document_analyzer" ? "Модули анализа" : "Настройки фичи"}
              </span>
            </div>

            {parentFeatures.length === 0 && (
              <p className="text-sm text-gray-500">Плагины не найдены.</p>
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
                    className={`overflow-hidden rounded-2xl border bg-white shadow-sm transition ${
                      isOpen ? "border-gray-300 ring-1 ring-gray-200" : "border-gray-200"
                    }`}
                  >
                    <div className="flex items-center gap-3 px-5 py-4">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-semibold text-gray-900">{feature.name}</span>
                          {isLocked && (
                            <span className="text-xs font-medium text-gray-400">Pro</span>
                          )}
                        </div>
                        <p className="mt-1 text-xs text-gray-500">{feature.description}</p>
                        <ExampleSnippet value={feature.example} />
                      </div>
                      <button
                        type="button"
                        role="switch"
                        aria-checked={feature.effective_enabled}
                        aria-label={`Toggle ${feature.name}`}
                        disabled={isLocked || isPending}
                        onClick={() => void handleFeatureToggle(feature.key, !feature.user_enabled)}
                        className={`relative inline-flex h-6 w-10 flex-shrink-0 items-center rounded-full transition-colors ${
                          isLocked || isPending
                            ? "cursor-not-allowed bg-gray-300"
                            : feature.effective_enabled
                              ? "bg-emerald-500"
                              : "bg-gray-300"
                        }`}
                      >
                        <span
                          className={`inline-block h-5 w-5 rounded-full bg-white shadow transition-transform ${
                            feature.effective_enabled ? "translate-x-[18px]" : "translate-x-0.5"
                          }`}
                        />
                      </button>
                      {children.length > 0 && (
                        <button
                          type="button"
                          onClick={toggleExpand}
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
                      )}
                    </div>

                    {isOpen && children.length > 0 && (
                      <div className="border-t border-gray-100 bg-gray-50/50 px-5 py-5">
                        <div className="mb-4 rounded-xl border border-gray-200 bg-white px-4 py-3">
                          <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">
                            Дочерние модули
                          </p>
                          <p className="mt-1 text-xs text-gray-500">
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
                                    ? "border-gray-200 bg-gray-50 text-gray-500"
                                    : "border-gray-200 bg-white"
                                }`}
                              >
                                <div className="flex items-center gap-3">
                                  <div className="min-w-0 flex-1">
                                    <div className="flex items-center gap-2">
                                      <span className="text-sm font-semibold text-gray-900">
                                        {module.name}
                                      </span>
                                      {moduleLocked && (
                                        <span className="text-xs font-medium text-gray-400">Pro</span>
                                      )}
                                    </div>
                                    <p className="mt-1 text-xs text-gray-500">{module.description}</p>
                                    <ExampleSnippet value={module.example} />
                                    {inheritedOff && (
                                      <p className="mt-2 text-xs text-amber-600">
                                        Выключен родительским модулем.
                                      </p>
                                    )}
                                    {moduleLocked && (
                                      <p className="mt-2 text-xs text-gray-400">
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
                                        ? "cursor-not-allowed bg-gray-300"
                                        : module.effective_enabled
                                          ? "bg-emerald-500"
                                          : "bg-gray-300"
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
  );
}
