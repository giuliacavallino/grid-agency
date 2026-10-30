import { DEMO } from "@/lib/config";
import { withUser } from "@/lib/server/auth";
import { db, sb } from "@/lib/server/db";

// Vorgeschlagene Aufgabe aus einem Call übernehmen (wird ein normales To-do
// im gewählten Kundenprojekt) oder verwerfen.

type Context = { params: Promise<{ id: string }> };
type Body = { action?: "uebernehmen" | "verwerfen"; project_id?: string; title?: string; notes?: string; due_on?: string | null };

export const POST = withUser(async (user, request, { params }: Context) => {
  const { id } = await params;
  const body = (await request.json().catch(() => ({}))) as Body;
  const proposal = await db().get("meeting_tasks", id);
  if (!proposal) return Response.json({ error: "Vorschlag nicht gefunden" }, { status: 404 });
  if (proposal.status !== "vorschlag") return Response.json({ error: "Schon erledigt" }, { status: 409 });
  const decided = { decided_by: user.name, decided_at: new Date().toISOString() };

  if (body.action === "verwerfen") {
    return Response.json(await db().update("meeting_tasks", id, { status: "verworfen", ...decided }));
  }
  if (body.action !== "uebernehmen") return Response.json({ error: "Unbekannte Aktion" }, { status: 400 });

  const projectId = body.project_id ?? (proposal.project_id as string | null);
  if (!projectId || !(await db().get("task_projects", projectId))) return Response.json({ error: "Bitte einen Kunden wählen" }, { status: 400 });
  const title = (body.title ?? String(proposal.title)).trim().slice(0, 200);
  if (!title) return Response.json({ error: "Titel fehlt" }, { status: 400 });

  // Erst den Vorschlag sperren, damit ein Doppelklick kein zweites To-do anlegt
  const claim = { status: "uebernommen", project_id: projectId, ...decided };
  if (DEMO) await db().update("meeting_tasks", id, claim);
  else {
    const { data: claimed } = await sb().from("meeting_tasks").update(claim).eq("id", id).eq("status", "vorschlag").select("id").maybeSingle();
    if (!claimed) return Response.json({ error: "Schon erledigt" }, { status: 409 });
  }
  const task = await db().insert("tasks", {
    project_id: projectId,
    title,
    notes: (body.notes ?? (proposal.notes as string | null)) || null,
    due_on: body.due_on !== undefined ? body.due_on : proposal.due_on,
    meeting_task_id: id,
  });
  return Response.json(await db().update("meeting_tasks", id, { task_id: task.id, title }));
}, ["aufgaben"]);
