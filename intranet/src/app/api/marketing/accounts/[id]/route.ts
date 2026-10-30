import { withMarketing } from "@/lib/server/social/auth";
import { deleteAccount, getAccount } from "@/lib/server/social/store";

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
