import { withMarketing } from "@/lib/server/social/auth";
import { storeMedia } from "@/lib/server/social/media";
import { getWorkspace, updateWorkspaceSettings } from "@/lib/server/social/store";

type Context = { params: Promise<{ id: string }> };
// Kein SVG: Bilder werden öffentlich ausgeliefert, SVG könnte Skripte enthalten
const ALLOWED = ["image/png", "image/jpeg", "image/webp"];

/** Profilbild hochladen (multipart „file“, PNG/JPG/WebP bis 2 MB): das runde
 * Bild der Kundenakte im Hub, wie bei Instagram. Das Logo für Grafiken bleibt. */
export const POST = withMarketing(
  async (_actor, request, { params }: Context) => {
    const { id } = await params;
    if (!(await getWorkspace(id))) return Response.json({ error: "Kundenwelt nicht gefunden" }, { status: 404 });
    const file = (await request.formData()).get("file");
    if (!(file instanceof File)) return Response.json({ error: "Datei fehlt" }, { status: 400 });
    if (!ALLOWED.includes(file.type)) return Response.json({ error: "Profilbild als PNG, JPG oder WebP" }, { status: 415 });
    if (file.size > 2 * 1024 * 1024) return Response.json({ error: "Profilbild größer als 2 MB" }, { status: 413 });
    const item = await storeMedia(new Uint8Array(await file.arrayBuffer()), file.type, "avatar");
    await updateWorkspaceSettings(id, { avatar_path: item.path });
    return Response.json(await getWorkspace(id));
  },
  { agent: false }
);

/** Profilbild entfernen: im Hub erscheint wieder das Logo */
export const DELETE = withMarketing(
  async (_actor, _request, { params }: Context) => {
    const { id } = await params;
    if (!(await getWorkspace(id))) return Response.json({ error: "Kundenwelt nicht gefunden" }, { status: 404 });
    await updateWorkspaceSettings(id, { avatar_path: null });
    return Response.json(await getWorkspace(id));
  },
  { agent: false }
);
