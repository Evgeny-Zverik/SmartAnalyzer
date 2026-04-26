import { apiFetch } from "@/lib/api/client";

export type CreditPackage = {
  id: "start" | "pro" | "business";
  name: string;
  credits: number;
  price_rub: number;
  description: string;
};

export type CreditPurchaseResponse = {
  credit_balance: number;
  package: CreditPackage;
};

export type CreditTransaction = {
  id: number;
  amount: number;
  balance_after: number;
  reason: string;
  reference: string | null;
  created_at: string;
};

export async function listCreditPackages(): Promise<CreditPackage[]> {
  return apiFetch<CreditPackage[]>("/api/v1/billing/credit-packages");
}

export async function purchaseCredits(packageId: CreditPackage["id"]): Promise<CreditPurchaseResponse> {
  return apiFetch<CreditPurchaseResponse>("/api/v1/billing/credits/purchase", {
    method: "POST",
    body: JSON.stringify({ package_id: packageId }),
  });
}

export async function listCreditTransactions(): Promise<CreditTransaction[]> {
  return apiFetch<CreditTransaction[]>("/api/v1/billing/credits/transactions");
}
