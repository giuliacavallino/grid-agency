// Einmaliger Import der easybill-Historie nach Supabase: Kunden, Positionen
// (= Artikel), alle Belege mit Positionen, Zahlungen und die PDFs. Läuft als
// Edge Function, weil EASYBILL_API_KEY als Supabase-Secret liegt.
// Wiederholbar: alles hängt an der easybill-ID, nichts wird doppelt angelegt.
//
// POST { "step": "data" }                 Stammdaten, Belege, Zahlungen
// POST { "step": "pdfs", "after": <id> }   PDFs in Portionen (Cursor = easybill-ID)
// Header x-import-token: Klartext zum Hash in sales_settings.easybill_import

import { createClient } from "npm:@supabase/supabase-js@2";

const API = "https://api.easybill.de/rest/v1";
const BUCKET = "billing";
const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
  auth: { persistSession: false },
});

// deno-lint-ignore no-explicit-any
type Any = Record<string, any>;

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function easybill(path: string, accept = "application/json", attempt = 0): Promise<Response> {
  const key = Deno.env.get("EASYBILL_API_KEY");
  if (!key) throw new Error("EASYBILL_API_KEY fehlt");
  const response = await fetch(`${API}${path}`, { headers: { Authorization: `Bearer ${key}`, Accept: accept } });
  // easybill begrenzt die Anfragen pro Minute
  if (response.status === 429 && attempt < 6) {
    const wait = Number(response.headers.get("retry-after")) || 10;
    await response.body?.cancel();
    await sleep(wait * 1000);
    return easybill(path, accept, attempt + 1);
  }
  if (!response.ok) throw new Error(`easybill ${path}: ${response.status} ${await response.text()}`);
  return response;
}

async function all(path: string): Promise<Any[]> {
  const items: Any[] = [];
  for (let page = 1; ; page++) {
    const separator = path.includes("?") ? "&" : "?";
    const result = await (await easybill(`${path}${separator}limit=1000&page=${page}`)).json();
    items.push(...result.items);
    if (page >= result.pages) return items;
  }
}

function check<T>({ data, error }: { data: T; error: { message: string } | null }) {
  if (error) throw new Error(error.message);
  return data;
}

const chunks = <T>(list: T[], size: number) =>
  Array.from({ length: Math.ceil(list.length / size) }, (_, i) => list.slice(i * size, (i + 1) * size));

async function upsert(table: string, rows: Any[], select = "id,easybill_id") {
  const saved: Any[] = [];
  for (const part of chunks(rows, 500)) {
    if (part.length) saved.push(...(check(await sb.from(table).upsert(part, { onConflict: "easybill_id" }).select(select)) as Any[]));
  }
  return saved;
}

const euros = (cents: number | null | undefined) => Math.round(cents ?? 0) / 100;
const day = (value: string | null | undefined) => (value ? value.slice(0, 10) : null);
const firstLine = (text: string | null | undefined) => text?.split("\n")[0].trim() || null;
const person = (c: Any) => [c.first_name, c.last_name].filter(Boolean).join(" ").trim();

// Gleiche Abbildung wie src/lib/server/easybill.ts
function articleUnit(unit: string | null) {
  const u = (unit ?? "").toLowerCase();
  if (/mon|mtl/.test(u)) return "monatlich";
  if (/std|stunde|^h$/.test(u)) return "stunde";
  if (/tag/.test(u)) return "tag";
  return "einmalig";
}

const KIND: Record<string, string> = {
  INVOICE: "rechnung",
  CREDIT: "gutschrift",
  STORNO: "storno",
  STORNO_CREDIT: "storno_gutschrift",
  OFFER: "angebot",
  ORDER: "auftrag",
  // bei GRID: Auftragsbestätigungen aus angenommenen Angeboten
  CHARGE: "auftrag",
  CHARGE_CONFIRM: "auftrag",
  DELIVERY: "lieferschein",
  REMINDER: "zahlungserinnerung",
  DUNNING: "mahnung",
  RECURRING: "serie",
  PROFORMA_INVOICE: "proforma",
  STORNO_PROFORMA_INVOICE: "storno",
  LETTER: "brief",
};

function status(d: Any, kind: string) {
  // Serienrechnungen sind in easybill immer Entwürfe; maßgeblich ist der Serienstatus
  if (kind === "serie") return d.recurring_options?.status === "STOP" ? "erledigt" : "offen";
  if (d.is_draft) return "entwurf";
  if (["rechnung", "gutschrift", "proforma"].includes(kind)) {
    if (d.cancel_id) return "storniert";
    const amount = Math.abs(d.amount ?? 0);
    const paid = Math.abs(d.paid_amount ?? 0);
    if (amount === 0) return "erledigt";
    if (paid >= amount || d.status === "DONE") return "bezahlt";
    return paid > 0 ? "teilbezahlt" : "offen";
  }
  if (["angebot", "auftrag"].includes(kind)) {
    return ({ ACCEPT: "angenommen", DONE: "erledigt", CANCEL: "abgelehnt" } as Record<string, string>)[d.status] ?? "offen";
  }
  return "erledigt";
}

