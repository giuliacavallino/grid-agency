import { withUser } from "@/lib/server/auth";
import { avatarFromInstagram, removeAvatar, uploadAvatar } from "@/lib/server/avatars";

type Context = { params: Promise<{ id: string }> };
const AREAS = ["aufgaben", "admin"];
const fail = (error: unknown) => Response.json({ error: error instanceof Error ? error.message : "Fehler" }, { status: 400 });

/** Bild hochladen (multipart „file“) oder von Instagram holen ({ instagram }) */
export const POST = withUser(async (_user, request, { params }: Context) => {
  const { id } = await params;
  try {
    if ((request.headers.get("content-type") ?? "").startsWith("multipart/form-data")) {
      const file = (await request.formData()).get("file");
      if (!(file instanceof File)) return Response.json({ error: "Datei fehlt" }, { status: 400 });
      await uploadAvatar(id, file);
    } else {
      const { instagram } = (await request.json().catch(() => ({}))) as { instagram?: string };
      await avatarFromInstagram(id, instagram);
    }
    return Response.json({ ok: true });
  } catch (error) {
    return fail(error);
  }
}, AREAS);

export const DELETE = withUser(async (_user, _request, { params }: Context) => {
  const { id } = await params;
  try {
    await removeAvatar(id);
    return new Response(null, { status: 204 });
  } catch (error) {
    return fail(error);
  }
}, AREAS);
