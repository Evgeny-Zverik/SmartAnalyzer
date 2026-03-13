import { apiFetch } from "@/lib/api/client";

export type UserSettings = {
  llm_base_url: string | null;
  llm_api_key_set: boolean;
  llm_model: string | null;
  compression_level: string | null;
  analysis_mode: string | null;
};

export type FeatureModuleState = {
  key: string;
  name: string;
  description: string;
  example: string;
  kind: "feature" | "module";
  parent_key: string | null;
  plugin_id: string | null;
  required_plan: "free" | "pro" | "enterprise";
  default_enabled: boolean;
  user_enabled: boolean;
  available_for_plan: boolean;
  parent_enabled: boolean;
  effective_enabled: boolean;
  blocked_reason: "plan_locked" | "parent_disabled" | null;
};

export type UserSettingsUpdate = {
  llm_base_url?: string | null;
  llm_api_key?: string | null;
  llm_model?: string | null;
  compression_level?: string | null;
  analysis_mode?: string | null;
};

export async function getSettings(): Promise<UserSettings> {
  return apiFetch<UserSettings>("/api/v1/settings");
}

export async function updateSettings(data: UserSettingsUpdate): Promise<UserSettings> {
  return apiFetch<UserSettings>("/api/v1/settings", {
    method: "PUT",
    body: JSON.stringify(data),
  });
}

export async function getFeatureModules(): Promise<FeatureModuleState[]> {
  return apiFetch<FeatureModuleState[]>("/api/v1/settings/features");
}

export async function updateFeatureModule(
  featureKey: string,
  enabled: boolean
): Promise<FeatureModuleState[]> {
  return apiFetch<FeatureModuleState[]>(`/api/v1/settings/features/${featureKey}`, {
    method: "PUT",
    body: JSON.stringify({ enabled }),
  });
}
