import { after } from "next/server";
import { withMarketing } from "@/lib/server/social/auth";
import { workspaceFolder } from "@/lib/server/social/sharepoint";
import { createWorkspace, listAccounts, listPosts, listWorkspaces, publicAccount } from "@/lib/server/social/store";

/** Kundenwelten mit verbundenen Kanälen und Zahl der geplanten Posts */
export const GET = withMarketing(async () => {
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
  const workspace = await createWorkspace({ name: body.name, color: body.color, secondary_color: body.secondary_color, project_id: body.project_id ?? null });
  // SharePoint-Ordner gleich mit anlegen (falls eingerichtet)
  after(() => workspaceFolder(workspace.id).then(() => undefined).catch((error) => console.error("SharePoint-Ordner", error)));
  return Response.json(workspace, { status: 201 });
});
