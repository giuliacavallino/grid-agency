import "server-only";
import { addPeriod, computeTotals, plain, todayBerlin, type BillingAddress, type Recurring } from "@/lib/billing";
import { check, getBilling } from "./billing";
import { ensurePdf, finalize, sendFromServer } from "./billing-write";
import { sb } from "./db";

// Serienrechnungen (täglicher Cron): Für jede fällige Serie, die im Intranet
// läuft, entsteht eine Rechnung (series_key verhindert Doppelte), wird
// festgeschrieben, als PDF abgelegt und von buchhaltung@ verschickt.
// Jeder Schritt wird beim nächsten Lauf nachgeholt, falls er scheitert.

type Series = {
  id: string;
  customer_id: string | null;
  address: BillingAddress | null;
  recipient_email: string | null;
  payment_terms_days: number | null;
  title: string | null;
  intro: string | null;
  closing: string | null;
  vat_option: string | null;
  currency: string;
  recurring: Recurring & { next_date: string };
  customers: {
    name: string;
    street: string | null;
    zip: string | null;
    city: string | null;
    country: string | null;
    billing_email: string | null;
    email: string | null;
    contact_name: string | null;
  } | null;
};

const MAX_SEND_ATTEMPTS = 3;
/** Nachholen höchstens so vieler Termine je Lauf und Serie */
const MAX_CATCH_UP = 3;

export type SeriesRun = { created: number; finalized: number; sent: number; errors: string[] };

/** Anschrift aus dem Kunden (aktuell), sonst die der Vorlage */
function addressFor(series: Series): BillingAddress {
  const c = series.customers;
  if (c?.street && c.city) {
    return { company_name: c.name, street: c.street, zip_code: c.zip ?? "", city: c.city, country: c.country ?? "DE" };
  }
  return series.address ?? { company_name: c?.name ?? "" };
}

async function createDue(series: Series, today: string, run: SeriesRun) {
  const r = series.recurring;
  const frequency = r.frequency ?? "MONTHLY";
  const interval = Math.max(1, r.interval ?? 1);
  let next = r.next_date;
  let status = r.status;
  const items = check(
    await sb()
      .from("billing_items")
      .select("position,kind,article_id,number,description,quantity,unit,unit_price_net,vat_percent,discount,discount_type,total_net,total_vat,total_gross")
      .eq("document_id", series.id)
      .order("position")
  ) as Record<string, unknown>[];
  if (!items.some((i) => i.kind === "position")) throw new Error("Serie ohne Positionen");
  const totals = computeTotals(items as never);

  for (let i = 0; i < MAX_CATCH_UP && status === "RUNNING" && next <= today; i++) {
    if (r.end_date && next > r.end_date) {
      status = "STOP";
      break;
    }
    const following = addPeriod(next, frequency, interval);
    const end = new Date(`${following}T12:00:00Z`);
    end.setUTCDate(end.getUTCDate() - 1);
    // Letzter Zeitraum endet spätestens am Enddatum (einmalige Rechnung: ein Tag)
    const serviceTo = r.end_date && r.end_date < end.toISOString().slice(0, 10) ? r.end_date : end.toISOString().slice(0, 10);
    const { data: inserted, error } = await sb()
      .from("billing_documents")
      .upsert(
        {
          kind: "rechnung",
          source: "intranet",
          status: "entwurf",
          series_key: `${series.id}:${next}`,
          ref_document_id: series.id,
          customer_id: series.customer_id,
          address: addressFor(series),
          recipient_email: series.recipient_email ?? series.customers?.billing_email ?? series.customers?.email ?? null,
          payment_terms_days: series.payment_terms_days,
          document_date: next,
          service_from: next,
          service_to: serviceTo,
          title: series.title,
          intro: series.intro,
          closing: series.closing,
          vat_option: series.vat_option,
          currency: series.currency,
          amount_net: totals.net,
          amount_vat: totals.vat,
          amount_gross: totals.gross,
        },
        { onConflict: "series_key", ignoreDuplicates: true }
      )
      .select("id");
    if (error) throw new Error(error.message);
    if (inserted?.length) {
      const id = inserted[0].id as string;
      check(
        await sb()
          .from("billing_items")
          .insert(items.map((item) => ({ ...item, document_id: id, description: plain(item.description as string | null) || null })))
      );
      run.created++;
    }
    next = following;
    if (r.end_date && next > r.end_date) status = "STOP";
  }

  check(
    await sb()
      .from("billing_documents")
      .update({ recurring: { ...r, next_date: next, status }, status: status === "STOP" ? "erledigt" : "offen" })
      .eq("id", series.id)
  );
}

