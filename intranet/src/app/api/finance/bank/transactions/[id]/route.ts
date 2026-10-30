import type { BankTransaction, OpenItem } from "@/lib/bank";
import { withUser } from "@/lib/server/auth";
import { assignEasybill, assignInvoice, clearMatch, ignore } from "@/lib/server/bank";
import { db } from "@/lib/server/db";
import { BankError } from "@/lib/server/enable-banking";
import { EasybillError, openInvoices } from "@/lib/server/easybill";

type Context = { params: Promise<{ id: string }> };

/** Umsatz zuordnen, ignorieren, Zuordnung lösen oder Notiz speichern.
 * Body: { action: "invoice", invoice_id } | { action: "easybill", document_id }
 * | { action: "ignore" } | { action: "clear" } | { action: "note", note } */
export const POST = withUser(async (user, request, { params }: Context) => {
  const { id } = await params;
  const store = db();
  const tx = (await store.get("bank_transactions", id)) as unknown as BankTransaction | null;
  if (!tx) return Response.json({ error: "Nicht gefunden" }, { status: 404 });
  const body = await request.json().catch(() => ({}));
  const busy = () => Response.json({ error: "Der Umsatz ist schon zugeordnet. Erst die Zuordnung lösen." }, { status: 409 });

  try {
    switch (body?.action) {
      case "invoice":
        if (tx.match_type && tx.match_type !== "invoice") return busy();
        if (tx.invoice_id) await clearMatch(tx);
        return Response.json(await assignInvoice(tx, String(body.invoice_id), user.name));
      case "easybill": {
        if (tx.match_type) return busy();
        const item = (await openInvoices()).find((d: OpenItem) => d.id === String(body.document_id));
        if (!item) return Response.json({ error: "Rechnung in easybill nicht (mehr) offen" }, { status: 409 });
        return Response.json(await assignEasybill(tx, item, user.name));
      }
      case "ignore":
        if (tx.match_type) return busy();
        return Response.json(await ignore(tx, user.name));
      case "clear":
        return Response.json(await clearMatch(tx));
      case "note":
        return Response.json(await store.update("bank_transactions", id, { note: String(body.note ?? "").trim() || null }));
      default:
        return Response.json({ error: "Unbekannte Aktion" }, { status: 400 });
    }
  } catch (error) {
    if (error instanceof BankError || error instanceof EasybillError) return Response.json({ error: error.message }, { status: 502 });
    throw error;
  }
}, ["finance"]);
