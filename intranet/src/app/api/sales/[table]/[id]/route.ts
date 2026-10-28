import { withUser } from "@/lib/server/auth";
import { db, isTable, pick } from "@/lib/server/db";

type Context = { params: Promise<{ table: string; id: string }> };

export const PATCH = withUser(async (user, request, { params }: Context) => {
  const { table, id } = await params;
  if (!isTable(table) || table === "inbound_messages") {
    return Response.json({ error: "Unbekannt" }, { status: 404 });
  }
  const patch = pick(table, await request.json());
  const store = db();

  // Lead gewonnen → Kunde anlegen, falls noch keiner verknüpft ist.
  let customer = null;
  if (table === "leads" && patch.stage === "gewonnen") {
    const lead = await store.get("leads", id);
    if (lead && !lead.customer_id) {
      customer = await store.insert("customers", {
        name: lead.company || lead.name,
        contact_name: lead.name,
        email: lead.email,
        phone: lead.phone,
        source: lead.source,
        lead_id: lead.id,
        status: "aktiv",
      });
      patch.customer_id = customer.id;
    }
  }

  // Eingangsrechnungen: Freigabe protokollieren; „An DATEV gesendet“ nur aus
  // „Freigegeben“ (der Versand selbst läuft im Browser über buchhaltung@).
  if (table === "invoices" && patch.stage) {
    const invoice = await store.get("invoices", id);
    if (!invoice) return Response.json({ error: "Nicht gefunden" }, { status: 404 });
    if (patch.stage === "datev" && invoice.stage !== "datev") {
      if (invoice.stage !== "freigegeben") {
        return Response.json({ error: "Erst freigeben, dann an DATEV senden" }, { status: 409 });
      }
      Object.assign(patch, { datev_sent_at: new Date().toISOString(), datev_sent_by: user.name });
    }
    if (patch.stage === "freigegeben" && invoice.stage !== "freigegeben") {
      Object.assign(patch, { approved_at: new Date().toISOString(), approved_by: user.name });
    }
    if (patch.stage === "neu") Object.assign(patch, { approved_at: null, approved_by: null });
  }

  const row = await store.update(table, id, patch);
  return Response.json(customer ? { ...row, _customer: customer } : row);
});

export const DELETE = withUser(async (_user, _request, { params }: Context) => {
  const { table, id } = await params;
  if (!isTable(table) || table === "inbound_messages") {
    return Response.json({ error: "Unbekannt" }, { status: 404 });
  }
  await db().remove(table, id);
  return new Response(null, { status: 204 });
});
