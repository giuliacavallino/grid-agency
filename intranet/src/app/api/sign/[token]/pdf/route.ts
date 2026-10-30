import { publicPdf, SignError } from "@/lib/server/sign";

type Context = { params: Promise<{ token: string }> };

export const maxDuration = 60;

/** Unterlagen als PDF: vor der Unterschrift die Mappe, danach die versiegelte */
export async function GET(request: Request, { params }: Context) {
  const { token } = await params;
  try {
    const { bytes, name } = await publicPdf(token);
    const download = new URL(request.url).searchParams.get("download");
    return new Response(new Uint8Array(bytes), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `${download ? "attachment" : "inline"}; filename="${name}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    const message = error instanceof SignError ? error.message : "PDF konnte nicht erzeugt werden";
    return new Response(message, { status: error instanceof SignError ? 400 : 500 });
  }
}
