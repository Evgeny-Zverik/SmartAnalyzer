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
};

export type AdminUsersResponse = {
  items: AdminUser[];
  total: number;
};

export function listAdminUsers(): Promise<AdminUsersResponse> {
  return apiFetch<AdminUsersResponse>("/api/v1/admin/users");
}

export function deleteAdminUser(userId: number): Promise<void> {
  return apiFetch<void>(`/api/v1/admin/users/${userId}`, { method: "DELETE" });
}
