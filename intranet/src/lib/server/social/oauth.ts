import "server-only";
import { createHash, randomBytes } from "node:crypto";
import type { ConnectProvider } from "@/lib/marketing";

/** Rücksprung-Adresse je Anbieter; muss in der jeweiligen Entwickler-App eingetragen sein */
export const callbackUrl = (provider: ConnectProvider, origin: string) =>
  `${process.env.INTRANET_URL ?? origin}/api/social/callback/${provider}`;

export const randomState = () => randomBytes(24).toString("base64url");

/** PKCE (S256): Verifier und Challenge */
export function pkce() {
  const verifier = randomBytes(48).toString("base64url");
  const challenge = createHash("sha256").update(verifier).digest("base64url");
  return { verifier, challenge };
}

export const inSeconds = (seconds: number | undefined | null) =>
  seconds ? new Date(Date.now() + seconds * 1000).toISOString() : null;

/** JSON-Antwort lesen; bei Fehlern die Meldung des Anbieters weitergeben */
export async function readJson<T>(response: Response, label: string): Promise<T> {
  const text = await response.text();
  let data: unknown = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = null;
  }
  if (!response.ok) {
    const body = data as { error?: { message?: string } | string; error_description?: string; message?: string } | null;
    const message =
      (typeof body?.error === "object" ? body.error?.message : undefined) ??
      body?.error_description ??
      body?.message ??
      (typeof body?.error === "string" ? body.error : undefined) ??
      text.slice(0, 200);
    throw new Error(`${label}: ${message || response.status}`);
  }
  return data as T;
}

/** Nach Ablauf erneuern? (5 Minuten Puffer) */
export const expiresSoon = (expiresAt: string | null) => !!expiresAt && new Date(expiresAt).getTime() < Date.now() + 5 * 60_000;
