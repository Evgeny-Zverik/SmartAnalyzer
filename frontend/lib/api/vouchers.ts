import { apiFetch } from "@/lib/api/client";

export type Voucher = {
  id: number;
  code: string;
  credits: number;
  usage_limit: number;
  used_count: number;
  valid_from: string | null;
  valid_until: string | null;
  bound_user_id: number | null;
  bound_user_email: string | null;
  created_at: string | null;
};

export type VoucherRedemption = {
  id: number;
  voucher_id: number;
  code: string;
  user_id: number;
  user_email: string;
  credits_granted: number;
  created_at: string | null;
};

export type CreateVoucherInput = {
  code?: string | null;
  credits: number;
  usage_limit: number;
  valid_from?: string | null;
  valid_until?: string | null;
  bound_user_email?: string | null;
};

export function listAdminVouchers(): Promise<{ items: Voucher[] }> {
  return apiFetch<{ items: Voucher[] }>("/api/v1/admin/vouchers");
}

export function createAdminVoucher(payload: CreateVoucherInput): Promise<Voucher> {
  return apiFetch<Voucher>("/api/v1/admin/vouchers", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function deleteAdminVoucher(id: number): Promise<void> {
  return apiFetch<void>(`/api/v1/admin/vouchers/${id}`, { method: "DELETE" });
}

export function listAdminVoucherRedemptions(): Promise<{ items: VoucherRedemption[] }> {
  return apiFetch<{ items: VoucherRedemption[] }>(
    "/api/v1/admin/vouchers/redemptions"
  );
}

export type RedeemVoucherResponse = {
  credits_granted: number;
  credit_balance: number;
  code: string;
};

export function redeemVoucher(code: string): Promise<RedeemVoucherResponse> {
  return apiFetch<RedeemVoucherResponse>("/api/v1/vouchers/redeem", {
    method: "POST",
    body: JSON.stringify({ code }),
  });
}
