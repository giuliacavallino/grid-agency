import { withUser } from "@/lib/server/auth";
import { disconnect } from "@/lib/server/bank";

type Context = { params: Promise<{ id: string }> };

/** Konto trennen (Freigabe beenden). Umsätze und Zuordnungen bleiben. */
export const DELETE = withUser(async (_user, _request, { params }: Context) => {
  const { id } = await params;
  return Response.json(await disconnect(id));
}, ["admin"]);
