import { withUser } from "@/lib/server/auth";
import { belegFiles, getBeleg } from "@/lib/server/beleg";
import { db } from "@/lib/server/db";
import { DEMO } from "@/lib/config";

type Context = { params: Promise<{ id: string }> };

/** Beleg einer Eingangsrechnung. Ohne Parameter die Datei für die Vorschau,
 * mit ?alle=1 alle Belegdateien (Base64) für den DATEV-Versand. */
export const GET = withUser(async (_user, request, { params }: Context) => {
  const { id } = await params;
  const invoice = await db().get("invoices", id);
  if (!invoice) return Response.json({ error: "Nicht gefunden" }, { status: 404 });
  const all = new URL(request.url).searchParams.has("alle");

  if (DEMO) {
    const text = `Beleg ${invoice.invoice_number ?? ""} (Vorschau)`;
    return all
      ? Response.json([{ name: `${invoice.invoice_number ?? "Beleg"}.pdf`, contentType: "application/pdf", contentBytes: Buffer.from(text).toString("base64") }])
      : new Response(text, { headers: { "Content-Type": "text/plain; charset=utf-8" } });
  }

  if (all) {
    const files = await belegFiles(invoice);
    return Response.json(files.map((f) => ({ name: f.name, contentType: f.contentType, contentBytes: f.bytes.toString("base64") })));
  }

  const beleg = await getBeleg(invoice);
  if (!beleg) return Response.json({ error: "Kein Beleg" }, { status: 404 });
  return new Response(new Uint8Array(beleg.bytes), {
    headers: {
      "Content-Type": beleg.contentType,
      "Content-Disposition": `inline; filename*=UTF-8''${encodeURIComponent(beleg.name)}`,
      "Cache-Control": "private, max-age=3600",
      // Mail-HTML nie mit Skripten oder im eigenen Ursprung ausführen
      "Content-Security-Policy": "sandbox",
      "X-Content-Type-Options": "nosniff",
    },
  });
}, ["finance"]);
