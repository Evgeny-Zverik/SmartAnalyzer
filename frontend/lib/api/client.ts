import { getToken } from "@/lib/auth/token";

const configuredBaseURL =
  (typeof process !== "undefined" && process.env.NEXT_PUBLIC_API_BASE_URL) ||
  "http://localhost:8000";

function getBaseURL(): string {
  if (typeof window === "undefined") {
    return configuredBaseURL;
  }

  // Use relative URL so Next.js rewrites proxy to the backend.
  // This allows the preview browser (and any remote client) to reach the API
  // without needing direct access to localhost:8000.
  return "";
}

export type ApiFetchOptions = RequestInit & {
  params?: Record<string, string>;
};

export async function apiFetch<T = unknown>(
  path: string,
  options: ApiFetchOptions = {}
): Promise<T> {
  const { params, ...init } = options;
  const baseURL = getBaseURL();
  const fullPath = path.startsWith("http") ? path : `${baseURL}${path}`;
  let fetchUrl: string;
  if (params && Object.keys(params).length > 0) {
    const url = new URL(fullPath, typeof window !== "undefined" ? window.location.origin : undefined);
    Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
    fetchUrl = url.toString();
  } else {
    fetchUrl = fullPath;
  }
  const token = getToken();
  const headers = new Headers(init.headers);
  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }
  if (!headers.has("Content-Type") && init.body && typeof init.body === "string") {
    headers.set("Content-Type", "application/json");
  }

  const res = await fetch(fetchUrl, { ...init, headers });

  const text = await res.text();
  let data: T;
  try {
    data = text ? (JSON.parse(text) as T) : ({} as T);
  } catch {
    throw new Error(res.ok ? text : `Request failed: ${res.status}`);
  }
  if (!res.ok) {
    const err = data as {
      error?: string;
      message?: string;
      detail?: string | unknown;
      details?: unknown;
    };
    const message =
      err.message ??
      (typeof err.detail === "string" ? err.detail : undefined) ??
      `API error ${res.status}`;
    throw new ApiError(res.status, err.error, message, err.details ?? err.detail);
  }
  return data;
}

export class ApiError extends Error {
  constructor(
    public status: number,
    public code?: string,
    message?: string,
    public details?: unknown
  ) {
    super(message ?? `API error ${status}`);
    this.name = "ApiError";
  }
}
