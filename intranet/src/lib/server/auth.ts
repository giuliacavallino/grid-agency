import "server-only";
import { createRemoteJWKSet, jwtVerify } from "jose";
import { CLIENT_ID, DEMO, TENANT_ID } from "@/lib/config";

const jwks = createRemoteJWKSet(
  new URL(`https://login.microsoftonline.com/${TENANT_ID}/discovery/v2.0/keys`)
);

export type User = { email: string; name: string };

export class AuthError extends Error {}

/** Prüft das Microsoft-ID-Token aus dem Authorization-Header: Signatur,
 * Aussteller (nur GRID-Tenant) und Zielgruppe (diese App). */
export async function requireUser(request: Request): Promise<User> {
  if (DEMO) return { email: "vorschau@grid-agency.de", name: "Vorschau Konto" };

  const header = request.headers.get("authorization") ?? "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : null;
  if (!token) throw new AuthError("Kein Token");

  try {
    const { payload } = await jwtVerify(token, jwks, {
      issuer: `https://login.microsoftonline.com/${TENANT_ID}/v2.0`,
      audience: CLIENT_ID,
    });
    if (payload.tid !== TENANT_ID) throw new AuthError("Falscher Tenant");
    const email = String(payload.preferred_username ?? payload.email ?? "").toLowerCase();
    return { email, name: String(payload.name ?? email) };
  } catch {
    throw new AuthError("Token ungültig");
  }
}

/** Führt einen API-Handler nur für angemeldete GRID-Konten aus. */
export function withUser<Args extends unknown[]>(
  handler: (user: User, request: Request, ...args: Args) => Promise<Response>
) {
  return async (request: Request, ...args: Args) => {
    let user: User;
    try {
      user = await requireUser(request);
    } catch {
      return Response.json({ error: "Nicht angemeldet" }, { status: 401 });
    }
    try {
      return await handler(user, request, ...args);
    } catch (error) {
      console.error(error);
      const message = error instanceof Error ? error.message : "Serverfehler";
      return Response.json({ error: message }, { status: 500 });
    }
  };
}
