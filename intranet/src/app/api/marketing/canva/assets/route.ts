import { withMarketing } from "@/lib/server/social/auth";
import { uploadAsset } from "@/lib/server/social/canva";

export const maxDuration = 120;
const MAX_BYTES = 50 * 1024 * 1024;

/** Bild oder Video nach Canva hochladen (multipart „file“ oder JSON { url, name }) */
export const POST = withMarketing(async (_actor, request) => {
  let bytes: Uint8Array;
  let name: string;
  if (request.headers.get("content-type")?.includes("multipart/form-data")) {
    const file = (await request.formData()).get("file");
    if (!(file instanceof File)) return Response.json({ error: "Datei fehlt" }, { status: 400 });
    bytes = new Uint8Array(await file.arrayBuffer());
    name = file.name;
  } else {
    const body = (await request.json()) as { url?: string; name?: string };
    if (!body.url?.startsWith("https://")) return Response.json({ error: "url (https) fehlt" }, { status: 400 });
    const response = await fetch(body.url);
    if (!response.ok) return Response.json({ error: `Datei nicht ladbar (${response.status})` }, { status: 400 });
    bytes = new Uint8Array(await response.arrayBuffer());
    name = body.name ?? body.url.split("/").pop() ?? "asset";
  }
  if (bytes.byteLength > MAX_BYTES) return Response.json({ error: "Datei größer als 50 MB" }, { status: 413 });
  return Response.json(await uploadAsset(bytes, name), { status: 201 });
});
