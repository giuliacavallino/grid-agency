import "server-only";
import { DEMO } from "@/lib/config";
import { DEFAULT_BILLING_SETTINGS, type BillingDetail, type BillingDocument, type BillingSettings } from "@/lib/billing";
import { db, sb } from "./db";
import { demoBilling, demoBillingDetail } from "./billing-demo";

// Ausgangsrechnungen lesen. Die PDFs liegen im privaten Bucket „billing“
// und gehen nur als kurzlebige signierte URL an den Browser.

export const BUCKET = "billing";

const LIST_COLUMNS =
  "id,kind,number,status,title,customer_id,ref_document_id,document_date,due_date,currency,amount_net,amount_gross,paid_amount,paid_at,recurring,pdf_path,source,finalized_at,sent_at,send_error,customers(name)";

type ListRow = Omit<BillingDocument, "customer_name" | "has_pdf"> & {
  pdf_path: string | null;
  customers: { name: string } | null;
};

export function check<T>({ data, error }: { data: T; error: { message: string } | null }) {
  if (error) throw new Error(error.message);
  return data;
}

const num = (value: unknown) => Number(value ?? 0);

function toDocument({ customers, pdf_path, ...row }: ListRow): BillingDocument {
  return {
    ...row,
    amount_net: num(row.amount_net),
    amount_gross: num(row.amount_gross),
    paid_amount: num(row.paid_amount),
    customer_name: customers?.name ?? null,
    has_pdf: !!pdf_path,
  };
}

export async function listBilling(): Promise<BillingDocument[]> {
  if (DEMO) return demoBilling();
  const rows: ListRow[] = [];
  // PostgREST liefert höchstens 1000 Zeilen je Anfrage
  for (let from = 0; ; from += 1000) {
    const page = check(
      await sb()
        .from("billing_documents")
        .select(LIST_COLUMNS)
        .order("document_date", { ascending: false, nullsFirst: true })
        .order("number", { ascending: false })
        .range(from, from + 999)
    ) as unknown as ListRow[];
    rows.push(...page);
    if (page.length < 1000) return rows.map(toDocument);
  }
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function getBilling(id: string): Promise<BillingDetail | null> {
  if (DEMO) return demoBillingDetail(id);
  // id landet unten in einem PostgREST-Filter
  if (!UUID.test(id)) return null;
  const doc = check(
    await sb()
      .from("billing_documents")
      .select(`${LIST_COLUMNS},amount_vat,service_from,service_to,service_text,intro,closing,vat_option,address,notes,payment_terms_days,recipient_email,sent_to`)
      .eq("id", id)
      .maybeSingle()
  ) as unknown as (ListRow & Omit<BillingDetail, keyof BillingDocument | "items" | "payments" | "related">) | null;
  if (!doc) return null;

  const relatedFilter = doc.ref_document_id ? `ref_document_id.eq.${id},id.eq.${doc.ref_document_id}` : `ref_document_id.eq.${id}`;
  const [items, payments, related] = await Promise.all([
    sb()
      .from("billing_items")
      .select("id,position,kind,article_id,number,description,quantity,unit,unit_price_net,vat_percent,discount,discount_type,total_net,total_vat,total_gross")
      .eq("document_id", id)
      .order("position"),
    sb().from("billing_payments").select("id,paid_on,amount,method,reference,notes").eq("document_id", id).order("paid_on"),
    sb().from("billing_documents").select(LIST_COLUMNS).or(relatedFilter).order("document_date"),
  ]);

  return {
    ...toDocument(doc),
    amount_vat: num(doc.amount_vat),
    service_from: doc.service_from,
    service_to: doc.service_to,
    service_text: doc.service_text,
    intro: doc.intro,
    closing: doc.closing,
    vat_option: doc.vat_option,
    address: doc.address,
    notes: doc.notes,
    payment_terms_days: doc.payment_terms_days,
    recipient_email: doc.recipient_email,
    sent_to: doc.sent_to,
    items: (check(items) ?? []).map((item) => ({
      ...item,
      quantity: num(item.quantity),
      unit_price_net: num(item.unit_price_net),
      vat_percent: num(item.vat_percent),
      discount: item.discount === null ? null : num(item.discount),
      total_net: num(item.total_net),
      total_vat: num(item.total_vat),
      total_gross: num(item.total_gross),
    })),
    payments: (check(payments) ?? []).map((p) => ({ ...p, amount: num(p.amount) })),
    related: ((check(related) ?? []) as unknown as ListRow[]).map(toDocument),
  };
}

export async function billingPdfUrl(id: string) {
  if (DEMO) return null;
  const doc = check(await sb().from("billing_documents").select("pdf_path").eq("id", id).maybeSingle()) as { pdf_path: string | null } | null;
  if (!doc?.pdf_path) return null;
  const { data, error } = await sb().storage.from(BUCKET).createSignedUrl(doc.pdf_path, 600);
  if (error) throw new Error(error.message);
  return data.signedUrl;
}

/** Firmendaten und Texte aus Finance → Einstellungen, ergänzt um die Vorgaben */
export async function billingSettings(): Promise<BillingSettings> {
  const stored = await db().getSetting<Partial<BillingSettings>>("billing");
  return {
    ...DEFAULT_BILLING_SETTINGS,
    ...stored,
    company: { ...DEFAULT_BILLING_SETTINGS.company, ...stored?.company },
  };
}
