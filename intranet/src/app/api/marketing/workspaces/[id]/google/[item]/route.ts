import { withMarketing } from "@/lib/server/social/auth";
import { deleteItem, googleFail as fail, kindOf, updateItem } from "@/lib/server/google";

type Context = { params: Promise<{ id: string; item: string }> };

/** ?kind=location|todo, Body: geänderte Felder; liefert den ganzen Stand */
export const PATCH = withMarketing(async (_actor, request, { params }: Context) => {
  const { id, item } = await params;
  const kind = kindOf(new URL(request.url).searchParams.get("kind"));
  if (!kind) return Response.json({ error: "kind fehlt (location oder todo)" }, { status: 400 });
  try {
    return Response.json(await updateItem(id, kind, item, (await request.json().catch(() => ({}))) as Record<string, unknown>));
  } catch (error) {
    return fail(error);
  }
});

/** ?kind=location|todo */
export const DELETE = withMarketing(async (_actor, request, { params }: Context) => {
  const { id, item } = await params;
  const kind = kindOf(new URL(request.url).searchParams.get("kind"));
  if (!kind) return Response.json({ error: "kind fehlt (location oder todo)" }, { status: 400 });
  return Response.json(await deleteItem(id, kind, item));
});
