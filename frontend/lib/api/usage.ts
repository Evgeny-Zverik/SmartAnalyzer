import { apiFetch } from "@/lib/api/client";

export type UsageStatus = {
  plan: string;
  limits: { daily_runs_per_tool: number | null };
  usage_today: Record<string, number>;
};

export async function getUsageStatus(): Promise<UsageStatus> {
  return apiFetch<UsageStatus>("/api/v1/usage/status");
}
