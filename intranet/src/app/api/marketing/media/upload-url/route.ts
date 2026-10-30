import { withMarketing } from "@/lib/server/social/auth";
import { signedUpload, withUrls } from "@/lib/server/social/media";

const ALLOWED = /^(image\/(png|jpeg|webp|gif)|video\/(mp4|quicktime))$/;

/** Signierte Upload-Adresse für große Dateien: { name, mime } → { upload_url, item }.
 * Die Datei per PUT an upload_url schicken, dann item im Post verwenden. */
export const POST = withMarketing(async (_actor, request) => {
  const { name, mime } = (await request.json()) as { name?: string; mime?: string };
  if (!mime || !ALLOWED.test(mime)) return Response.json({ error: "Nur PNG, JPG, WebP, GIF, MP4 oder MOV" }, { status: 415 });
  const { upload_url, item } = await signedUpload(name ?? "datei", mime);
  return Response.json({ upload_url, item: withUrls([item], new URL(request.url).origin)[0] });
});
