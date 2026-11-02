import { ASSET_KINDS, type BrandAsset } from "@/lib/marketing";
import { withMarketing } from "@/lib/server/social/auth";
import { storeMedia } from "@/lib/server/social/media";
import { getBrand, getWorkspace, updateBrand } from "@/lib/server/social/store";

type Context = { params: Promise<{ id: string }> };
// Kein SVG: Medien werden öffentlich ausgeliefert, SVG könnte Skripte enthalten
const ALLOWED = ["image/png", "image/jpeg", "image/webp", "image/gif"];

/** Bildmaterial ins Markenkit hochladen (multipart „file“, „kind“: Foto, Grafik oder Icon; bis 4 MB) */
export const POST = withMarketing(
  async (_actor, request, { params }: Context) => {
    const { id } = await params;
    if (!(await getWorkspace(id))) return Response.json({ error: "Kundenwelt nicht gefunden" }, { status: 404 });
    const form = await request.formData();
    const file = form.get("file");
    const kind = (ASSET_KINDS.includes(String(form.get("kind")) as BrandAsset["kind"]) ? String(form.get("kind")) : "Foto") as BrandAsset["kind"];
    if (!(file instanceof File)) return Response.json({ error: "Datei fehlt" }, { status: 400 });
    if (!ALLOWED.includes(file.type)) return Response.json({ error: "Bilder als PNG, JPG, WebP oder GIF" }, { status: 415 });
    if (file.size > 4 * 1024 * 1024) return Response.json({ error: "Datei größer als 4 MB" }, { status: 413 });
    const item = await storeMedia(new Uint8Array(await file.arrayBuffer()), file.type, kind.toLowerCase());
    const brand = await getBrand(id);
    const notes = file.name.replace(/\.[a-z0-9]+$/i, "").slice(0, 120);
    return Response.json(await updateBrand(id, { assets: [...brand.assets, { path: item.path, kind, notes }] }));
  },
  { agent: false }
);
