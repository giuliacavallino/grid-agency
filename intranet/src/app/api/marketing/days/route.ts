import type { DayKind } from "@/lib/marketing-days";
import { withMarketing } from "@/lib/server/social/auth";
import { addDay, listDays } from "@/lib/server/social/days";
import { getWorkspace } from "@/lib/server/social/store";

/** Tage einer Kundenwelt (?workspace=…&from=YYYY-MM-DD&to=YYYY-MM-DD):
 * allgemeine Feiertage/Aktionstage (passend zur Branche) und eigene Tage,
 * ohne ausgeblendete. Höchstens 400 Tage Zeitraum. */
export const GET = withMarketing(async (_actor, request) => {
  const params = new URL(request.url).searchParams;
  const workspace = params.get("workspace");
  const from = params.get("from");
  const to = params.get("to");
  if (!workspace || !from || !to) return Response.json({ error: "workspace, from und to angeben" }, { status: 400 });
  if (!(await getWorkspace(workspace))) return Response.json({ error: "Kundenwelt nicht gefunden" }, { status: 404 });
  if (new Date(to).getTime() - new Date(from).getTime() > 400 * 86_400_000) return Response.json({ error: "Zeitraum zu groß" }, { status: 400 });
  try {
    return Response.json(await listDays(workspace, from, to));
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Fehler" }, { status: 400 });
  }
});

/** Eigenen Tag anlegen: { workspace_id, date: "YYYY-MM-DD", title, note?, kind?: "kunde" | "branche" | "aktionstag" | "feiertag" } */
export const POST = withMarketing(async (actor, request) => {
  const body = (await request.json()) as { workspace_id?: string; date?: string; title?: string; note?: string; kind?: DayKind; region?: string | null };
  if (!body.workspace_id || !(await getWorkspace(body.workspace_id))) return Response.json({ error: "Kundenwelt nicht gefunden" }, { status: 404 });
  try {
    const day = await addDay({
      workspace_id: body.workspace_id,
      date: body.date ?? "",
      title: body.title ?? "",
      note: body.note,
      kind: body.kind,
      region: body.region,
      source: actor.kind === "agent" ? "agent" : "manuell",
    });
    return Response.json(day, { status: 201 });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Fehler" }, { status: 400 });
  }
});
