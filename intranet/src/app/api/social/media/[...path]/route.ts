import { readMedia, signedDownload } from "@/lib/server/social/media";

type Context = { params: Promise<{ path: string[] }> };

/** Medien eines Posts für Meta und TikTok (öffentlich, Pfad nicht erratbar).
 * Bilder kommen direkt; Videos per Weiterleitung aus dem Storage, weil
 * Vercel-Antworten auf 4,5 MB begrenzt sind. */
export async function GET(_request: Request, { params }: Context) {
  const path = (await params).path.join("/");
  if (/\.(mp4|mov)$/i.test(path)) {
    const url = await signedDownload(path);
    if (url) return Response.redirect(url, 302);
  }
  const file = await readMedia(path);
  if (!file) return new Response("Nicht gefunden", { status: 404 });
  return new Response(Buffer.from(file.bytes), {
    headers: { "Content-Type": file.mime, "Cache-Control": "public, max-age=86400, immutable", "X-Robots-Tag": "noindex" },
  });
}
