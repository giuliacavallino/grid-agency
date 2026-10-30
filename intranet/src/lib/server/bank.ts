import "server-only";
import { autoMatch, isOpen, type BankSync, type BankTransaction, type OpenItem } from "@/lib/bank";
import { db, type Row } from "./db";
import {
  balances,
  BankError,
  createSession,
  deleteSession,
  transactionRef,
  transactions,
  type EbBalance,
  type Psu,
  type EbTransaction,
} from "./enable-banking";
import { addReceivablePayment, openReceivables, removeReceivablePayment } from "./receivables";

// Abgleich Bank → Intranet: Saldo und gebuchte Umsätze aller verbundenen
// Konten holen, danach offene Umsätze automatisch zuordnen
// (Abbuchung → Eingangsrechnung, Zahlungseingang → Ausgangsrechnung).

const DAY = 86_400_000;
const today = () => new Date().toISOString().slice(0, 10);
const daysAgo = (days: number) => new Date(Date.now() - days * DAY).toISOString().slice(0, 10);

/** Bevorzugter Saldo: gebuchter Tagesendsaldo vor vorläufigen/verfügbaren */
const BALANCE_ORDER = ["CLBD", "ITBD", "XPCD", "ITAV", "CLAV", "OPBD", "PRCD"];

function pickBalance(list: EbBalance[]) {
  return [...list].sort((a, b) => {
    const ia = BALANCE_ORDER.indexOf(a.balance_type);
    const ib = BALANCE_ORDER.indexOf(b.balance_type);
    return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib);
  })[0];
}

function toRow(accountId: string, accountKey: string, tx: EbTransaction) {
  const debit = tx.credit_debit_indicator === "DBIT";
  const amount = Math.abs(Number(tx.transaction_amount.amount)) * (debit ? -1 : 1);
  return {
    account_id: accountId,
    ref: transactionRef(accountKey, tx),
    booking_date: tx.booking_date ?? tx.value_date ?? tx.transaction_date ?? today(),
    value_date: tx.value_date ?? null,
    amount: Math.round(amount * 100) / 100,
    currency: tx.transaction_amount.currency || "EUR",
    counterparty: (debit ? tx.creditor?.name : tx.debtor?.name) || null,
    counterparty_iban: (debit ? tx.creditor_account?.iban : tx.debtor_account?.iban) || null,
    purpose: (tx.remittance_information ?? []).join(" ").replace(/\s+/g, " ").trim() || null,
    raw: tx,
  };
}

// ---------- Verbinden ----------

/** Rückkehr von der Bank: Sitzung anlegen, Konten speichern. Ein schon
 * bekanntes Konto (gleiche IBAN, z. B. nach Ablauf der Freigabe) wird
 * weitergeführt, seine Umsätze bleiben. */
export async function connect(code: string) {
  const session = await createSession(code);
  if (!session.accounts.length) throw new BankError("Die Bank hat keine Konten freigegeben");
  const store = db();
  const existing = await store.list("bank_accounts");
  const saved: Row[] = [];
  for (const a of session.accounts) {
    const iban = a.account_id?.iban ?? null;
    const row = {
      uid: a.uid,
      session_id: session.session_id,
      aspsp: session.aspsp.name,
      iban,
      name: a.name || a.product || null,
      currency: a.currency || "EUR",
      valid_until: session.access.valid_until,
      active: true,
      error: null,
    };
    const known = existing.find((r) => (iban && r.iban === iban) || r.uid === a.uid);
    saved.push(known ? await store.update("bank_accounts", known.id, row) : await store.insert("bank_accounts", row));
  }
  return saved;
}

/** Konto trennen: Freigabe bei der Bank beenden, Umsätze bleiben. */
export async function disconnect(accountId: string) {
  const store = db();
  const account = await store.get("bank_accounts", accountId);
  if (!account) throw new BankError("Konto nicht gefunden");
  const others = (await store.list("bank_accounts", { active: "true" })).filter((r) => r.id !== accountId && r.session_id === account.session_id);
  if (!others.length) await deleteSession(String(account.session_id)).catch((error) => console.error(error));
  return store.update("bank_accounts", accountId, { active: false });
}

