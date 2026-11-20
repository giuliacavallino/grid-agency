import { portalSession, portalView } from "@/lib/server/portal";

/** Daten des Kundenportals für die angemeldete Person (?ws= wählt die Kundenwelt) */
export async function GET(request: Request) {
  const email = await portalSession(request);
  if (!email) return Response.json({ error: "Nicht angemeldet" }, { status: 401 });
  const url = new URL(request.url);
  const view = await portalView(email, url.searchParams.get("ws"), url.origin);
  if (!view) return Response.json({ error: "Kein Zugang (mehr). Bitte bei GRID melden." }, { status: 403 });
  return Response.json(view, { headers: { "Cache-Control": "no-store" } });
}
