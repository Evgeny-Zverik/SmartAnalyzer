import { ApiError } from "@/lib/api/client";

export type ParsedApiError = {
  status: number;
  error: string;
  message: string;
  details: unknown;
};

function getDetailMessage(details: unknown): string | null {
  if (!details || typeof details !== "object") return null;
  const detail = (details as { detail?: unknown }).detail;
  if (typeof detail === "string" && detail.trim()) {
    return detail.trim();
  }
  return null;
}

const NETWORK_ERROR_MESSAGES = [
  "load failed",
  "failed to fetch",
  "network request failed",
  "networkerror",
];

function isNetworkError(message: string): boolean {
  const normalized = message.toLowerCase().trim();
  return NETWORK_ERROR_MESSAGES.some((m) => normalized.includes(m));
}

export function parseApiError(respOrError: unknown): ParsedApiError {
  if (respOrError instanceof ApiError) {
    const detailMessage = getDetailMessage(respOrError.details);
    return {
      status: respOrError.status,
      error: respOrError.code ?? "ERROR",
      message: respOrError.message ?? detailMessage ?? "Ошибка запроса",
      details: respOrError.details,
    };
  }
  if (respOrError instanceof Error) {
    const msg =
      respOrError.message && isNetworkError(respOrError.message)
        ? "Не удалось подключиться к серверу. Проверьте, что бэкенд запущен (порт 8000) и вы авторизованы."
        : respOrError.message;
    return {
      status: 0,
      error: "NETWORK",
      message: msg,
      details: {},
    };
  }
  return {
    status: 0,
    error: "UNKNOWN",
    message: "Неизвестная ошибка",
    details: {},
  };
}

export function isUnauthorized(err: unknown): boolean {
  if (err instanceof ApiError) {
    return err.status === 401 || err.code === "UNAUTHORIZED";
  }
  return false;
}

export function isLimitReached(err: unknown): boolean {
  if (err instanceof ApiError) {
    return err.status === 429 || err.code === "LIMIT_REACHED" || err.code === "INSUFFICIENT_CREDITS";
  }
  return false;
}
