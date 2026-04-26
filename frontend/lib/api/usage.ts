import { apiFetch } from "@/lib/api/client";

export type UsageStatus = {
  plan: string;
  credit_balance: number;
  credit_costs: Record<string, number>;
  usage_today: Record<string, number>;
};

export async function getUsageStatus(): Promise<UsageStatus> {
  return apiFetch<UsageStatus>("/api/v1/usage/status");
}