const DISCOUNT: Record<string, string> = { PERCENT: "prozent", AMOUNT: "betrag", FIX: "betrag", QUANTITY: "betrag" };

async function importData() {
  // nacheinander, wegen des Anfragelimits
  const customers = await all("/customers");
  const positions = await all("/positions");
  const groups = await all("/position-groups");
  const documents = await all("/documents");
  const payments = await all("/document-payments");

  // Kunden: Status, Notizen und Herkunft pflegt das Intranet, die bleiben
  const known = new Set(
    (check(await sb.from("customers").select("easybill_id").not("easybill_id", "is", null)) as Any[]).map((r) => Number(r.easybill_id))
  );
  const customerRows = customers.map((c) => {
    const row: Any = {
      easybill_id: c.id,
      name: c.company_name?.trim() || c.display_name?.trim() || person(c) || `Kunde ${c.id}`,
      contact_name: person(c) || null,
      email: c.emails?.[0] ?? null,
      billing_email: c.emails?.[0] ?? null,
      phone: c.phone_1 || c.mobile || null,
      website: c.internet || null,
      city: c.city || null,
      customer_number: c.number || null,
      street: c.street || null,
      zip: c.zip_code || null,
      country: c.country || "DE",
      vat_id: c.vat_identifier || null,
      payment_terms_days: c.grace_period ?? null,
    };
    if (!known.has(c.id)) Object.assign(row, { notes: c.note || null, source: c.acquire_options === 1 ? "empfehlung" : null, status: c.archived ? "ehemalig" : "aktiv" });
    return row;
  });
  const customerId = new Map(
    [
      ...(await upsert("customers", customerRows.filter((r) => !known.has(r.easybill_id)))),
      ...(await upsert("customers", customerRows.filter((r) => known.has(r.easybill_id)))),
    ].map((r) => [Number(r.easybill_id), r.id as string])
  );

  const groupName = new Map(groups.map((g) => [g.id, g.name]));
  const articleId = new Map(
    (
      await upsert(
        "articles",
        positions.map((p) => ({
          easybill_id: p.id,
          number: p.number || null,
          name: firstLine(p.description) ?? p.number ?? `Position ${p.id}`,
          description: p.description?.split("\n").slice(1).join("\n").trim() || p.note || null,
          category: (p.group_id && groupName.get(p.group_id)) || null,
          price: euros(p.sale_price),
          unit: articleUnit(p.unit),
          vat_percent: p.vat_percent ?? 19,
          active: !p.archived,
        }))
      )
    ).map((r) => [Number(r.easybill_id), r.id as string])
  );

  // Belege. Storno ↔ Original: easybill setzt am Original cancel_id.
  const cancelled = new Map<number, number>();
  for (const d of documents) if (d.cancel_id) cancelled.set(Number(d.cancel_id), d.id);
  const documentRows = documents.map((d) => {
    const kind = KIND[d.type] ?? "sonstiges";
    const service = d.service_date ?? {};
    return {
      easybill_id: d.id,
      source: "easybill",
      kind,
      number: d.number || null,
      status: status(d, kind),
      customer_id: d.customer_id ? (customerId.get(Number(d.customer_id)) ?? null) : null,
      easybill_customer_id: d.customer_id ?? null,
      easybill_ref_id: d.ref_id ?? cancelled.get(d.id) ?? null,
      document_date: day(d.document_date),
      due_date: day(d.due_date),
      service_from: day(service.date_from ?? service.date),
      service_to: day(service.date_to ?? service.date),
      service_text: service.text || null,
      title: d.title || null,
      intro: d.text_prefix || null,
      closing: d.text || null,
      currency: d.currency || "EUR",
      amount_net: euros(d.amount_net),
      amount_vat: euros((d.amount ?? 0) - (d.amount_net ?? 0)),
      amount_gross: euros(d.amount),
      paid_amount: euros(d.paid_amount),
      paid_at: day(d.paid_at),
      vat_option: d.vat_option || null,
      address: d.address ?? null,
      recurring: d.recurring_options ?? null,
      raw: d,
    };
  });
  const savedDocs = await upsert("billing_documents", documentRows);
  const documentId = new Map(savedDocs.map((r) => [Number(r.easybill_id), r.id as string]));

  // Verweise auflösen (Original muss zuerst existieren)
  const refs = documentRows.filter((r) => r.easybill_ref_id && documentId.has(Number(r.easybill_ref_id)));
  for (const part of chunks(refs, 50)) {
    await Promise.all(
      part.map(async (r) =>
        check(
          await sb
            .from("billing_documents")
            .update({ ref_document_id: documentId.get(Number(r.easybill_ref_id)) })
            .eq("id", documentId.get(r.easybill_id))
        )
      )
    );
  }

  // Positionen: je Beleg neu schreiben
  const ids = [...documentId.values()];
  for (const part of chunks(ids, 200)) check(await sb.from("billing_items").delete().in("document_id", part));
  const itemRows = documents.flatMap((d) =>
    (d.items ?? []).map((item: Any, index: number) => ({
      document_id: documentId.get(d.id),
      position: item.position ?? index,
      kind: item.type === "TEXT" ? "text" : "position",
      article_id: item.position_id ? (articleId.get(Number(item.position_id)) ?? null) : null,
      number: item.number || null,
      description: item.description || null,
      quantity: item.quantity ?? 1,
      unit: item.unit || null,
      unit_price_net: (item.single_price_net ?? 0) / 100,
      vat_percent: item.vat_percent ?? 0,
      discount: item.discount ?? null,
      discount_type: item.discount_type ? (DISCOUNT[item.discount_type] ?? null) : null,
      total_net: euros(item.total_price_net),
      total_vat: euros(item.total_vat),
      total_gross: euros(item.total_price_gross),
    }))
  );
  for (const part of chunks(itemRows, 1000)) check(await sb.from("billing_items").insert(part));

  const paymentRows = payments
    .filter((p) => documentId.has(Number(p.document_id)))
    .map((p) => ({
      easybill_id: p.id,
      document_id: documentId.get(Number(p.document_id)),
      paid_on: day(p.payment_at) ?? day(p.created_at) ?? new Date().toISOString().slice(0, 10),
      amount: euros(p.amount),
      method: p.type || p.provider || null,
      reference: p.reference || null,
      notes: p.notice || null,
    }));
  await upsert("billing_payments", paymentRows);

  const byKind: Record<string, number> = {};
  for (const r of documentRows) byKind[r.kind] = (byKind[r.kind] ?? 0) + 1;
  const result = {
    at: new Date().toISOString(),
    customers: customers.length,
    articles: positions.length,
    documents: documents.length,
    by_kind: byKind,
    items: itemRows.length,
    payments: paymentRows.length,
    unknown_types: [...new Set(documents.filter((d) => !KIND[d.type]).map((d) => d.type))],
  };
  check(await sb.from("sales_settings").upsert({ key: "easybill_history", value: result, updated_at: result.at }));
  return result;
}

