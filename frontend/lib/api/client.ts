import { getToken } from "@/lib/auth/token";

const configuredBaseURL =
  (typeof process !== "undefined" && process.env.NEXT_PUBLIC_API_BASE_URL) ||
  "http://localhost:8000";

function getBaseURL(): string {
  if (typeof window === "undefined") {
    return configuredBaseURL;
  }

  const currentHost = window.location.hostname;
  const isLocalHost = currentHost === "localhost" || currentHost === "127.0.0.1";

  try {
    const url = new URL(configuredBaseURL);
    const apiHost = url.hostname;
    const apiIsLocalHost = apiHost === "localhost" || apiHost === "127.0.0.1";

    // If the app is opened from another device, "localhost" must point to the machine
    // serving the frontend, not to the client device itself.
    if (!isLocalHost && apiIsLocalHost) {
      url.hostname = currentHost;
      return url.toString().replace(/\/$/, "");
    }

    return configuredBaseURL;
  } catch {
    return configuredBaseURL;
  }
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
  const url = new URL(path.startsWith("http") ? path : `${baseURL}${path}`);
  if (params) {
    Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
  }
  const token = getToken();
  const headers = new Headers(init.headers);
  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }
  if (!headers.has("Content-Type") && init.body && typeof init.body === "string") {
    headers.set("Content-Type", "application/json");
  }

  let res: Response;
  try {
    res = await fetch(url.toString(), { ...init, headers });
  } catch (err) {
    const shouldRetryWithIpv4 =
      typeof window !== "undefined" &&
      url.hostname === "localhost" &&
      (err instanceof TypeError || err instanceof Error);

    if (!shouldRetryWithIpv4) {
      throw err;
    }

    const fallbackUrl = new URL(url.toString());
    fallbackUrl.hostname = "127.0.0.1";
    res = await fetch(fallbackUrl.toString(), { ...init, headers });
  }

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
    const apiErr = new ApiError(res.status, err.error, message, err.details ?? err.detail);
    if (apiErr.code === "ACCOUNT_BLOCKED" && typeof window !== "undefined") {
      handleAccountBlocked(apiErr.message);
    }
    throw apiErr;
  }
  return data;
}

let __accountBlockedShown = false;
function handleAccountBlocked(message: string): void {
  if (__accountBlockedShown) return;
  __accountBlockedShown = true;
  try {
    import("@/lib/auth/token").then(({ clearToken }) => clearToken());
  } catch {}
  window.alert(message || "Ваш аккаунт ограничен, напишите в поддержку");
  setTimeout(() => {
    __accountBlockedShown = false;
    if (!window.location.pathname.startsWith("/login")) {
      window.location.href = "/login";
    }
  }, 0);
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