export async function runSeries(today = todayBerlin()): Promise<SeriesRun> {
  const run: SeriesRun = { created: 0, finalized: 0, sent: 0, errors: [] };

  // 1. Fällige Termine anlegen
  const series = check(
    await sb()
      .from("billing_documents")
      .select("id,customer_id,address,recipient_email,payment_terms_days,title,intro,closing,vat_option,currency,recurring,customers(name,street,zip,city,country,billing_email,email,contact_name)")
      .eq("kind", "serie")
      .eq("recurring->>managed_by", "intranet")
      .eq("recurring->>status", "RUNNING")
      .lte("recurring->>next_date", today)
  ) as unknown as Series[];
  for (const s of series) {
    try {
      await createDue(s, today, run);
    } catch (error) {
      run.errors.push(`Serie ${s.id}: ${error instanceof Error ? error.message : error}`);
    }
  }

  // 2. Entwürfe aus Serien festschreiben (auch aus früheren, gescheiterten Läufen)
  const drafts = check(await sb().from("billing_documents").select("id").not("series_key", "is", null).eq("status", "entwurf")) as { id: string }[];
  for (const d of drafts) {
    try {
      await finalize(d.id);
      run.finalized++;
    } catch (error) {
      run.errors.push(`Festschreiben ${d.id}: ${error instanceof Error ? error.message : error}`);
    }
  }

  // 3. Versenden (mit fehlendem PDF vorher nachholen)
  const unsent = check(
    await sb()
      .from("billing_documents")
      .select("id,number,send_attempts")
      .not("series_key", "is", null)
      .not("finalized_at", "is", null)
      .is("sent_at", null)
      .lt("send_attempts", MAX_SEND_ATTEMPTS)
  ) as { id: string; number: string; send_attempts: number }[];
  for (const d of unsent) {
    try {
      await ensurePdf(d.id);
      await sendFromServer(d.id);
      run.sent++;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      run.errors.push(`Versand ${d.number}: ${message}`);
      check(
        await sb()
          .from("billing_documents")
          .update({ send_attempts: d.send_attempts + 1, send_error: message.slice(0, 500) })
          .eq("id", d.id)
      );
    }
  }
  return run;
}

/** Eine easybill-Serie ins Intranet übernehmen (ab dann erzeugt das Intranet die Rechnungen) */
export async function takeOverSeries(id: string) {
  const doc = await getBilling(id);
  if (!doc || doc.kind !== "serie") throw new Error("Serie nicht gefunden");
  const r = doc.recurring ?? {};
  if (r.managed_by === "intranet") return;
  const today = todayBerlin();
  const next = r.next_date && r.next_date >= today ? r.next_date : today;
  const end = r.end_date_or_count && /^\d{4}-\d{2}-\d{2}/.test(r.end_date_or_count) ? r.end_date_or_count.slice(0, 10) : null;
  check(
    await sb()
      .from("billing_documents")
      .update({
        recurring: {
          frequency: ["MONTHLY", "YEARLY", "WEEKLY"].includes(r.frequency ?? "") ? r.frequency : "MONTHLY",
          interval: r.interval ?? 1,
          next_date: next,
          end_date: end,
          status: r.status === "STOP" ? "STOP" : r.status === "PAUSE" ? "PAUSE" : "RUNNING",
          managed_by: "intranet",
        },
      })
      .eq("id", id)
  );
}

/** Serie pausieren, fortsetzen oder beenden */
export async function setSeriesStatus(id: string, status: "RUNNING" | "PAUSE" | "STOP") {
  const row = check(await sb().from("billing_documents").select("kind,recurring").eq("id", id).maybeSingle()) as {
    kind: string;
    recurring: Recurring | null;
  } | null;
  if (!row || row.kind !== "serie") throw new Error("Serie nicht gefunden");
  if (row.recurring?.managed_by !== "intranet") throw new Error("Die Serie läuft noch in easybill");
  check(
    await sb()
      .from("billing_documents")
      .update({ recurring: { ...row.recurring, status }, status: status === "STOP" ? "erledigt" : "offen" })
      .eq("id", id)
  );
}
