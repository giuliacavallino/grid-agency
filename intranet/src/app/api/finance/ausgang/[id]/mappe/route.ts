import { withUser } from "@/lib/server/auth";
import { createEnvelope, listEnvelopes, previewBundle, SignError, type CreateInput } from "@/lib/server/sign";

type Context = { params: Promise<{ id: string }> };

export const maxDuration = 60;

/** Unterschriftsmappen zu einem Angebot */
export const GET = withUser(async (_user, _request, { params }: Context) => {
  const { id } = await params;
  return Response.json(await listEnvelopes(id));
}, ["finance"]);

/** Neue Mappe (GRID hat unterschrieben) oder ?vorschau=1 als PDF (base64) */
export const POST = withUser(async (user, request, { params }: Context) => {
  const { id } = await params;
  const input = (await request.json()) as CreateInput;
  try {
    if (new URL(request.url).searchParams.get("vorschau")) {
      return Response.json({ data: (await previewBundle(id, input)).toString("base64") });
    }
    return Response.json(await createEnvelope(id, input, user), { status: 201 });
  } catch (error) {
    if (error instanceof SignError) return Response.json({ error: error.message }, { status: 400 });
    throw error;
  }
}, ["finance"]);
