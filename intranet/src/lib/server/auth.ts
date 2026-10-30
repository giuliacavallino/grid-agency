import "server-only";
import { createRemoteJWKSet, jwtVerify } from "jose";
import { hasArea, type Member } from "@/lib/access";
import { CLIENT_ID, DEMO, TENANT_ID } from "@/lib/config";
import { getMember } from "./members";

const jwks = createRemoteJWKSet(
  new URL(`https://login.microsoftonline.com/${TENANT_ID}/discovery/v2.0/keys`)
);

/** Angemeldetes Konto mit seinen Rechten aus Admin → Benutzer & Rechte */
export type User = { email: string; name: string; admin: boolean; areas: string[]; member: Member };

type Token = { email: string; name: string };

export class AuthError extends Error {}

/** Prüft das Microsoft-ID-Token aus dem Authorization-Header: Signatur,
 * Aussteller (nur GRID-Tenant) und Zielgruppe (diese App). */
export async function requireUser(request: Request): Promise<Token> {
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

export const forbidden = () => Response.json({ error: "Kein Zugriff auf diesen Bereich" }, { status: 403 });

/** Führt einen API-Handler nur für freigeschaltete GRID-Konten aus (aktiv in
 * intranet_users); mit areas nur, wenn das Konto mindestens einen dieser
 * Bereiche sehen darf ("admin" = nur Admins). */
export function withUser<Args extends unknown[]>(
  handler: (user: User, request: Request, ...args: Args) => Promise<Response>,
  areas?: string[]
) {
  return async (request: Request, ...args: Args) => {
    let token: Token;
    try {
      token = await requireUser(request);
    } catch {
      return Response.json({ error: "Nicht angemeldet" }, { status: 401 });
    }
    let user: User;
    try {
      const member = await getMember(token.email);
      if (!member) return Response.json({ error: "Dein Konto ist für das Intranet noch nicht freigeschaltet." }, { status: 403 });
      user = { email: token.email, name: member.name || token.name, admin: member.role === "admin", areas: member.areas, member };
    } catch (error) {
      console.error(error);
      return Response.json({ error: "Rechte konnten nicht geladen werden" }, { status: 500 });
    }
    if (areas && !areas.some((area) => hasArea(user.member, area))) return forbidden();
    try {
      return await handler(user, request, ...args);
    } catch (error) {
      console.error(error);
      const message = error instanceof Error ? error.message : "Serverfehler";
      return Response.json({ error: message }, { status: 500 });
    }
  };
}