// ---------- Abgleich ----------

/** psu: nur beim Abgleich auf Knopfdruck (Person sitzt davor) */
export async function syncBank(psu?: Psu): Promise<BankSync> {
  const store = db();
  const accounts = await store.list("bank_accounts", { active: "true" });
  const errors: string[] = [];
  let created = 0;

  for (const account of accounts) {
    const label = String(account.name ?? account.iban ?? account.uid);
    if (account.valid_until && new Date(String(account.valid_until)) < new Date()) {
      const error = "Freigabe abgelaufen – bitte neu verbinden";
      await store.update("bank_accounts", account.id, { error });
      errors.push(`${label}: ${error}`);
      continue;
    }
    try {
      const uid = String(account.uid);
      const balance = pickBalance(await balances(uid, psu));

      // Ab dem letzten gebuchten Tag (mit Puffer für Nachbuchungen), beim
      // ersten Mal 90 Tage (mehr geben Banken ohne neue TAN meist nicht her)
      const known = await store.list("bank_transactions", { account_id: account.id });
      const latest = known.reduce((max, t) => (String(t.booking_date) > max ? String(t.booking_date) : max), "");
      const from = latest ? new Date(new Date(latest).getTime() - 7 * DAY).toISOString().slice(0, 10) : daysAgo(90);
      const booked = (await transactions(uid, from, psu)).filter((t) => !t.status || t.status === "BOOK");
      // Schlüssel über die IBAN, damit eine neue Freigabe nichts doppelt anlegt
      const accountKey = String(account.iban ?? uid);
      const inserted = await store.upsert("bank_transactions", booked.map((t) => toRow(account.id, accountKey, t)), "ref", true);
      created += inserted.length;

      await store.update("bank_accounts", account.id, {
        balance: balance ? Number(balance.balance_amount.amount) : null,
        balance_type: balance?.balance_type ?? null,
        balance_at: new Date().toISOString(),
        synced_at: new Date().toISOString(),
        currency: balance?.balance_amount.currency ?? account.currency,
        error: null,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error(error);
      await store.update("bank_accounts", account.id, { error: message.slice(0, 500) });
      errors.push(`${label}: ${message}`);
    }
  }

  const matched = await matchOpen(errors);
  const result: BankSync = { at: new Date().toISOString(), accounts: accounts.length, created, matched, errors };
  await store.setSetting("bank_sync", result);
  return result;
}

// ---------- Zuordnen ----------

/** Eingangsrechnungen ohne Bankumsatz (nicht abgelehnt). Auch die von Hand
 * als bezahlt markierten (Karte, Lastschrift), deren Abbuchung fehlt noch. */
export async function openPayables(): Promise<OpenItem[]> {
  const invoices = await db().list("invoices");
  return invoices
    .filter((i) => i.stage !== "abgelehnt" && !i.bank_transaction_id && i.amount != null)
    .map((i) => ({
      id: i.id,
      kind: "invoice" as const,
      number: (i.invoice_number as string | null) ?? null,
      name: String(i.vendor),
      amount: Math.abs(Number(i.amount)),
      date: (i.invoice_date as string | null) ?? null,
      due_date: (i.due_date as string | null) ?? null,
      currency: (i.currency as string | null) ?? "EUR",
    }));
}

/** Abbuchungen der letzten 180 Tage den offenen Eingangsrechnungen zuordnen.
 * Läuft beim Bank-Abgleich und sobald eine Rechnung ausgelesen wurde. */
export async function matchPayables() {
  const since = daysAgo(180);
  const debits = (await db().list("bank_transactions"))
    .filter((t) => isOpen(t as unknown as BankTransaction) && String(t.booking_date) >= since && Number(t.amount) < 0)
    .map((t) => t as unknown as BankTransaction & Row);
  let payables = await openPayables();
  let matched = 0;
  for (const tx of debits) {
    // Betrag allein reicht nur, wenn er unter den offenen Rechnungen und
    // Umsätzen jeweils genau einmal vorkommt
    const uniqueAmount = (item: OpenItem) =>
      payables.filter((p) => Math.abs(p.amount - item.amount) < 0.005).length === 1 &&
      debits.filter((d) => isOpen(d) && Math.abs(Math.abs(d.amount) - item.amount) < 0.005).length === 1;
    const item = autoMatch(tx, payables, uniqueAmount);
    if (!item) continue;
    await assignInvoice(tx, item.id, "automatisch");
    tx.match_type = "invoice";
    tx.invoice_id = item.id;
    payables = payables.filter((p) => p.id !== item.id);
    matched++;
  }
  return matched;
}

/** Offene Umsätze der letzten 180 Tage automatisch zuordnen */
async function matchOpen(errors: string[]) {
  const store = db();
  const since = daysAgo(180);
  const open = (await store.list("bank_transactions"))
    .filter((t) => isOpen(t as unknown as BankTransaction) && String(t.booking_date) >= since)
    .map((t) => t as unknown as BankTransaction & Row);
  const matched = { invoices: await matchPayables(), receivables: 0 };

  const credits = open.filter((t) => t.amount > 0);
  if (credits.length) {
    try {
      let receivables = await openReceivables();
      for (const tx of credits) {
        const item = autoMatch(tx, receivables);
        if (!item) continue;
        await assignReceivable(tx, item, "automatisch");
        receivables = receivables.filter((r) => r.id !== item.id);
        matched.receivables++;
      }
    } catch (error) {
      console.error(error);
      errors.push(`Ausgangsrechnungen: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  return matched;
}

const stamp = (by: string) => ({ matched_by: by, matched_at: new Date().toISOString() });

export async function assignInvoice(tx: BankTransaction, invoiceId: string, by: string) {
  const store = db();
  const invoice = await store.get("invoices", invoiceId);
  if (!invoice) throw new BankError("Rechnung nicht gefunden");
  if (invoice.bank_transaction_id && invoice.bank_transaction_id !== tx.id) throw new BankError("Die Rechnung ist schon einem anderen Umsatz zugeordnet");
  await store.update("invoices", invoiceId, { paid: true, paid_at: tx.booking_date, bank_transaction_id: tx.id });
  return store.update("bank_transactions", tx.id, { match_type: "invoice", invoice_id: invoiceId, ...stamp(by) });
}

export async function assignReceivable(tx: BankTransaction, item: OpenItem, by: string) {
  if (tx.amount <= 0) throw new BankError("Nur Zahlungseingänge gehören zu Ausgangsrechnungen");
  const paymentId = await addReceivablePayment(item.id, Math.min(tx.amount, item.amount), tx.booking_date, [tx.counterparty, tx.purpose].filter(Boolean).join(" · "));
  return db().update("bank_transactions", tx.id, {
    match_type: "receivable",
    billing_document_id: item.id,
    billing_number: item.number,
    billing_payment_id: paymentId,
    ...stamp(by),
  });
}

export function ignore(tx: BankTransaction, by: string) {
  return db().update("bank_transactions", tx.id, { match_type: "ignored", ...stamp(by) });
}

/** Zuordnung lösen: Eingangsrechnung wieder offen bzw. Zahlung der Ausgangsrechnung löschen */
export async function clearMatch(tx: BankTransaction) {
  const store = db();
  if (tx.match_type === "invoice" && tx.invoice_id) {
    const invoice = await store.get("invoices", tx.invoice_id);
    if (invoice?.bank_transaction_id === tx.id) await store.update("invoices", tx.invoice_id, { paid: false, paid_at: null, bank_transaction_id: null });
  }
  if (tx.match_type === "receivable" && tx.billing_payment_id && tx.billing_document_id) {
    await removeReceivablePayment(tx.billing_payment_id, tx.billing_document_id);
  }
  return store.update("bank_transactions", tx.id, {
    match_type: null,
    invoice_id: null,
    billing_document_id: null,
    billing_number: null,
    billing_payment_id: null,
    matched_by: null,
    matched_at: null,
  });
}
