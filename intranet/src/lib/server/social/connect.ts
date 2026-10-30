import "server-only";
import { DEMO } from "@/lib/config";
import type { ConnectProvider } from "@/lib/marketing";
import { vaultStatus } from "../vault";
import { canvaAuthorizeUrl, canvaConfigured, finishCanva } from "./canva";
import { finishLinkedin, linkedinAuthorizeUrl, linkedinConfigured } from "./linkedin";
import { finishMeta, metaAuthorizeUrl, metaConfigured } from "./meta";
import { pkce, randomState } from "./oauth";
import { agencyWorkspace, getWorkspace, saveAccount, saveState, takeState } from "./store";
import { finishTiktok, tiktokAuthorizeUrl, tiktokConfigured } from "./tiktok";

// Verbinden eines Kanals: Start (Login-URL des Anbieters) und Rückkehr.

/** Parameter an einen relativen Pfad hängen */
export function withParam(path: string, key: string, value: string) {
  const url = new URL(path, "http://x");
  url.searchParams.set(key, value);
  return `${url.pathname}${url.search}`;
}

/** Welche Anbieter in Vercel eingerichtet sind (nur ob, nie Werte) */
export const configured = (): Record<ConnectProvider, boolean> => ({
  canva: canvaConfigured(),
  meta: DEMO || metaConfigured(),
  linkedin: DEMO || linkedinConfigured(),
  tiktok: DEMO || tiktokConfigured(),
});

export const ENV_NAMES: Record<ConnectProvider, string> = {
  canva: "CANVA_CLIENT_ID / CANVA_CLIENT_SECRET",
  meta: "META_APP_ID / META_APP_SECRET",
  linkedin: "LINKEDIN_CM_CLIENT_ID / LINKEDIN_CM_CLIENT_SECRET",
  tiktok: "TIKTOK_CLIENT_KEY / TIKTOK_CLIENT_SECRET",
};

/** Liefert die Adresse, an die der Browser zum Anmelden geht. returnPath:
 * wohin nach dem Login (Standard: Marketing Hub; Kunden-Links: ihre Seite) */
export async function startConnect(provider: ConnectProvider, workspaceId: string | null, origin: string, by: string, returnPath: string | null = null) {
  if (!configured()[provider]) throw new Error(`${ENV_NAMES[provider]} fehlen in Vercel`);
  if (vaultStatus() !== "ok") throw new Error("VAULT_KEY fehlt, Zugänge können nicht verschlüsselt gespeichert werden");
  // Canva gehört GRID, alle anderen Kanäle einer Kundenwelt
  const workspace = provider === "canva" ? await agencyWorkspace() : workspaceId ? await getWorkspace(workspaceId) : null;
  if (!workspace) throw new Error("Kundenwelt nicht gefunden");
  const back = returnPath ?? (provider === "canva" ? "/marketing" : `/marketing/kanaele?welt=${workspace.id}`);

  if (DEMO) {
    await saveAccount({
      workspace_id: workspace.id,
      provider: provider === "meta" ? "instagram" : provider,
      external_id: `demo-${provider}`,
      name: `${workspace.name} (Vorschau)`,
      handle: provider === "meta" || provider === "tiktok" ? `@${workspace.name.toLowerCase().replace(/[^a-z0-9]+/g, "")}` : null,
      connected_by: by,
    });
    return withParam(back, "connected", provider);
  }

  const state = randomState();
  const { verifier, challenge } = pkce();
  await saveState(state, { provider, workspace_id: workspace.id, verifier: provider === "canva" ? verifier : null, created_by: by, return_path: back });
  if (provider === "canva") return canvaAuthorizeUrl(origin, state, challenge);
  if (provider === "meta") return metaAuthorizeUrl(origin, state);
  if (provider === "linkedin") return linkedinAuthorizeUrl(origin, state);
  return tiktokAuthorizeUrl(origin, state);
}

/** State zuerst einlösen, damit auch Fehler auf die richtige Seite zurückführen */
export const redeemState = takeState;

/** Rückkehr vom Anbieter; liefert die Kundenwelt für die Weiterleitung */
export async function finishConnect(provider: ConnectProvider, code: string, saved: Awaited<ReturnType<typeof takeState>>, origin: string) {
  if (!saved || !saved.workspace_id) throw new Error("Anmeldung abgelaufen, bitte neu verbinden");
  const { workspace_id: workspaceId, created_by: by } = saved;
  if (provider === "canva") await finishCanva(code, saved.verifier ?? "", origin, by);
  else if (provider === "meta") await finishMeta(code, origin, workspaceId, by);
  else if (provider === "linkedin") await finishLinkedin(code, origin, workspaceId, by);
  else await finishTiktok(code, origin, workspaceId, by);
  return workspaceId;
}
