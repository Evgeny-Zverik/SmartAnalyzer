type Listener = (balance: number) => void;

const listeners = new Set<Listener>();
let lastBalance: number | null = null;

export function notifyCreditsChanged(balance: number): void {
  if (typeof balance !== "number" || !Number.isFinite(balance)) return;
  lastBalance = balance;
  listeners.forEach((listener) => {
    try {
      listener(balance);
    } catch {
      // ignore listener errors
    }
  });
}

export function getLatestCreditBalance(): number | null {
  return lastBalance;
}

export function onCreditsChanged(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
