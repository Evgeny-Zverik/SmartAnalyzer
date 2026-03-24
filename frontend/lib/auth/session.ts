const REAUTH_REQUIRED_EVENT = "smartanalyzer_reauth_required";

type ReauthRequiredDetail = {
  reason?: string;
};

let reauthPending = false;

export function requestReauth(detail: ReauthRequiredDetail = {}): void {
  if (typeof window === "undefined" || reauthPending) return;
  reauthPending = true;
  window.dispatchEvent(new CustomEvent<ReauthRequiredDetail>(REAUTH_REQUIRED_EVENT, { detail }));
}

export function clearReauthRequest(): void {
  reauthPending = false;
}

export function onReauthRequired(callback: (detail: ReauthRequiredDetail) => void): () => void {
  if (typeof window === "undefined") return () => {};
  const handler = (event: Event) => {
    const detail = event instanceof CustomEvent ? (event.detail as ReauthRequiredDetail) : {};
    callback(detail);
  };
  window.addEventListener(REAUTH_REQUIRED_EVENT, handler);
  return () => window.removeEventListener(REAUTH_REQUIRED_EVENT, handler);
}
