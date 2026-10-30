import "server-only";
import { randomUUID } from "node:crypto";
import { DEMO } from "@/lib/config";
import type { MediaItem } from "@/lib/marketing";
import { sb } from "../db";

// Medien der Posts liegen im privaten Storage-Bucket „social-media“. Meta und
// TikTok holen sie über /api/social/media/<uuid>/<datei>; der Pfad enthält
// eine zufällige UUID und ist damit nicht zu erraten. TikTok verlangt, dass
// die Domain (intranet.grid-agency.de) im TikTok-Entwicklerportal bestätigt ist.

const BUCKET = "social-media";
const demoFiles = new Map<string, { bytes: Uint8Array; mime: string }>();

const EXT: Record<string, string> = { "image/png": "png", "image/jpeg": "jpg", "image/webp": "webp", "image/gif": "gif", "video/mp4": "mp4", "video/quicktime": "mov", "application/pdf": "pdf", "audio/mpeg": "mp3", "audio/wav": "wav", "audio/mp4": "m4a" };

export const mediaKind = (mime: string): MediaItem["kind"] => (mime.startsWith("video/") ? "video" : mime.startsWith("audio/") ? "audio" : "image");

export function publicMediaUrl(path: string, origin?: string) {
  // Live ist INTRANET_URL gesetzt (Meta/TikTok brauchen absolute Adressen);
  // ohne ist die Adresse relativ und funktioniert im Browser (Vorschau)
  const base = process.env.INTRANET_URL ?? origin ?? "";
  return `${base}/api/social/media/${path.split("/").map(encodeURIComponent).join("/")}`;
}

/** Datei ablegen; liefert einen Medien-Eintrag für einen Post */
export async function storeMedia(bytes: Uint8Array, mime: string, name = "datei", extra: Partial<MediaItem> = {}): Promise<MediaItem> {
  const clean = name.replace(/\.[a-z0-9]+$/i, "").replace(/[^a-z0-9-_]+/gi, "-").slice(0, 60) || "datei";
  const path = `${randomUUID()}/${clean}.${EXT[mime] ?? "bin"}`;
  if (DEMO) demoFiles.set(path, { bytes, mime });
  else {
    const { error } = await sb().storage.from(BUCKET).upload(path, bytes, { contentType: mime, upsert: false });
    if (error) throw new Error(`Speichern fehlgeschlagen: ${error.message}`);
  }
  return { path, mime, kind: mediaKind(mime), ...extra };
}

/** Datei aus dem Netz holen und ablegen (z. B. Canva-Export) */
export async function storeFromUrl(url: string, name?: string, extra: Partial<MediaItem> = {}): Promise<MediaItem> {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Datei konnte nicht geladen werden (${response.status})`);
  const mime = (response.headers.get("content-type") ?? "application/octet-stream").split(";")[0];
  return storeMedia(new Uint8Array(await response.arrayBuffer()), mime, name, extra);
}

/** Direkter Upload vom Browser in den Storage (große Videos): Pfad und
 * signierte Upload-Adresse; danach gilt der Pfad als Medien-Eintrag. */
export async function signedUpload(name: string, mime: string) {
  const clean = name.replace(/\.[a-z0-9]+$/i, "").replace(/[^a-z0-9-_]+/gi, "-").slice(0, 60) || "datei";
  const path = `${randomUUID()}/${clean}.${EXT[mime] ?? "bin"}`;
  if (DEMO) return { path, upload_url: null as string | null, item: { path, mime, kind: mediaKind(mime) } as MediaItem };
  const { data, error } = await sb().storage.from(BUCKET).createSignedUploadUrl(path);
  if (error || !data) throw new Error(`Upload nicht möglich: ${error?.message ?? "unbekannt"}`);
  return { path, upload_url: data.signedUrl, item: { path, mime, kind: mediaKind(mime) } as MediaItem };
}

/** Kurzlebige Download-Adresse direkt aus dem Storage (für große Videos) */
export async function signedDownload(path: string) {
  if (DEMO) return null;
  const { data } = await sb().storage.from(BUCKET).createSignedUrl(path, 60 * 60);
  return data?.signedUrl ?? null;
}

export async function readMedia(path: string): Promise<{ bytes: Uint8Array; mime: string } | null> {
  if (!/^[0-9a-f-]{36}\/[a-z0-9-_]+\.[a-z0-9]+$/i.test(path)) return null;
  if (DEMO) return demoFiles.get(path) ?? null;
  const { data, error } = await sb().storage.from(BUCKET).download(path);
  if (error || !data) return null;
  return { bytes: new Uint8Array(await data.arrayBuffer()), mime: data.type || "application/octet-stream" };
}

/** Medien mit öffentlicher Adresse versehen (für Meta/TikTok und die Vorschau) */
export const withUrls = (media: MediaItem[], origin?: string) => media.map((m) => ({ ...m, url: publicMediaUrl(m.path, origin) }));
