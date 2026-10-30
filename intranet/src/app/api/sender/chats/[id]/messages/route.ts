import { withUser } from "@/lib/server/auth";
import { senderMessages } from "@/lib/server/sender";

type Context = { params: Promise<{ id: string }> };

/** Letzte Nachrichten im Kundenchat, um Antworten zu sehen */
export const GET = withUser(async (_user, _request, { params }: Context) => {
  const { id } = await params;
  return Response.json(await senderMessages(id));
}, ["admin"]);
