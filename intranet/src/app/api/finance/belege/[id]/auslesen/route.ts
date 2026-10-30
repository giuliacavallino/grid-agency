import { withUser } from "@/lib/server/auth";
import { matchPayables } from "@/lib/server/bank";
import { db } from "@/lib/server/db";
import { readInvoice } from "@/lib/server/extract";
import { DEMO } from "@/lib/config";

export const maxDuration = 60;

type Context = { params: Promise<{ id: string }> };

/** Beleg auslesen (Beträge, Fälligkeit, bezahlt), leere Felder füllen und
 * danach mit den Kontoumsätzen abgleichen. Liefert die Rechnung zurück. */
export const POST = withUser(async (_user, _request, { params }: Context) => {
  const { id } = await params;
  const invoice = await db().get("invoices", id);
  if (!invoice) return Response.json({ error: "Nicht gefunden" }, { status: 404 });
  if (DEMO) return Response.json(await db().update("invoices", id, { extracted_at: new Date().toISOString() }));
  await readInvoice(invoice);
  await matchPayables().catch((error) => console.error("Bank-Abgleich:", error));
  return Response.json(await db().get("invoices", id));
}, ["finance"]);
