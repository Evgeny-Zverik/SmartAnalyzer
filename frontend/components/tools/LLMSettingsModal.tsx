"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";

const STORAGE_KEY = "smartanalyzer_llm_config";

export type LLMConfig = {
  mode: "local" | "api";
  base_url: string;
  api_key: string;
  model: string;
};

export const DEFAULT_LOCAL: LLMConfig = {
  mode: "local",
  base_url: "http://localhost:11434/v1",
  api_key: "ollama",
  model: "llama3.2",
};

export const DEFAULT_API: LLMConfig = {
  mode: "api",
  base_url: "https://api.openai.com/v1",
  api_key: "",
  model: "gpt-4o-mini",
};

type StoredLLMConfig = {
  selectedMode: "local" | "api";
  local: LLMConfig;
  api: LLMConfig;
};

function getDefaultConfig(mode: "local" | "api"): LLMConfig {
  return mode === "local" ? { ...DEFAULT_LOCAL } : { ...DEFAULT_API };
}

function normalizeConfig(mode: "local" | "api", value: unknown): LLMConfig {
  const source = value && typeof value === "object" ? (value as Partial<LLMConfig>) : {};
  const fallback = getDefaultConfig(mode);
  return {
    mode,
    base_url: typeof source.base_url === "string" ? source.base_url : fallback.base_url,
    api_key: typeof source.api_key === "string" ? source.api_key : fallback.api_key,
    model: typeof source.model === "string" ? source.model : fallback.model,
  };
}

function loadStoredState(): StoredLLMConfig {
  const fallback: StoredLLMConfig = {
    selectedMode: "local",
    local: { ...DEFAULT_LOCAL },
    api: { ...DEFAULT_API },
  };
  if (typeof window === "undefined") return fallback;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return fallback;
    const parsed = JSON.parse(raw) as Partial<StoredLLMConfig & LLMConfig>;

    if ("selectedMode" in parsed || "local" in parsed || "api" in parsed) {
      const selectedMode = parsed.selectedMode === "api" ? "api" : "local";
      return {
        selectedMode,
        local: normalizeConfig("local", parsed.local),
        api: normalizeConfig("api", parsed.api),
      };
    }

    if (parsed.mode && (parsed.mode === "local" || parsed.mode === "api")) {
      const selectedMode = parsed.mode;
      const current = normalizeConfig(selectedMode, parsed);
      return {
        selectedMode,
        local: selectedMode === "local" ? current : { ...DEFAULT_LOCAL },
        api: selectedMode === "api" ? current : { ...DEFAULT_API },
      };
    }
  } catch {
    return fallback;
  }
  return fallback;
}

function saveStoredConfig(config: LLMConfig): void {
  if (typeof window === "undefined") return;
  const state = loadStoredState();
  const next: StoredLLMConfig = {
    ...state,
    selectedMode: config.mode,
    local: config.mode === "local" ? config : state.local,
    api: config.mode === "api" ? config : state.api,
  };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
}

export function getStoredLLMConfig(): LLMConfig | null {
  const state = loadStoredState();
  return state.selectedMode === "api" ? state.api : state.local;
}

export function getStoredLLMConfigForMode(mode: "local" | "api"): LLMConfig {
  const state = loadStoredState();
  return mode === "api" ? state.api : state.local;
}

export function getLLMConfigForRequest(config: LLMConfig | null): { base_url?: string; api_key?: string; model?: string } | null {
  if (!config || (!config.base_url && !config.api_key && !config.model)) return null;
  const out: { base_url?: string; api_key?: string; model?: string } = {};
  if (config.base_url?.trim()) out.base_url = config.base_url.trim();
  if (config.api_key?.trim()) out.api_key = config.api_key.trim();
  if (config.model?.trim()) out.model = config.model.trim();
  return Object.keys(out).length ? out : null;
}

type LLMSettingsModalProps = {
  isOpen: boolean;
  onClose: () => void;
  initialConfig?: LLMConfig | null;
  onSave?: (config: LLMConfig) => void;
};

