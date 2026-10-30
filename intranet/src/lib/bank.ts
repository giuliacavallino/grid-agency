// Bank (Finance): Typen und Zuordnung von Umsätzen zu offenen Rechnungen.
// Läuft auf dem Server (automatischer Abgleich) und im Browser (Vorschläge).

export type BankAccount = {
  id: string;
  created_at: string;
  uid: string;
  aspsp: string;
  iban: string | null;
  name: string | null;
  currency: string;
  balance: number | null;
  balance_type: string | null;
  balance_at: string | null;
  valid_until: string | null;
  synced_at: string | null;
  active: boolean;
  error: string | null;
};

export type MatchType = "invoice" | "easybill" | "ignored";

export type BankTransaction = {
  id: string;
  account_id: string;
  booking_date: string;
  value_date: string | null;
  amount: number;
  currency: string;
  counterparty: string | null;
  counterparty_iban: string | null;
  purpose: string | null;
  match_type: MatchType | null;
  invoice_id: string | null;
  easybill_document_id: number | null;
  easybill_number: string | null;
  easybill_payment_id: number | null;
  matched_by: string | null;
  matched_at: string | null;
  note: string | null;
};

export type BankSync = {
  at: string;
  accounts: number;
  created: number;
  matched: { invoices: number; easybill: number };
  errors: string[];
};

/** Offene Rechnung, der ein Umsatz zugeordnet werden kann: Eingangsrechnung
 * (Abbuchung) oder Ausgangsrechnung aus easybill (Zahlungseingang). */
export type OpenItem = {
  id: string;
  kind: "invoice" | "easybill";
  number: string | null;
  name: string;
  /** Offener Betrag brutto, immer positiv */
  amount: number;
  date: string | null;
  due_date: string | null;
  /** Währung der Rechnung; bei Fremdwährung passt der Betrag nie genau */
  currency?: string;
};

/** Umsatz noch ohne Zuordnung? (Eine gelöschte Eingangsrechnung gibt ihn frei.) */
export const isOpen = (tx: Pick<BankTransaction, "match_type" | "invoice_id">) =>
  !tx.match_type || (tx.match_type === "invoice" && !tx.invoice_id);

const flat = (text: string | null | undefined) =>
  (text ?? "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/ß/g, "ss").replace(/[^a-z0-9]/g, "");

const STOP = new Set(["gmbh", "mbh", "ag", "ug", "kg", "co", "ohg", "gbr", "se", "inc", "ltd", "llc", "limited", "und", "the", "eu", "ireland", "deutschland", "germany", "haftungsbeschraenkt", "systems", "services"]);

/** Rechnungsnummer im Verwendungszweck? Auch ohne Präfix („RE-2026-101“ → „2026101“). */
function numberIn(number: string | null, text: string) {
  const full = flat(number);
  if (full.length < 4) return false;
  const bare = full.replace(/^[a-z]+/, "");
  return text.includes(full) || (bare.length >= 4 && bare !== full && text.includes(bare));
}

/** Name (Rechnungssteller bzw. Kunde) bei Gegenpartei oder im Verwendungszweck? */
function nameIn(name: string, text: string) {
  const words = name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .split(/[^a-z0-9]+/)
    .filter((w) => w.length >= 3 && !STOP.has(w));
  return words.some((w) => text.includes(w));
}

const sameAmount = (a: number, b: number) => Math.abs(Math.abs(a) - Math.abs(b)) < 0.005;

type Scored = { item: OpenItem; score: number; amount: boolean; number: boolean; name: boolean };

function rate(tx: BankTransaction, item: OpenItem): Scored {
  const text = flat(`${tx.counterparty ?? ""} ${tx.purpose ?? ""}`);
  const amount = sameAmount(tx.amount, item.amount);
  const number = numberIn(item.number, text);
  const name = nameIn(item.name, text);
  return { item, amount, number, name, score: (amount ? 50 : 0) + (number ? 35 : 0) + (name ? 15 : 0) };
}

/** Passende Kinds: Abbuchung → Eingangsrechnung, Eingang → easybill */
const fits = (tx: BankTransaction, item: OpenItem) => (tx.amount < 0 ? item.kind === "invoice" : item.kind === "easybill");

/** Vorschläge, beste zuerst (mindestens Betrag, Nummer oder Name passt). */
export function suggestions(tx: BankTransaction, items: OpenItem[]) {
  return items
    .filter((item) => fits(tx, item))
    .map((item) => rate(tx, item))
    .filter((s) => s.score > 0)
    .sort((a, b) => b.score - a.score);
}

const day = 86_400_000;
const shift = (date: string, days: number) => new Date(new Date(`${date}T12:00:00Z`).getTime() + days * day).toISOString().slice(0, 10);

/** Buchung im plausiblen Zeitraum der Rechnung: kurz vor dem Rechnungsdatum
 * (Kartenzahlung, Vorkasse) bis einige Wochen nach der Fälligkeit. */
function inWindow(tx: BankTransaction, item: OpenItem, before = 7, after = 45) {
  const start = item.date ?? item.due_date;
  if (!start) return true;
  const end = item.due_date && item.due_date > start ? item.due_date : start;
  return tx.booking_date >= shift(start, -before) && tx.booking_date <= shift(end, after);
}

/** Eindeutiger Treffer für den automatischen Abgleich, in dieser Reihenfolge:
 * 1. Betrag und Rechnungsnummer im Verwendungszweck
 * 2. Rechnungsnummer allein (Eingangsrechnungen; Betrag weicht z. B. durch Skonto ab)
 * 3. Betrag und Name im passenden Zeitraum (Eingangsrechnungen)
 * 4. Fremdwährung: Name und Buchung nah am Rechnungsdatum
 * 5. Betrag allein, wenn er nur bei dieser Rechnung und nur bei diesem Umsatz
 *    vorkommt (uniqueAmount) und der Zeitraum passt.
 * Mehrere Treffer in einer Stufe → keine Zuordnung, lieber von Hand. */
export function autoMatch(tx: BankTransaction, items: OpenItem[], uniqueAmount?: (item: OpenItem) => boolean) {
  const all = suggestions(tx, items);
  const one = (hits: Scored[]) => (hits.length === 1 ? hits[0].item : null);
  const invoice = (s: Scored) => s.item.kind === "invoice";
  const foreign = (s: Scored) => !!s.item.currency && s.item.currency !== tx.currency;
  return (
    one(all.filter((s) => s.amount && s.number)) ??
    one(all.filter((s) => invoice(s) && s.number)) ??
    one(all.filter((s) => invoice(s) && s.amount && s.name && inWindow(tx, s.item))) ??
    one(all.filter((s) => invoice(s) && foreign(s) && s.name && inWindow(tx, s.item, 3, 10))) ??
    (uniqueAmount ? one(all.filter((s) => invoice(s) && s.amount && !foreign(s) && inWindow(tx, s.item, 3, 30) && uniqueAmount(s.item))) : null)
  );
}

/** IBAN in Vierergruppen, Mitte gekürzt: DE23 •••• 1234 */
export const maskIban = (iban: string | null) =>
  iban ? `${iban.slice(0, 4)} •••• ${iban.slice(-4)}` : "–";
