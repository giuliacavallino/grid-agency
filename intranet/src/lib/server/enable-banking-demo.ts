import "server-only";

// Beispielantworten von Enable Banking für die lokale Vorschau: ein
// Commerzbank-Geschäftskonto mit Umsätzen, die teils zu den Beispiel-
// Eingangsrechnungen und den Beispiel-Ausgangsrechnungen passen.

const day = (offset: number) => new Date(Date.now() + offset * 86_400_000).toISOString().slice(0, 10);

const tx = (offset: number, amount: number, name: string, purpose: string, iban = "DE89370400440532013000") => ({
  entry_reference: `demo-${offset}-${amount}`,
  transaction_amount: { currency: "EUR", amount: Math.abs(amount).toFixed(2) },
  credit_debit_indicator: amount < 0 ? "DBIT" : "CRDT",
  status: "BOOK",
  booking_date: day(offset),
  value_date: day(offset),
  ...(amount < 0
    ? { creditor: { name }, creditor_account: { iban } }
    : { debtor: { name }, debtor_account: { iban } }),
  remittance_information: [purpose],
});

const transactions = [
  tx(0, -89.24, "Adobe Systems Software Ireland Ltd", "IE-2026-118422 Creative Cloud"),
  tx(-1, 2963.1, "Baeckerei Huck", "RE-2026-101 Social Media Oktober"),
  tx(-2, -1428, "Steffen Video", "Rechnung 2026-041"),
  tx(-3, -54.9, "Telekom Deutschland GmbH", "Kundennr. 55120034 Mobilfunk"),
  tx(-4, 3213, "Casualfood GmbH", "Zahlung Oktober"),
  tx(-6, -2100, "Finanzamt Frankfurt", "USt-VZ 09/2026"),
  tx(-8, -119.99, "Canva Pty Ltd", "Canva Teams"),
  tx(-10, -3450, "Max Muster", "Gehalt Oktober"),
  tx(-14, -1250, "Hausverwaltung Ost", "Miete Büro November"),
  tx(-21, 1774.1, "Frittenwerk GmbH", "RE-2026-094"),
];

export function demoEnableBanking(method: string, path: string, body: unknown): unknown {
  if (path.startsWith("/aspsps")) {
    return {
      aspsps: [
        { name: "Commerzbank", country: "DE", psu_types: ["business", "personal"], maximum_consent_validity: 15_552_000 },
        { name: "Deutsche Bank", country: "DE", psu_types: ["business", "personal"], maximum_consent_validity: 7_776_000 },
        { name: "Sparkasse", country: "DE", psu_types: ["personal"], maximum_consent_validity: 7_776_000 },
      ],
    };
  }
  if (path === "/auth") {
    const { state } = body as { state: string };
    return { url: `/api/finance/bank/callback?code=demo&state=${encodeURIComponent(state)}` };
  }
  if (path === "/sessions" && method === "POST") {
    return {
      session_id: "demo-session",
      aspsp: { name: "Commerzbank", country: "DE" },
      access: { valid_until: new Date(Date.now() + 180 * 86_400_000).toISOString() },
      accounts: [{ uid: "demo-account", account_id: { iban: "DE23500400000123456789" }, name: "GRID AGENCY UG", product: "Geschäftskonto", currency: "EUR" }],
    };
  }
  if (path.endsWith("/balances")) {
    return { balances: [{ balance_type: "CLBD", balance_amount: { currency: "EUR", amount: "24817.36" }, reference_date: day(0) }] };
  }
  if (path.includes("/transactions")) return { transactions, continuation_key: null };
  return {};
}
