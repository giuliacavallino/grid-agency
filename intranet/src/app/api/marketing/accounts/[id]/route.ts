import { withMarketing } from "@/lib/server/social/auth";
import { deleteAccount, getAccount, publicAccount, updateAccountMeta } from "@/lib/server/social/store";

type Context = { params: Promise<{ id: string }> };

/** Kanal trennen (nur Menschen, nicht der Agent) */
export const DELETE = withMarketing(
  async (_actor, _request, { params }: Context) => {
    const { id } = await params;
    if (!(await getAccount(id))) return Response.json({ error: "Nicht gefunden" }, { status: 404 });
    await deleteAccount(id);
    return new Response(null, { status: 204 });
  },
  { agent: false }
);

/** Einstellungen ändern: { auto_reply: boolean } (Autopilot für Kommentare, nur Team) */
export const PATCH = withMarketing(
  async (_actor, request, { params }: Context) => {
    const { id } = await params;
    const account = await getAccount(id);
    if (!account) return Response.json({ error: "Nicht gefunden" }, { status: 404 });
    const body = (await request.json().catch(() => ({}))) as { auto_reply?: boolean };
    if (typeof body.auto_reply !== "boolean") return Response.json({ error: "auto_reply fehlt" }, { status: 400 });
    await updateAccountMeta(id, { auto_reply: body.auto_reply });
    return Response.json(publicAccount((await getAccount(id))!));
  },
  { agent: false }
);
