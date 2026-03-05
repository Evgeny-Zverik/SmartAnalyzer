"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";

const STORAGE_KEY = "smartanalyzer_llm_config";

export type LLMConfig = {
  mode: "local" | "api";
  base_url: string;
  api_key: string;
  model: string;
};

const DEFAULT_LOCAL: LLMConfig = {
  mode: "local",
  base_url: "http://localhost:11434/v1",
  api_key: "ollama",
  model: "llama3.2",
};

const DEFAULT_API: LLMConfig = {
  mode: "api",
  base_url: "https://api.openai.com/v1",
  api_key: "",
  model: "gpt-4o-mini",
};

function loadStored(): LLMConfig | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as LLMConfig;
    if (parsed.mode && (parsed.mode === "local" || parsed.mode === "api")) {
      return {
        mode: parsed.mode,
        base_url: typeof parsed.base_url === "string" ? parsed.base_url : "",
        api_key: typeof parsed.api_key === "string" ? parsed.api_key : "",
        model: typeof parsed.model === "string" ? parsed.model : "",
      };
    }
  } catch {
    return null;
  }
  return null;
}

export function getStoredLLMConfig(): LLMConfig | null {
  return loadStored();
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
  const stored = loadStored();
  const [activeTab, setActiveTab] = useState<"local" | "api">(initialConfig?.mode ?? stored?.mode ?? "local");
  const [baseUrl, setBaseUrl] = useState(initialConfig?.base_url ?? stored?.base_url ?? DEFAULT_LOCAL.base_url);
  const [apiKey, setApiKey] = useState(initialConfig?.api_key ?? stored?.api_key ?? "");
  const [model, setModel] = useState(initialConfig?.model ?? stored?.model ?? DEFAULT_LOCAL.model);

  useEffect(() => {
    if (!isOpen) return;
    const c = initialConfig ?? stored;
    if (c) {
      setActiveTab(c.mode);
      setBaseUrl(c.base_url);
      setApiKey(c.api_key);
      setModel(c.model);
    } else {
      setActiveTab("local");
      setBaseUrl(DEFAULT_LOCAL.base_url);
      setApiKey(DEFAULT_LOCAL.api_key);
      setModel(DEFAULT_LOCAL.model);
    }
  }, [isOpen, initialConfig, stored]);

  function handleTabLocal() {
    setActiveTab("local");
    setBaseUrl(DEFAULT_LOCAL.base_url);
    setApiKey(DEFAULT_LOCAL.api_key);
    setModel(DEFAULT_LOCAL.model);
  }

  function handleTabApi() {
    setActiveTab("api");
    setBaseUrl(DEFAULT_API.base_url);
    setApiKey(DEFAULT_API.api_key);
    setModel(DEFAULT_API.model);
  }

  function handleSave() {
    const config: LLMConfig = {
      mode: activeTab,
      base_url: baseUrl.trim(),
      api_key: apiKey.trim(),
      model: model.trim(),
    };
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
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
                Для Ollama оставьте API key пустым или «ollama». Укажите URL и имя модели.
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
