import { withMarketing } from "@/lib/server/social/auth";
import { storeFromUrl, storeMedia, withUrls } from "@/lib/server/social/media";

export const maxDuration = 120;
// Vercel nimmt pro Anfrage höchstens 4,5 MB an; größere Dateien über
// /api/marketing/media/upload-url direkt in den Storage oder per { url }
const MAX_BYTES = 4 * 1024 * 1024;
const ALLOWED = /^(image\/(png|jpeg|webp|gif)|video\/(mp4|quicktime))$/;

/** Bild/Video für einen Post ablegen (multipart „file“ oder JSON { url, name }) */
export const POST = withMarketing(async (_actor, request) => {
  const origin = new URL(request.url).origin;
  if (request.headers.get("content-type")?.includes("multipart/form-data")) {
    const file = (await request.formData()).get("file");
    if (!(file instanceof File)) return Response.json({ error: "Datei fehlt" }, { status: 400 });
    if (!ALLOWED.test(file.type)) return Response.json({ error: "Nur PNG, JPG, WebP, GIF, MP4 oder MOV" }, { status: 415 });
    if (file.size > MAX_BYTES) return Response.json({ error: "Datei größer als 4 MB: über /api/marketing/media/upload-url hochladen" }, { status: 413 });
    const item = await storeMedia(new Uint8Array(await file.arrayBuffer()), file.type, file.name);
    return Response.json(withUrls([item], origin)[0], { status: 201 });
  }
  const body = (await request.json()) as { url?: string; name?: string };
  if (!body.url?.startsWith("https://")) return Response.json({ error: "url (https) fehlt" }, { status: 400 });
  const item = await storeFromUrl(body.url, body.name);
  if (!ALLOWED.test(item.mime)) return Response.json({ error: `Dateityp ${item.mime} wird nicht gepostet` }, { status: 415 });
  return Response.json(withUrls([item], origin)[0], { status: 201 });
});
