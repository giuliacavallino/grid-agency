import "server-only";
import type { BillingDetail, BillingDocument, BillingKind, BillingStatus } from "@/lib/billing";
import { demoStore } from "./demo-store";

// Beispielbelege für die lokale Vorschau (NEXT_PUBLIC_INTRANET_DEMO=1)

const iso = (daysAgo: number) => new Date(Date.now() - daysAgo * 86_400_000).toISOString().slice(0, 10);

let docs: BillingDocument[] | null = null;

async function build() {
  const customers = await demoStore.list("customers");
  const make = (
    i: number,
    kind: BillingKind,
    number: string | null,
    status: BillingStatus,
    customer: number,
    daysAgo: number | null,
    net: number,
    extra: Partial<BillingDocument> = {}
  ): BillingDocument => ({
    id: `beleg-${i}`,
    kind,
    number,
    status,
    title: null,
    customer_id: String(customers[customer].id),
    customer_name: String(customers[customer].name),
    ref_document_id: null,
    document_date: daysAgo === null ? null : iso(daysAgo),
    due_date: daysAgo === null ? null : iso(daysAgo - 14),
    currency: "EUR",
    amount_net: net,
    amount_gross: Math.round(net * 119) / 100,
    paid_amount: status === "bezahlt" ? Math.round(net * 119) / 100 : 0,
    paid_at: status === "bezahlt" && daysAgo !== null ? iso(daysAgo - 10) : null,
    recurring: null,
    has_pdf: false,
    source: "easybill",
    finalized_at: null,
    sent_at: null,
    send_error: null,
    ...extra,
  });
  return [
    make(1, "rechnung", "26-221", "offen", 0, 5, 2490),
    make(2, "rechnung", "26-220", "offen", 1, 25, 3990),
    make(3, "rechnung", "26-219", "bezahlt", 2, 35, 1490),
    make(4, "rechnung", "26-218", "storniert", 3, 40, 2490),
    make(5, "storno", "26-218", "erledigt", 3, 38, -2490, { ref_document_id: "beleg-4" }),
    make(6, "rechnung", "26-217", "bezahlt", 4, 60, 1490),
    make(7, "rechnung", "25-180", "bezahlt", 5, 320, 2180),
    make(8, "zahlungserinnerung", "Erinnerung", "erledigt", 1, 3, 0, { ref_document_id: "beleg-2" }),
    make(9, "angebot", "26-147", "offen", 5, 12, 3990),
    make(10, "angebot", "26-146", "angenommen", 0, 90, 2490),
    make(11, "serie", "Dauerrechnung Casa Beef", "offen", 0, null, 2490, {
      recurring: { status: "RUNNING", frequency: "MONTHLY", interval: 1, next_date: iso(-21) },
    }),
    make(12, "serie", "Dauerrechnung Goldies", "erledigt", 2, null, 1490, {
      recurring: { status: "STOP", frequency: "MONTHLY", interval: 1, next_date: null },
    }),
  ];
}

export async function demoBilling() {
  docs ??= await build();
  return docs;
}

export async function demoBillingDetail(id: string): Promise<BillingDetail | null> {
  const all = await demoBilling();
  const doc = all.find((d) => d.id === id);
  if (!doc) return null;
  return {
    ...doc,
    amount_vat: Math.round((doc.amount_gross - doc.amount_net) * 100) / 100,
    service_from: doc.document_date,
    service_to: doc.document_date,
    service_text: null,
    intro: "Vielen Dank für Ihren Auftrag. Wir berechnen Ihnen folgende Leistungen:",
    closing: "Bitte überweisen Sie den Betrag innerhalb von 14 Tagen.",
    vat_option: null,
    address: { company_name: doc.customer_name, street: "Musterstraße 1", zip_code: "10115", city: "Berlin", country: "DE" },
    notes: null,
    payment_terms_days: 5,
    recipient_email: null,
    sent_to: null,
    customer_number: "10042",
    items: doc.amount_net
      ? [
          {
            id: `${id}-1`,
            position: 0,
            kind: "position",
            article_id: null,
            number: "SM-M",
            description: "Social Media Betreuung\n3 Kanäle, 12 Posts, 20 Stories, 4 Reels",
            quantity: 1,
            unit: "Monat",
            unit_price_net: doc.amount_net,
            vat_percent: 19,
            discount: null,
            discount_type: null,
            total_net: doc.amount_net,
            total_vat: Math.round((doc.amount_gross - doc.amount_net) * 100) / 100,
            total_gross: doc.amount_gross,
          },
        ]
      : [],
    payments:
      doc.status === "bezahlt" && doc.paid_at
        ? [{ id: `${id}-p`, paid_on: doc.paid_at, amount: doc.amount_gross, method: "Überweisung", reference: doc.number, notes: null }]
        : [],
    related: all.filter((d) => d.ref_document_id === id || d.id === doc.ref_document_id),
  };
}
