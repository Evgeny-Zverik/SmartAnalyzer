import { apiFetch } from "@/lib/api/client";
import { clearToken, setToken } from "@/lib/auth/token";
import { clearTransportKey, setTransportKey } from "@/lib/crypto";
import { clearDocumentAnalyzerEncryptionCache } from "@/lib/features/documentAnalyzerEncryption";

export type User = {
  id: number;
  email: string;
  created_at: string;
  plan: string;
};

type LoginResponse = {
  access_token: string;
  token_type: string;
  transport_key?: string;
};

type MeResponse = User & { transport_key?: string };

export async function register(email: string, password: string): Promise<User> {
  clearDocumentAnalyzerEncryptionCache();
  const user = await apiFetch<User>("/api/v1/auth/register", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });
  const loginRes = await apiFetch<LoginResponse>("/api/v1/auth/login", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });
  setToken(loginRes.access_token);
  if (loginRes.transport_key) setTransportKey(loginRes.transport_key);
  return user;
}

export async function login(email: string, password: string): Promise<User> {
  clearDocumentAnalyzerEncryptionCache();
  const res = await apiFetch<LoginResponse>("/api/v1/auth/login", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });
  setToken(res.access_token);
  if (res.transport_key) setTransportKey(res.transport_key);
  return me();
}

export async function me(): Promise<User> {
  const res = await apiFetch<MeResponse>("/api/v1/auth/me");
  if (res.transport_key) setTransportKey(res.transport_key);
  return res;
}

export function logout(): void {
  clearToken();
  clearTransportKey();
  clearDocumentAnalyzerEncryptionCache();
}
