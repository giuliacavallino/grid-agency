import { forbidden, withUser } from "@/lib/server/auth";
import { removeApplicationFiles } from "@/lib/server/application-files";
import { canUseTable, db, isTable, mayTouch, pick, READ_ONLY } from "@/lib/server/db";

type Context = { params: Promise<{ table: string; id: string }> };

export const PATCH = withUser(async (user, request, { params }: Context) => {
  const { table, id } = await params;
  if (!isTable(table) || READ_ONLY.includes(table)) {
    return Response.json({ error: "Unbekannt" }, { status: 404 });
  }
  if (!canUseTable(user, table)) return forbidden();
  if (!(await mayTouch(user, table, await db().get(table, id)))) return forbidden();
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

  // Eingangsrechnungen: Freigabe und DATEV-Versand protokollieren. „Freigeben“
  // geht mit einem Klick von „Neu“ direkt nach DATEV (der Versand selbst läuft
  // im Browser über buchhaltung@) und zählt dann zugleich als Freigabe.
  if (table === "invoices" && patch.stage) {
    const invoice = await store.get("invoices", id);
    if (!invoice) return Response.json({ error: "Nicht gefunden" }, { status: 404 });
    if (patch.stage === "datev" && invoice.stage !== "datev") {
      if (invoice.stage !== "neu" && invoice.stage !== "freigegeben") {
        return Response.json({ error: "Abgelehnte Rechnungen gehen nicht an DATEV" }, { status: 409 });
      }
      const now = new Date().toISOString();
      Object.assign(patch, { datev_sent_at: now, datev_sent_by: user.name });
      if (!invoice.approved_at) Object.assign(patch, { approved_at: now, approved_by: user.name });
    }
    if (patch.stage === "freigegeben" && invoice.stage !== "freigegeben") {
      Object.assign(patch, { approved_at: new Date().toISOString(), approved_by: user.name });
    }
    if (patch.stage === "neu") Object.assign(patch, { approved_at: null, approved_by: null });
  }

  const row = await store.update(table, id, patch);
  return Response.json(customer ? { ...row, _customer: customer } : row);
});

export const DELETE = withUser(async (user, _request, { params }: Context) => {
  const { table, id } = await params;
  if (!isTable(table) || READ_ONLY.includes(table)) {
    return Response.json({ error: "Unbekannt" }, { status: 404 });
  }
  if (!canUseTable(user, table)) return forbidden();
  const row = await db().get(table, id);
  if (!(await mayTouch(user, table, row))) return forbidden();
  await db().remove(table, id);
  if (table === "applications" && row) await removeApplicationFiles(row);
  return new Response(null, { status: 204 });
});
