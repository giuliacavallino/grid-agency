import { withMarketing } from "@/lib/server/social/auth";
import { getWorkspace } from "@/lib/server/social/store";
import { addPortalUser, listPortalUsers, PortalError, removePortalUser, requestLogin } from "@/lib/server/portal";

type Context = { params: Promise<{ id: string }> };

const fail = (error: unknown) => {
  if (error instanceof PortalError) return Response.json({ error: error.message }, { status: 400 });
  throw error;
};

/** Freigeschaltete Personen fürs Kundenportal */
export const GET = withMarketing(async (_actor, _request, { params }: Context) => {
  const { id } = await params;
  if (!(await getWorkspace(id))) return Response.json({ error: "Kundenwelt nicht gefunden" }, { status: 404 });
  return Response.json(await listPortalUsers(id));
});

/** { email, name?, invite? } freischalten (und optional Einladung schicken) bzw. { invite: email } erneut einladen */
export const POST = withMarketing(
  async (actor, request, { params }: Context) => {
    const { id } = await params;
    const workspace = await getWorkspace(id);
    if (!workspace) return Response.json({ error: "Kundenwelt nicht gefunden" }, { status: 404 });
    const body = (await request.json().catch(() => ({}))) as { email?: string; name?: string; invite?: boolean };
    try {
      const users = await addPortalUser(id, { email: String(body.email ?? ""), name: body.name }, actor.email);
      if (body.invite) await requestLogin(String(body.email), new URL(request.url).origin, { by: actor.email, workspace: workspace.name });
      return Response.json(body.invite ? await listPortalUsers(id) : users);
    } catch (error) {
      return fail(error);
    }
  },
  { agent: false }
);

/** ?user= entfernen */
export const DELETE = withMarketing(
  async (_actor, request, { params }: Context) => {
    const { id } = await params;
    const user = new URL(request.url).searchParams.get("user");
    if (!user) return Response.json({ error: "user fehlt" }, { status: 400 });
    return Response.json(await removePortalUser(id, user));
  },
  { agent: false }
);
