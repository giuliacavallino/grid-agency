import "server-only";
import type { OpenItem } from "@/lib/bank";
import { DEMO } from "@/lib/config";
import { sb } from "./db";

// Ausgangsrechnungen (billing_documents) für den Bank-Abgleich: offene
// Rechnungen lesen, Zahlungseingänge als billing_payments verbuchen und
// Betrag/Status der Rechnung nachziehen.

type Doc = {
  id: string;
  number: string | null;
  title: string | null;
  document_date: string | null;
  due_date: string | null;
  amount_gross: number | string;
  paid_amount: number | string;
  customers: { name: string } | null;
};

function check<T>({ data, error }: { data: T; error: { message: string } | null }) {
  if (error) throw new Error(error.message);
  return data;
}

const round = (value: number) => Math.round(value * 100) / 100;

// Lokale Vorschau: drei offene Rechnungen im Arbeitsspeicher
const iso = (offset: number) => new Date(Date.now() + offset * 86_400_000).toISOString().slice(0, 10);
const demoDocs = [
  { id: "demo-re-101", number: "RE-2026-101", title: "Social Media Betreuung Oktober", document_date: iso(-20), due_date: iso(-6), amount_gross: 2963.1, paid_amount: 0, customers: { name: "Bäckerei Huck" } },
  { id: "demo-re-102", number: "RE-2026-102", title: "Google-Profile Pflege", document_date: iso(-12), due_date: iso(2), amount_gross: 3213, paid_amount: 0, customers: { name: "Casualfood GmbH" } },
  { id: "demo-re-103", number: "RE-2026-103", title: "Content Shooting", document_date: iso(-3), due_date: iso(11), amount_gross: 2142, paid_amount: 0, customers: { name: "Casualfood GmbH" } },
];
const demoPayments = new Map<string, { document_id: string; amount: number }>();

/** Offene Rechnungen (Status offen oder teilbezahlt) mit Restbetrag */
export async function openReceivables(): Promise<OpenItem[]> {
  const docs: Doc[] = DEMO
    ? demoDocs
    : (check(
        await sb()
          .from("billing_documents")
          .select("id,number,title,document_date,due_date,amount_gross,paid_amount,customers(name)")
          .eq("kind", "rechnung")
          .in("status", ["offen", "teilbezahlt"])
          .limit(5000)
      ) as unknown as Doc[]);
  return docs
    .map((d) => ({
      id: d.id,
      kind: "receivable" as const,
      number: d.number,
      name: d.customers?.name || d.title || "Kunde",
      amount: round(Number(d.amount_gross) - Number(d.paid_amount)),
      date: d.document_date,
      due_date: d.due_date,
    }))
    .filter((d) => d.amount > 0);
}

/** Bezahlten Betrag und Status aus den Zahlungen neu berechnen */
async function refresh(documentId: string) {
  if (DEMO) {
    const doc = demoDocs.find((d) => d.id === documentId);
    if (doc) doc.paid_amount = round([...demoPayments.values()].filter((p) => p.document_id === documentId).reduce((s, p) => s + p.amount, 0));
    return;
  }
  const doc = check(await sb().from("billing_documents").select("amount_gross,status").eq("id", documentId).maybeSingle()) as {
    amount_gross: number | string;
    status: string;
  } | null;
  if (!doc) return;
  const payments = check(await sb().from("billing_payments").select("amount,paid_on").eq("document_id", documentId)) as {
    amount: number | string;
    paid_on: string;
  }[];
  const paid = round(payments.reduce((sum, p) => sum + Number(p.amount), 0));
  const full = paid >= Number(doc.amount_gross) - 0.005;
  const status = doc.status === "storniert" ? doc.status : full ? "bezahlt" : paid > 0 ? "teilbezahlt" : "offen";
  const last = payments.map((p) => p.paid_on).sort().at(-1) ?? null;
  check(await sb().from("billing_documents").update({ paid_amount: paid, paid_at: full ? last : null, status }).eq("id", documentId));
}

/** Zahlungseingang verbuchen; liefert die ID der Zahlung. */
export async function addReceivablePayment(documentId: string, amount: number, date: string, reference: string): Promise<string> {
  let id: string;
  if (DEMO) {
    id = `demo-pay-${demoPayments.size + 1}`;
    demoPayments.set(id, { document_id: documentId, amount: round(amount) });
  } else {
    const row = check(
      await sb()
        .from("billing_payments")
        .insert({ document_id: documentId, paid_on: date, amount: round(amount), method: "ueberweisung", reference: reference.slice(0, 500), notes: "Bank-Abgleich (Finance → Bank)" })
        .select("id")
        .single()
    ) as { id: string };
    id = row.id;
  }
  await refresh(documentId);
  return id;
}

export async function removeReceivablePayment(paymentId: string, documentId: string) {
  if (DEMO) demoPayments.delete(paymentId);
  else check(await sb().from("billing_payments").delete().eq("id", paymentId));
  await refresh(documentId);
}
