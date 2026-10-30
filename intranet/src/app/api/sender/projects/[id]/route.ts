import { withUser } from "@/lib/server/auth";
import { db } from "@/lib/server/db";

type Context = { params: Promise<{ id: string }> };

/** Teams-Chat und automatische Updates eines Kunden. Eigene Route statt der
 * allgemeinen Tabellen-API, damit nur Admins das ändern können. */
export const PATCH = withUser(async (_user, request, { params }: Context) => {
  const { id } = await params;
  const body = (await request.json()) as Record<string, unknown>;
  const patch: Record<string, unknown> = {};
  if ("teams_chat_id" in body) {
    patch.teams_chat_id = typeof body.teams_chat_id === "string" && body.teams_chat_id ? body.teams_chat_id : null;
    patch.teams_chat_title = patch.teams_chat_id && typeof body.teams_chat_title === "string" ? body.teams_chat_title.slice(0, 200) : null;
  }
  for (const key of ["weekly_update", "monthly_report"]) {
    if (typeof body[key] === "boolean") patch[key] = body[key];
  }
  if (!(await db().get("task_projects", id))) return Response.json({ error: "Kunde nicht gefunden" }, { status: 404 });
  return Response.json(await db().update("task_projects", id, patch));
}, ["admin"]);
