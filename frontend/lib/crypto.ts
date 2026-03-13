/**
 * Client-side AES-256-GCM encryption for transport security.
 *
 * The transport key is fetched from the backend once per session and stored in
 * memory only (never persisted to disk/localStorage).  All sensitive payloads
 * are encrypted before leaving the browser and decrypted on arrival.
 *
 * Uses the native Web Crypto API — no external dependencies required.
 */

let _transportKey: CryptoKey | null = null;
let _transportKeyRaw: string | null = null;

// ---------------------------------------------------------------------------
// Key management
// ---------------------------------------------------------------------------

export function setTransportKey(base64Key: string): void {
  _transportKeyRaw = base64Key;
  _transportKey = null; // will be lazily imported
}

export function hasTransportKey(): boolean {
  return _transportKeyRaw !== null;
}

export function clearTransportKey(): void {
  _transportKey = null;
  _transportKeyRaw = null;
}

async function getKey(): Promise<CryptoKey | null> {
  if (_transportKey) return _transportKey;
  if (!_transportKeyRaw) return null;

  const raw = Uint8Array.from(atob(_transportKeyRaw), (c) => c.charCodeAt(0));
  _transportKey = await crypto.subtle.importKey(
    "raw",
    raw,
    { name: "AES-GCM" },
    false,
    ["encrypt", "decrypt"]
  );
  return _transportKey;
}

// ---------------------------------------------------------------------------
// Binary encrypt / decrypt  (for file uploads)
// ---------------------------------------------------------------------------

export async function encryptBytes(data: ArrayBuffer): Promise<ArrayBuffer> {
  const key = await getKey();
  if (!key) return data;

  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, data);

  // Format: iv (12) + ciphertext+tag
  const out = new Uint8Array(iv.byteLength + ct.byteLength);
  out.set(iv, 0);
  out.set(new Uint8Array(ct), iv.byteLength);
  return out.buffer;
}

export async function decryptBytes(data: ArrayBuffer): Promise<ArrayBuffer> {
  const key = await getKey();
  if (!key) return data;
  if (data.byteLength < 28) return data; // too short to be encrypted

  const arr = new Uint8Array(data);
  const iv = arr.slice(0, 12);
  const ct = arr.slice(12);

  try {
    return await crypto.subtle.decrypt({ name: "AES-GCM", iv }, key, ct);
  } catch {
    // Likely unencrypted data — return as-is
    return data;
  }
}

// ---------------------------------------------------------------------------
// String encrypt / decrypt  (for JSON payloads)
// ---------------------------------------------------------------------------

export async function encryptString(value: string): Promise<string> {
  const key = await getKey();
  if (!key) return value;

  const encoded = new TextEncoder().encode(value);
  const encrypted = await encryptBytes(encoded.buffer);
  return "tenc:" + arrayBufferToBase64(encrypted);
}

export async function decryptString(value: string): Promise<string> {
  if (!value.startsWith("tenc:")) return value;
  const key = await getKey();
  if (!key) return value;

  try {
    const encrypted = base64ToArrayBuffer(value.slice(5));
    const decrypted = await decryptBytes(encrypted);
    return new TextDecoder().decode(decrypted);
  } catch {
    return value;
  }
}

// ---------------------------------------------------------------------------
// JSON payload helpers
// ---------------------------------------------------------------------------

export async function encryptPayload(obj: unknown): Promise<string> {
  const json = JSON.stringify(obj);
  return encryptString(json);
}

export async function decryptPayload<T = unknown>(value: string): Promise<T> {
  const json = await decryptString(value);
  return JSON.parse(json) as T;
}

// ---------------------------------------------------------------------------
// Utilities
// ---------------------------------------------------------------------------

function arrayBufferToBase64(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf);
  let binary = "";
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

function base64ToArrayBuffer(b64: string): ArrayBuffer {
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer;
}
