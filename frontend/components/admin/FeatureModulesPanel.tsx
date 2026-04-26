"use client";

import { useEffect, useState } from "react";
import { Puzzle } from "lucide-react";
import { toast } from "sonner";
import { logout as authLogout } from "@/lib/api/auth";
import { requestReauth } from "@/lib/auth/session";
import { isUnauthorized } from "@/lib/api/errors";
import {
  getFeatureModules,
  updateFeatureModule,
  type FeatureModuleState,
} from "@/lib/api/settings";
import { clearDocumentAnalyzerEncryptionCache } from "@/lib/features/documentAnalyzerEncryption";
import { saveFeatureModulesCache } from "@/lib/features/toolFeatureGate";

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

const FEATURE_TAB_LABELS: Record<string, string> = {
  document_analyzer: "Плагины Анализатора документов",
  handwriting_recognition: "Распознавание рукописных документов",
  data_extractor: "Сравнение документов",
  tender_analyzer: "Обзор судебной практики",
  risk_analyzer: "Анализатор рисков",
  legal_style_translator: "Перевод на юридический",
  legal_text_simplifier: "Пересказ юридического текста",
  spelling_checker: "Проверка правописания",
  foreign_language_translator: "Перевод с иностранного языка",
  legal_document_design_review: "Дизайн юридических документов",
};

function featureLabel(feature: FeatureModuleState): string {
  return FEATURE_TAB_LABELS[feature.key] ?? feature.name;
}

export function FeatureModulesPanel() {
  const [activeFeatureKey, setActiveFeatureKey] = useState<string>("document_analyzer");
  const [loading, setLoading] = useState(true);
  const [featureModules, setFeatureModules] = useState<FeatureModuleState[]>([]);
  const [expandedKeys, setExpandedKeys] = useState<Set<string>>(new Set());
  const [togglingKey, setTogglingKey] = useState<string | null>(null);

  useEffect(() => {
    getFeatureModules()
      .then((modules) => {
        setFeatureModules(modules);
        saveFeatureModulesCache(modules);
      })
      .catch((err) => {
        if (isUnauthorized(err)) {
          authLogout();
          requestReauth({ reason: "admin_feature_modules" });
          return;
        }
        toast.error("Не удалось загрузить фича-модули");
      })
      .finally(() => setLoading(false));
  }, []);

  const parentFeatures = featureModules.filter((item) => item.kind === "feature");
  const selectedParentFeature =
    parentFeatures.find((feature) => feature.key === activeFeatureKey) ?? parentFeatures[0] ?? null;
  const enabledParentFeatures = parentFeatures.filter((feature) => feature.effective_enabled);
  const disabledParentFeatures = parentFeatures.filter((feature) => !feature.effective_enabled);

  useEffect(() => {
    if (!selectedParentFeature && parentFeatures[0]) {
      setActiveFeatureKey(parentFeatures[0].key);
    }
  }, [parentFeatures, selectedParentFeature]);

  async function handleFeatureToggle(featureKey: string, enabled: boolean) {
    setTogglingKey(featureKey);
    try {
      const updated = await updateFeatureModule(featureKey, enabled);
      setFeatureModules(updated);
      saveFeatureModulesCache(updated);
      clearDocumentAnalyzerEncryptionCache();
      toast.success("Фича-модуль обновлён");
    } catch (error) {
      if (isUnauthorized(error)) {
        authLogout();
        requestReauth({ reason: "admin_feature_modules_save" });
        return;
      }
      toast.error("Не удалось обновить модуль");
    } finally {
      setTogglingKey(null);
    }
  }

  if (loading) {
    return (
      <section className="mt-6 rounded-3xl border border-zinc-200 bg-white/95 px-5 py-10 text-center text-sm text-zinc-500 shadow-[0_14px_50px_rgba(15,23,42,0.07)]">
        Загрузка фича-модулей…
      </section>
    );
  }

  return (
    <section className="mt-6 space-y-6">
      <div className="rounded-3xl border border-zinc-200 bg-white/95 p-5 shadow-[0_14px_50px_rgba(15,23,42,0.07)] sm:p-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl border border-emerald-300 bg-emerald-100/70 text-emerald-700">
              <Puzzle className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-zinc-900">Фича-модули</h2>
              <p className="mt-1 max-w-2xl text-sm leading-6 text-zinc-600">
                Управление доступностью инструментов и дочерних модулей вынесено в админ-панель.
              </p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <span className="rounded-full border border-emerald-300 bg-emerald-50 px-3 py-1 font-semibold text-emerald-700">
              Включено: {enabledParentFeatures.length}
            </span>
            <span className="rounded-full border border-zinc-300 bg-zinc-50 px-3 py-1 font-semibold text-zinc-600">
              Выключено: {disabledParentFeatures.length}
            </span>
          </div>
        </div>

        <div className="mt-5 grid gap-4 lg:grid-cols-2">
          <div className="rounded-2xl border border-emerald-200 bg-emerald-50/55 p-4">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-emerald-700">Сейчас включено</p>
            <div className="mt-3 flex flex-wrap gap-2">
              {enabledParentFeatures.length > 0 ? (
                enabledParentFeatures.map((feature) => (
                  <span
                    key={feature.key}
                    className="inline-flex items-center rounded-full border border-emerald-300 bg-white px-3 py-1 text-xs font-medium text-emerald-800"
                  >
                    {featureLabel(feature)}
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
                    {featureLabel(feature)}
                  </span>
                ))
              ) : (
                <span className="text-sm text-zinc-600">Все модули включены</span>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="rounded-2xl border border-zinc-200 bg-white/90 p-2 shadow-sm">
        <div className="flex flex-wrap gap-2">
          {parentFeatures.map((feature) => (
            <button
              key={feature.key}
              type="button"
              onClick={() => setActiveFeatureKey(feature.key)}
              className={`rounded-xl px-4 py-2.5 text-sm font-medium transition ${
                activeFeatureKey === feature.key
                  ? "bg-zinc-900 text-white shadow-[0_10px_30px_rgba(24,24,27,0.2)]"
                  : "text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900"
              }`}
            >
              {featureLabel(feature)}
            </button>
          ))}
        </div>
      </div>

      {parentFeatures.length === 0 && (
        <p className="rounded-3xl border border-zinc-200 bg-white/95 px-5 py-10 text-center text-sm text-zinc-500 shadow-[0_14px_50px_rgba(15,23,42,0.07)]">
          Фича-модули не найдены.
        </p>
      )}

      {selectedParentFeature && (
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
      )}
    </section>
  );
}
