import { withMarketing } from "@/lib/server/social/auth";
import { workspaceFolder } from "@/lib/server/social/sharepoint";
import { getWorkspace, updateWorkspace, type BrandInput } from "@/lib/server/social/store";

type Context = { params: Promise<{ id: string }> };

/** CI der Kundenwelt ändern: { name?, color?, secondary_color?, logo_path? } */
export const PATCH = withMarketing(async (_actor, request, { params }: Context) => {
  const { id } = await params;
  if (!(await getWorkspace(id))) return Response.json({ error: "Kundenwelt nicht gefunden" }, { status: 404 });
  return Response.json(await updateWorkspace(id, (await request.json().catch(() => ({}))) as BrandInput));
});

/** SharePoint-Ordner der Kundenwelt anlegen (falls noch nicht da) und Adresse liefern */
export const POST = withMarketing(async (_actor, _request, { params }: Context) => {
  const { id } = await params;
  if (!(await getWorkspace(id))) return Response.json({ error: "Kundenwelt nicht gefunden" }, { status: 404 });
  const folder = await workspaceFolder(id);
  if (!folder) return Response.json({ error: "SharePoint ist noch nicht eingerichtet (SHAREPOINT_SITE)" }, { status: 503 });
  return Response.json({ url: folder.webUrl });
});
