function normalizeReturnTo(value: string | null | undefined): string | null {
  if (!value) return null;
  if (!value.startsWith("/") || value.startsWith("//")) return null;
  if (value.startsWith("/login") || value.startsWith("/register")) return null;
  return value;
}

export function getSafeReturnTo(value: string | null | undefined): string | null {
  return normalizeReturnTo(value);
}

export function getCurrentLocationReturnTo(): string | null {
  if (typeof window === "undefined") return null;
  const { pathname, search, hash } = window.location;
  return normalizeReturnTo(`${pathname}${search}${hash}`);
}

export function buildLoginRedirectHref(returnTo?: string | null): string {
  const target = normalizeReturnTo(returnTo ?? getCurrentLocationReturnTo());
  return target ? `/login?returnTo=${encodeURIComponent(target)}` : "/login";
}