const safe = (text: string) => text.replace(/[^\w.-]+/g, "_");

/** PDFs ablegen, bis das Zeitbudget aufgebraucht ist; Cursor = easybill-ID */
async function importPdfs(after: number) {
  const started = Date.now();
  const docs = check(
    await sb
      .from("billing_documents")
      .select("id,easybill_id,kind,number,document_date")
      .eq("source", "easybill")
      .is("pdf_path", null)
      .neq("status", "entwurf")
      .neq("kind", "serie")
      .gt("easybill_id", after)
      .order("easybill_id")
      .limit(200)
  ) as Any[];
  let cursor = after;
  let saved = 0;
  const failed: { id: number; error: string }[] = [];
  for (const doc of docs) {
    if (Date.now() - started > 110_000) break;
    try {
      const pdf = await (await easybill(`/documents/${doc.easybill_id}/pdf`, "application/pdf")).arrayBuffer();
      const year = doc.document_date?.slice(0, 4) ?? "ohne-datum";
      const path = `easybill/${year}/${doc.kind}_${safe(doc.number ?? "ohne-nummer")}_${doc.easybill_id}.pdf`;
      check(await sb.storage.from(BUCKET).upload(path, pdf, { contentType: "application/pdf", upsert: true }));
      check(await sb.from("billing_documents").update({ pdf_path: path }).eq("id", doc.id));
      saved++;
    } catch (error) {
      failed.push({ id: doc.easybill_id, error: String(error).slice(0, 200) });
    }
    cursor = doc.easybill_id;
  }
  const { count } = await sb
    .from("billing_documents")
    .select("id", { count: "exact", head: true })
    .eq("source", "easybill")
    .is("pdf_path", null)
    .neq("status", "entwurf")
    .neq("kind", "serie")
    .gt("easybill_id", cursor);
  return { saved, failed, cursor, remaining: count ?? 0 };
}

async function sha256(text: string) {
  const hash = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return [...new Uint8Array(hash)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

Deno.serve(async (request) => {
  if (request.method !== "POST") return new Response("Nur POST", { status: 405 });
  const setting = check(await sb.from("sales_settings").select("value").eq("key", "easybill_import").maybeSingle()) as Any | null;
  const token = request.headers.get("x-import-token") ?? "";
  if (!setting?.value?.token_sha256 || (await sha256(token)) !== setting.value.token_sha256) {
    return new Response("Nicht erlaubt", { status: 401 });
  }
  try {
    const body = await request.json().catch(() => ({}));
    const result = body.step === "pdfs" ? await importPdfs(Number(body.after) || 0) : await importData();
    return Response.json(result);
  } catch (error) {
    return Response.json({ error: String(error) }, { status: 500 });
  }
});
