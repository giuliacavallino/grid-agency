import { withMarketing } from "@/lib/server/social/auth";
import { suggestDays } from "@/lib/server/social/days";
import { getWorkspace } from "@/lib/server/social/store";

// Recherche mit Websuche und zwei Claude-Schritten dauert 1–3 Minuten
export const maxDuration = 300;

/** KI-Vorschläge: { workspace_id }. Claude sucht passende Tage für die nächsten
 * 12 Monate (Branche, Standort, lokale Events) und liefert die neuen Zeilen
 * (status "vorschlag", source "ki"); Dubletten werden übersprungen. */
export const POST = withMarketing(async (_actor, request) => {
  const body = (await request.json()) as { workspace_id?: string };
  if (!body.workspace_id || !(await getWorkspace(body.workspace_id))) return Response.json({ error: "Kundenwelt nicht gefunden" }, { status: 404 });
  return Response.json(await suggestDays(body.workspace_id), { status: 201 });
});
