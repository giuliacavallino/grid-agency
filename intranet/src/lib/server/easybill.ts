import "server-only";
import type { OpenItem } from "@/lib/bank";
import { DEMO } from "@/lib/config";
import { db, type EasybillTable, type Row } from "./db";
import { demoEasybill } from "./easybill-demo";

// Abgleich easybill → Intranet: Kunden, Positionen (= Artikel), aktive
// Serienrechnungen (= Retainer im Auftragsbuch) und offene Angebote
// (= Leads in der Phase „Angebot“). easybill bleibt die Quelle; was nur im
// Intranet gepflegt wird (Stunden je Retainer, Aufwand je Artikel, Status
// von Kunden), überschreibt der Abgleich nicht.

const API = "https://api.easybill.de/rest/v1";

type Page<T> = { page: number; pages: number; items: T[] };

export type EbCustomer = {
  id: number;
  company_name: string | null;
  first_name: string | null;
  last_name: string | null;
  display_name?: string | null;
  emails: string[] | null;
  phone_1: string | null;
  mobile: string | null;
  internet: string | null;
  city: string | null;
  note: string | null;
  acquire_options: number | null;
  archived: boolean;
};

export type EbPosition = {
  id: number;
  number: string | null;
  description: string | null;
  note: string | null;
  unit: string | null;
  sale_price: number | null;
  group_id: number | null;
  archived: boolean;
};

export type EbGroup = { id: number; name: string };

export type EbDocument = {
  id: number;
  number: string | null;
  title: string | null;
  customer_id: number | null;
  document_date: string | null;
  created_at: string;
  amount_net: number;
  /** brutto in Cent */
  amount?: number;
  paid_amount?: number;
  paid_at?: string | null;
  due_date?: string | null;
  cancel_id?: number | null;
  status: string | null;
  is_draft: boolean;
  is_archive?: boolean;
  items: { description: string | null; position_id: number | null }[];
  recurring_options?: {
    frequency: "DAILY" | "WEEKLY" | "MONTHLY" | "YEARLY";
    interval: number | null;
    status: "RUNNING" | "PAUSE" | "STOP" | "WAITING";
    end_date_or_count: string | null;
    next_date: string | null;
  } | null;
};

export class EasybillError extends Error {}

async function call<T>(method: "GET" | "POST" | "DELETE", path: string, body?: unknown, attempt = 0): Promise<T> {
  const key = process.env.EASYBILL_API_KEY;
  if (!key) throw new EasybillError("EASYBILL_API_KEY fehlt");
  const response = await fetch(`${API}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${key}`,
      Accept: "application/json",
      ...(body ? { "Content-Type": "application/json" } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
    cache: "no-store",
  });
  // easybill begrenzt die Anfragen pro Minute; einmal kurz warten
  if (response.status === 429 && attempt < 2) {
    await new Promise((resolve) => setTimeout(resolve, 6000));
    return call(method, path, body, attempt + 1);
  }
  if (!response.ok) throw new EasybillError(`easybill ${path}: ${response.status} ${await response.text()}`);
  return response.status === 204 ? (undefined as T) : response.json();
}

const get = <T>(path: string) => call<T>("GET", path);

async function all<T>(path: string): Promise<T[]> {
  if (DEMO) return demoEasybill(path) as T[];
  const items: T[] = [];
  for (let page = 1; ; page++) {
    const separator = path.includes("?") ? "&" : "?";
    const result = await get<Page<T>>(`${path}${separator}limit=1000&page=${page}`);
    items.push(...result.items);
    if (page >= result.pages) return items;
  }
}

const euros = (cents: number | null | undefined) => Math.round(cents ?? 0) / 100;
const day = (value: string | null | undefined) => (value ? value.slice(0, 10) : null);
const firstLine = (text: string | null | undefined) => text?.split("\n")[0].trim() || null;

/** Serienrechnung → Monatsbetrag (netto) */
export function monthlyFee(doc: EbDocument) {
  const net = euros(doc.amount_net);
  const options = doc.recurring_options;
  const interval = Math.max(1, options?.interval ?? 1);
  switch (options?.frequency) {
    case "YEARLY":
      return net / (12 * interval);
    case "WEEKLY":
      return (net * 52) / 12 / interval;
    case "DAILY":
      return (net * 365) / 12 / interval;
    default:
      return net / interval;
  }
}

