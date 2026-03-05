import { apiFetch } from "@/lib/api/client";
import { clearToken, setToken } from "@/lib/auth/token";

export type User = {
  id: number;
  email: string;
  created_at: string;
  plan: string;
};

export type LoginResponse = {
  access_token: string;
  token_type: string;
};

export async function register(email: string, password: string): Promise<User> {
  const user = await apiFetch<User>("/api/v1/auth/register", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });
  const loginRes = await apiFetch<LoginResponse>("/api/v1/auth/login", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });
  setToken(loginRes.access_token);
  return user;
}

export async function login(email: string, password: string): Promise<User> {
  const res = await apiFetch<LoginResponse>("/api/v1/auth/login", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });
  setToken(res.access_token);
  return me();
}

export async function me(): Promise<User> {
  return apiFetch<User>("/api/v1/auth/me");
}

export function logout(): void {
  clearToken();
}