export function LLMSettingsModal({ isOpen, onClose, initialConfig, onSave }: LLMSettingsModalProps) {
  const [activeTab, setActiveTab] = useState<"local" | "api">("local");
  const [baseUrl, setBaseUrl] = useState(DEFAULT_LOCAL.base_url);
  const [apiKey, setApiKey] = useState("");
  const [model, setModel] = useState(DEFAULT_LOCAL.model);
  const openedRef = useRef(false);

  useEffect(() => {
    if (!isOpen) {
      openedRef.current = false;
      return;
    }
    if (openedRef.current) return;
    openedRef.current = true;
    const stored = getStoredLLMConfig();
    const c = initialConfig ?? stored;
    if (c) {
      setActiveTab(c.mode);
      setBaseUrl(c.base_url ?? "");
      setApiKey(c.api_key ?? "");
      setModel(c.model ?? "");
    } else {
      setActiveTab("local");
      setBaseUrl(DEFAULT_LOCAL.base_url);
      setApiKey(DEFAULT_LOCAL.api_key);
      setModel(DEFAULT_LOCAL.model);
    }
  }, [isOpen]);

  function handleTabLocal() {
    const next = getStoredLLMConfigForMode("local");
    setActiveTab("local");
    setBaseUrl(next.base_url);
    setApiKey(next.api_key);
    setModel(next.model);
  }

  function handleTabApi() {
    const next = getStoredLLMConfigForMode("api");
    setActiveTab("api");
    setBaseUrl(next.base_url);
    setApiKey(next.api_key);
    setModel(next.model);
  }

  function handleSave() {
    const config: LLMConfig = {
      mode: activeTab,
      base_url: baseUrl.trim(),
      api_key: apiKey.trim(),
      model: model.trim(),
    };
    try {
      saveStoredConfig(config);
    } catch {
      //
    }
    onSave?.(config);
    onClose();
  }

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="llm-settings-title"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-lg bg-white shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-gray-200 px-4 py-3">
          <h2 id="llm-settings-title" className="text-lg font-semibold text-gray-900">
            Настройки LLM
          </h2>
          <Button variant="ghost" type="button" onClick={onClose}>
            Закрыть
          </Button>
        </div>
        <div className="border-b border-gray-200 px-4">
          <div className="flex gap-1">
            <button
              type="button"
              onClick={handleTabLocal}
              className={`rounded-t-lg px-4 py-2.5 text-sm font-medium transition ${
                activeTab === "local"
                  ? "bg-gray-100 text-gray-900"
                  : "text-gray-600 hover:bg-gray-50"
              }`}
            >
              Локальная модель
            </button>
            <button
              type="button"
              onClick={handleTabApi}
              className={`rounded-t-lg px-4 py-2.5 text-sm font-medium transition ${
                activeTab === "api"
                  ? "bg-gray-100 text-gray-900"
                  : "text-gray-600 hover:bg-gray-50"
              }`}
            >
              API
            </button>
          </div>
        </div>
        <div className="space-y-4 p-4">
          {activeTab === "local" && (
            <>
              <Input
                label="Base URL"
                value={baseUrl}
                onChange={(e) => setBaseUrl(e.target.value)}
                placeholder="http://localhost:11434/v1"
              />
              <Input
                label="Модель"
                value={model}
                onChange={(e) => setModel(e.target.value)}
                placeholder="llama3.2"
              />
              <p className="text-xs text-gray-500">
                Укажите адрес OpenAI-совместимого сервера и имя модели. Для локальных или домашних серверов API key можно оставить пустым, если он не требуется.
              </p>
            </>
          )}
          {activeTab === "api" && (
            <>
              <Input
                label="Base URL"
                value={baseUrl}
                onChange={(e) => setBaseUrl(e.target.value)}
                placeholder="https://api.openai.com/v1"
              />
              <Input
                label="API Key"
                type="password"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder="sk-..."
              />
              <Input
                label="Модель"
                value={model}
                onChange={(e) => setModel(e.target.value)}
                placeholder="gpt-4o-mini"
              />
            </>
          )}
        </div>
        <div className="flex justify-end gap-2 border-t border-gray-200 px-4 py-3">
          <Button variant="secondary" type="button" onClick={onClose}>
            Отмена
          </Button>
          <Button type="button" onClick={handleSave}>
            Сохранить
          </Button>
        </div>
      </div>
    </div>
  );
}