export function articleUnit(unit: string | null) {
  const u = (unit ?? "").toLowerCase();
  if (/mon|mtl/.test(u)) return "monatlich";
  if (/std|stunde|^h$/.test(u)) return "stunde";
  if (/tag/.test(u)) return "tag";
  return "einmalig";
}

const RETAINER_STATUS = { RUNNING: "aktiv", WAITING: "aktiv", PAUSE: "pausiert", STOP: "gekuendigt" } as const;

function customerName(c: EbCustomer) {
  const person = [c.first_name, c.last_name].filter(Boolean).join(" ").trim();
  return c.company_name?.trim() || c.display_name?.trim() || person || `Kunde ${c.id}`;
}

/** Neue Zeilen komplett anlegen; bei bestehenden die Felder aus keepOnUpdate
 * auslassen, damit im Intranet gepflegte Werte bleiben. */
async function sync(table: EasybillTable, rows: Record<string, unknown>[], keepOnUpdate: string[]) {
  const store = db();
  const existing = new Map((await store.list(table)).filter((r) => r.easybill_id != null).map((r) => [Number(r.easybill_id), r]));
  const fresh = rows.filter((row) => !existing.has(Number(row.easybill_id)));
  const known = rows
    .filter((row) => existing.has(Number(row.easybill_id)))
    .map((row) => Object.fromEntries(Object.entries(row).filter(([key]) => !keepOnUpdate.includes(key))));
  const saved = [...(await store.upsertEasybill(table, fresh)), ...(await store.upsertEasybill(table, known))];
  return { saved, created: fresh.length, updated: known.length, byEasybill: new Map<number, Row>(saved.map((r) => [Number(r.easybill_id), r])) };
}

export type SyncResult = {
  at: string;
  customers: { created: number; updated: number };
  articles: { created: number; updated: number };
  retainers: { created: number; updated: number };
  offers: { created: number };
};

export async function syncEasybill(): Promise<SyncResult> {
  const [customers, positions, groups, recurring, offers] = await Promise.all([
    all<EbCustomer>("/customers"),
    all<EbPosition>("/positions"),
    all<EbGroup>("/position-groups"),
    all<EbDocument>("/documents?type=RECURRING"),
    all<EbDocument>("/documents?type=OFFER&is_draft=0"),
  ]);

  // Kunden
  const customerSync = await sync(
    "customers",
    customers.map((c) => ({
      easybill_id: c.id,
      name: customerName(c),
      contact_name: [c.first_name, c.last_name].filter(Boolean).join(" ").trim() || null,
      email: c.emails?.[0] ?? null,
      phone: c.phone_1 || c.mobile || null,
      website: c.internet || null,
      city: c.city || null,
      notes: c.note || null,
      source: c.acquire_options === 1 ? "empfehlung" : null,
      status: c.archived ? "ehemalig" : "aktiv",
    })),
    ["status", "notes", "source"]
  );
  const customerId = (id: number | null) => (id == null ? null : (customerSync.byEasybill.get(id)?.id ?? null));

  // Artikel
  const groupName = new Map(groups.map((g) => [g.id, g.name]));
  const articleSync = await sync(
    "articles",
    positions.map((p) => ({
      easybill_id: p.id,
      name: firstLine(p.description) ?? p.number ?? `Position ${p.id}`,
      description: p.description?.split("\n").slice(1).join("\n").trim() || p.note || null,
      category: (p.group_id && groupName.get(p.group_id)) || null,
      price: euros(p.sale_price),
      unit: articleUnit(p.unit),
      active: !p.archived,
    })),
    []
  );

  // Retainer aus Serienrechnungen
  const retainerRows = recurring
    .map((doc) => {
      const customer = customerId(doc.customer_id);
      if (!customer || !doc.recurring_options) return null;
      const end = doc.recurring_options.end_date_or_count;
      const positionId = doc.items.find((item) => item.position_id)?.position_id ?? null;
      return {
        easybill_id: doc.id,
        customer_id: customer,
        article_id: positionId ? (articleSync.byEasybill.get(positionId)?.id ?? null) : null,
        title: doc.title || firstLine(doc.items[0]?.description) || "Serienrechnung",
        monthly_fee: Math.round(monthlyFee(doc) * 100) / 100,
        start_date: day(doc.document_date) ?? day(doc.created_at),
        end_date: end && /^\d{4}-\d{2}-\d{2}/.test(end) ? day(end) : null,
        status: RETAINER_STATUS[doc.recurring_options.status] ?? "aktiv",
      };
    })
    .filter((row) => row !== null);
  const retainerSync = await sync("retainers", retainerRows, []);

  // Offene Angebote der letzten 12 Monate als Leads in „Angebot“
  const store = db();
  const since = new Date(Date.now() - 365 * 86_400_000).toISOString().slice(0, 10);
  let offersCreated = 0;
  for (const offer of offers) {
    if (offer.status || offer.is_archive || (offer.document_date ?? "") < since) continue;
    const c = customers.find((x) => x.id === offer.customer_id);
    const lead = await store.insertIgnore("leads", {
      source: "manuell",
      source_ref: `easybill-offer-${offer.id}`,
      stage: "angebot",
      name: (c && ([c.first_name, c.last_name].filter(Boolean).join(" ").trim() || customerName(c))) || offer.title || "Angebot",
      company: c?.company_name || null,
      email: c?.emails?.[0] ?? null,
      customer_id: customerId(offer.customer_id),
      message: [
        `Angebot ${offer.number ?? offer.id} aus easybill vom ${day(offer.document_date)}`,
        offer.title,
        `Netto: ${euros(offer.amount_net).toLocaleString("de-DE", { style: "currency", currency: "EUR" })}`,
      ]
        .filter(Boolean)
        .join("\n"),
      created_at: offer.created_at,
    });
    if (lead) offersCreated++;
  }

  const result: SyncResult = {
    at: new Date().toISOString(),
    customers: { created: customerSync.created, updated: customerSync.updated },
    articles: { created: articleSync.created, updated: articleSync.updated },
    retainers: { created: retainerSync.created, updated: retainerSync.updated },
    offers: { created: offersCreated },
  };
  await store.setSetting("easybill_sync", result);
  return result;
}

