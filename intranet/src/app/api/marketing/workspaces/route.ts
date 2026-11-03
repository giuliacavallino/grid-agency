import { after } from "next/server";
import { db } from "@/lib/server/db";
import { withMarketing } from "@/lib/server/social/auth";
import { runRequestedCanvaScans } from "@/lib/server/social/canva-ci";
import { workspaceFolder } from "@/lib/server/social/sharepoint";
import { createWorkspace, listAccounts, listPosts, listWorkspaces, processMediaImports, publicAccount } from "@/lib/server/social/store";

// Canva-Suchen laufen nach der Antwort im Hintergrund weiter
export const maxDuration = 300;

/** Kundenwelten mit verbundenen Kanälen und Zahl der geplanten Posts */
export const GET = withMarketing(async () => {
  // Dateien aus dem Eingang übernehmen (z. B. von Claude eingetragene Logos)
  await processMediaImports().catch((error) => console.error("Datei-Eingang", error));
  // Angeforderte Canva-Suchen im Hintergrund (Logos und Unterlagen je Kunde)
  after(() => runRequestedCanvaScans().catch((error) => console.error("Canva-Suche", error)));
  const [workspaces, accounts, scheduled] = await Promise.all([listWorkspaces(), listAccounts(), listPosts({ status: "scheduled", limit: 500 })]);
  return Response.json(
    workspaces.map((ws) => ({
      ...ws,
      accounts: accounts.filter((a) => a.workspace_id === ws.id).map(publicAccount),
      scheduled: scheduled.filter((p) => p.workspace_id === ws.id).length,
    }))
  );
});

/** Neue Kundenwelt (Onboarding): { name, color, secondary_color?, project_id? }.
 * Das Logo kommt danach über /api/marketing/workspaces/{id}/logo. */
export const POST = withMarketing(async (_actor, request) => {
  const body = (await request.json()) as { name?: string; color?: string; secondary_color?: string | null; project_id?: string | null };
  if (!body.name?.trim()) return Response.json({ error: "Name fehlt" }, { status: 400 });
  // Jede Kundenakte hat eine Aufgabenliste (To-dos, Briefing, Calls)
  const projectId = body.project_id ?? String((await db().insert("task_projects", { name: body.name.trim().slice(0, 120), color: body.color ?? "#afaaa0" })).id);
  const workspace = await createWorkspace({ name: body.name, color: body.color, secondary_color: body.secondary_color, project_id: projectId });
  // SharePoint-Ordner gleich mit anlegen (falls eingerichtet)
  after(() => workspaceFolder(workspace.id).then(() => undefined).catch((error) => console.error("SharePoint-Ordner", error)));
  return Response.json(workspace, { status: 201 });
});
