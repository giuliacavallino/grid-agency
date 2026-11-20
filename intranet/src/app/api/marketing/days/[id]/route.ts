import { withMarketing } from "@/lib/server/social/auth";
import { getDay, removeDay, updateDay, type DayPatch } from "@/lib/server/social/days";

type Context = { params: Promise<{ id: string }> };

/** Tag ändern: { status?, title?, note?, date?, kind? }. Allgemeine Tage
 * (workspace_id null) nur mit { status: "ausgeblendet" | "aktiv", workspace_id }:
 * blendet sie für diese Kundenwelt aus bzw. wieder ein. */
export const PATCH = withMarketing(async (_actor, request, { params }: Context) => {
  const id = (await params).id;
  if (!(await getDay(id))) return Response.json({ error: "Nicht gefunden" }, { status: 404 });
  const { workspace_id, ...body } = (await request.json()) as DayPatch & { workspace_id?: string };
  const patch: DayPatch = {};
  for (const key of ["status", "title", "note", "date", "kind"] as const) if (body[key] !== undefined) Object.assign(patch, { [key]: body[key] });
  try {
    return Response.json(await updateDay(id, patch, workspace_id));
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Fehler" }, { status: 400 });
  }
});

/** Eigenen Tag löschen; allgemeine Tage lassen sich nur ausblenden */
export const DELETE = withMarketing(async (_actor, _request, { params }: Context) => {
  const day = await getDay((await params).id);
  if (!day) return Response.json({ error: "Nicht gefunden" }, { status: 404 });
  if (day.workspace_id === null) return Response.json({ error: "Allgemeine Tage lassen sich nur je Kunde ausblenden" }, { status: 400 });
  await removeDay(day.id);
  return new Response(null, { status: 204 });
});
