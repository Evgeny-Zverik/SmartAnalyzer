import { apiFetch } from "@/lib/api/client";

export type UserSettings = {
  llm_base_url: string | null;
  llm_api_key_set: boolean;
  llm_model: string | null;
  compression_level: string | null;
  analysis_mode: string | null;
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
