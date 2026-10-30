import { withMarketing } from "@/lib/server/social/auth";
import { storeMedia } from "@/lib/server/social/media";
import { getWorkspace, updateWorkspace } from "@/lib/server/social/store";

type Context = { params: Promise<{ id: string }> };
// Kein SVG: Logos werden öffentlich ausgeliefert, SVG könnte Skripte enthalten
const ALLOWED = ["image/png", "image/jpeg", "image/webp"];

/** Logo der Kundenwelt hochladen (multipart „file“, PNG/JPG/WebP bis 2 MB) */
export const POST = withMarketing(async (_actor, request, { params }: Context) => {
  const { id } = await params;
  if (!(await getWorkspace(id))) return Response.json({ error: "Kundenwelt nicht gefunden" }, { status: 404 });
  const file = (await request.formData()).get("file");
  if (!(file instanceof File)) return Response.json({ error: "Datei fehlt" }, { status: 400 });
  if (!ALLOWED.includes(file.type)) return Response.json({ error: "Logo als PNG, JPG oder WebP" }, { status: 415 });
  if (file.size > 2 * 1024 * 1024) return Response.json({ error: "Logo größer als 2 MB" }, { status: 413 });
  const item = await storeMedia(new Uint8Array(await file.arrayBuffer()), file.type, "logo");
  return Response.json(await updateWorkspace(id, { logo_path: item.path }));
});
