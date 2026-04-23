import { apiFetch } from "@/lib/api/client";

export type AdminUserTool = {
  slug: string;
  count: number;
};

export type AdminUser = {
  id: number;
  email: string;
  plan: string;
  created_at: string;
  last_seen_at: string | null;
  tools: AdminUserTool[];
  tokens_in: number;
  tokens_out: number;
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
