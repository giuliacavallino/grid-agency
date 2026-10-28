import { withUser } from "@/lib/server/auth";
import { db, isTable, pick } from "@/lib/server/db";

type Context = { params: Promise<{ table: string; id: string }> };

export const PATCH = withUser(async (_user, request, { params }: Context) => {
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
