import { ApiError } from "@/lib/api/client";

export type ParsedApiError = {
  status: number;
  error: string;
  message: string;
  details: unknown;
};

export function parseApiError(respOrError: unknown): ParsedApiError {
  if (respOrError instanceof ApiError) {
    return {
      status: respOrError.status,
      error: respOrError.code ?? "ERROR",
      message: respOrError.message ?? "Ошибка запроса",
      details: respOrError.details,
    };
  }
  if (respOrError instanceof Error) {
    return {
      status: 0,
      error: "UNKNOWN",
      message: respOrError.message,
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
    return err.status === 429 || err.code === "LIMIT_REACHED";
  }
  return false;
}
