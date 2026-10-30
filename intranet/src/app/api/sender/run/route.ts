import { withUser } from "@/lib/server/auth";
import { runUpdate, type UpdateKind } from "@/lib/server/updates";

export const maxDuration = 120;

/** Update von Hand: Vorschau schreiben oder verschicken (mit text: genau
 * diesen Text, sonst schreibt Claude neu) */
export const POST = withUser(async (user, request) => {
  const { project_id, kind, send, text } = (await request.json()) as { project_id?: string; kind?: UpdateKind; send?: boolean; text?: string };
  if (!project_id || (kind !== "weekly" && kind !== "monthly")) return Response.json({ error: "Kunde oder Art fehlt" }, { status: 400 });
  return Response.json(await runUpdate(project_id, kind, { send: send === true, by: user.email, text: typeof text === "string" ? text : undefined }));
}, ["admin"]);
