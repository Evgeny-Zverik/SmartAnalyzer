import { apiFetch } from "@/lib/api/client";

export type AdminUserTool = {
  slug: string;
  count: number;
};

export type AdminUser = {
  id: number;
  email: string;
  plan: string;
  credit_balance: number;
  created_at: string;
  last_seen_at: string | null;
  tools: AdminUserTool[];
  tokens_in: number;
  tokens_out: number;
  credits_spent: number;
  is_blocked: boolean;
};

export type AdminUsersResponse = {
  items: AdminUser[];
  total: number;
  page: number;
  page_size: number;
  summary: { active: number; inactive: number; all: number };
};

export type AdminUsersQuery = {
  page?: number;
  pageSize?: number;
  q?: string;
  sort?: "recent" | "activity";
};

export function listAdminUsers(query: AdminUsersQuery = {}): Promise<AdminUsersResponse> {
  const params: Record<string, string> = {};
  if (query.page) params.page = String(query.page);
  if (query.pageSize) params.page_size = String(query.pageSize);
  if (query.q) params.q = query.q;
  if (query.sort) params.sort = query.sort;
  return apiFetch<AdminUsersResponse>("/api/v1/admin/users", { params });
}

export function deleteAdminUser(userId: number): Promise<void> {
  return apiFetch<void>(`/api/v1/admin/users/${userId}`, { method: "DELETE" });
}

export function setAdminUserBlocked(
  userId: number,
  isBlocked: boolean
): Promise<{ id: number; is_blocked: boolean }> {
  return apiFetch(`/api/v1/admin/users/${userId}/block`, {
    method: "POST",
    body: JSON.stringify({ is_blocked: isBlocked }),
  });
}

export type AdjustCreditsResponse = {
  user_id: number;
  credit_balance: number;
  amount: number;
  reason: string | null;
  actor_id: number;
};

export function adjustAdminUserCredits(
  userId: number,
  amount: number,
  reason?: string | null
): Promise<AdjustCreditsResponse> {
  return apiFetch<AdjustCreditsResponse>(`/api/v1/admin/users/${userId}/credits`, {
    method: "POST",
    body: JSON.stringify({ amount, reason: reason ?? null }),
  });
}

export type RevenuePackageRow = {
  package_id: string;
  name: string;
  price_rub: number | null;
  count: number;
  revenue_rub: number;
  credits: number;
};

export type RevenueByDayRow = {
  date: string;
  revenue_rub: number;
  purchases: number;
  credits: number;
};

export type RevenueTopSpender = {
  user_id: number;
  email: string;
  plan: string | null;
  credit_balance: number;
  created_at: string | null;
  revenue_rub: number;
  credits_purchased: number;
  purchases: number;
};

export type RevenueRecentPurchase = {
  id: number;
  user_id: number;
  email: string;
  package: string | null;
  credits: number;
  revenue_rub: number;
  created_at: string;
};

export type RevenueByToolRow = {
  tool_slug: string;
  runs: number;
  tokens_in: number;
  tokens_out: number;
  credits_charged: number;
  token_cost_rub: number;
  credit_revenue_rub: number;
};

export type RevenueDashboard = {
  period: { days: number; from: string; to: string };
  totals_lifetime: {
    revenue_rub: number;
    purchases: number;
    paying_users: number;
    total_users: number;
    active_users: number;
    arppu_rub: number;
    arpu_rub: number;
    paying_conversion_pct: number;
    credits_issued: number;
    credits_spent: number;
    credits_bonus_issued: number;
    credits_outstanding: number;
    tokens_in: number;
    tokens_out: number;
    token_cost_rub: number;
    gross_margin_rub: number;
    gross_margin_pct: number;
  };
  totals_period: {
    revenue_rub: number;
    purchases: number;
    paying_users: number;
    active_users: number;
    arppu_rub: number;
    credits_issued: number;
    credits_spent: number;
    credits_charged: number;
    tokens_in: number;
    tokens_out: number;
    token_cost_rub: number;
    gross_margin_rub: number;
    gross_margin_pct: number;
  };
  by_package: RevenuePackageRow[];
  by_day: RevenueByDayRow[];
  top_spenders: RevenueTopSpender[];
  recent_purchases: RevenueRecentPurchase[];
  by_tool_lifetime: RevenueByToolRow[];
  by_plan: { plan: string; users: number }[];
  new_users_by_day: { date: string; new_users: number }[];
  pricing: {
    input_token_rub_per_million: number;
    output_token_rub_per_million: number;
    rub_per_credit: number;
    packages: { id: string; price_rub: number; credits: number; rub_per_credit: number }[];
  };
};

export function getAdminRevenue(days: number): Promise<RevenueDashboard> {
  return apiFetch<RevenueDashboard>("/api/v1/admin/revenue", {
    params: { days: String(days) },
  });
}
