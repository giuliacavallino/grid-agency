import { withMarketing } from "@/lib/server/social/auth";
import { storeMedia } from "@/lib/server/social/media";
import { getBrand, getWorkspace, updateBrand, updateWorkspace } from "@/lib/server/social/store";

type Context = { params: Promise<{ id: string }> };
// Kein SVG: Logos werden öffentlich ausgeliefert, SVG könnte Skripte enthalten
const ALLOWED = ["image/png", "image/jpeg", "image/webp"];

/** Logo hochladen (multipart „file“, PNG/JPG/WebP bis 2 MB). Ohne „variant“
 * oder mit „Hauptlogo“ wird es das Logo der Kundenwelt im Hub; jede Variante
 * (z. B. „Negativ“, „Icon“) landet zusätzlich in der CI-Welt. */
export const POST = withMarketing(
  async (_actor, request, { params }: Context) => {
    const { id } = await params;
    if (!(await getWorkspace(id))) return Response.json({ error: "Kundenwelt nicht gefunden" }, { status: 404 });
    const form = await request.formData();
    const file = form.get("file");
    const variant = String(form.get("variant") ?? "Hauptlogo").slice(0, 60) || "Hauptlogo";
    if (!(file instanceof File)) return Response.json({ error: "Datei fehlt" }, { status: 400 });
    if (!ALLOWED.includes(file.type)) return Response.json({ error: "Logo als PNG, JPG oder WebP" }, { status: 415 });
    if (file.size > 2 * 1024 * 1024) return Response.json({ error: "Logo größer als 2 MB" }, { status: 413 });
    const item = await storeMedia(new Uint8Array(await file.arrayBuffer()), file.type, "logo");
    const brand = await getBrand(id);
    await updateBrand(id, { logos: [...brand.logos.filter((l) => l.variant !== variant), { path: item.path, variant }] });
    const workspace = variant === "Hauptlogo" ? await updateWorkspace(id, { logo_path: item.path }) : await getWorkspace(id);
    return Response.json(workspace);
  },
  { agent: false }
);