// ---------- Zahlungen (Finance → Bank) ----------

/** Offene Ausgangsrechnungen der letzten 18 Monate: nicht storniert, nicht
 * archiviert, noch nicht (voll) bezahlt. */
export async function openInvoices(): Promise<OpenItem[]> {
  const from = new Date(Date.now() - 548 * 86_400_000).toISOString().slice(0, 10);
  const to = new Date(Date.now() + 31 * 86_400_000).toISOString().slice(0, 10);
  const docs = await all<EbDocument>(`/documents?type=INVOICE&is_draft=0&document_date=${from},${to}`);
  const names = new Map(
    (await db().list("customers")).filter((c) => c.easybill_id != null).map((c) => [Number(c.easybill_id), String(c.name)])
  );
  return docs
    .filter((d) => !d.cancel_id && !d.is_archive && !d.paid_at && (d.amount ?? 0) > (d.paid_amount ?? 0))
    .map((d) => ({
      id: String(d.id),
      kind: "easybill" as const,
      number: d.number,
      name: (d.customer_id != null && names.get(d.customer_id)) || d.title || `Kunde ${d.customer_id ?? "?"}`,
      amount: euros((d.amount ?? 0) - (d.paid_amount ?? 0)),
      date: day(d.document_date),
      due_date: day(d.due_date),
    }));
}

/** Zahlung in easybill buchen; liefert die ID der Zahlung. */
export async function addPayment(documentId: number, amount: number, date: string, reference: string): Promise<number> {
  if (DEMO) return Math.floor(Math.random() * 1_000_000);
  const payment = await call<{ id: number }>("POST", "/document-payments", {
    document_id: documentId,
    amount: Math.round(amount * 100),
    payment_at: date,
    provider: "Bank",
    reference: reference.slice(0, 255),
    notice: "Aus dem Intranet (Finance → Bank) zugeordnet",
  });
  return payment.id;
}

export async function removePayment(paymentId: number) {
  if (DEMO) return;
  await call("DELETE", `/document-payments/${paymentId}`);
}
