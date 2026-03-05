import { apiFetch } from "@/lib/api/client";

export type UpgradeResponse = {
  plan: string;
};

export async function upgradePlan(plan: "pro"): Promise<UpgradeResponse> {
  return apiFetch<UpgradeResponse>("/api/v1/billing/upgrade", {
    method: "POST",
    body: JSON.stringify({ plan }),
  });
}
