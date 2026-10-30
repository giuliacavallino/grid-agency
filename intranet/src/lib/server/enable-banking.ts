import "server-only";
import { createHash, createPrivateKey, randomBytes, type KeyObject } from "node:crypto";
import { SignJWT } from "jose";
import { DEMO } from "@/lib/config";
import { demoEnableBanking } from "./enable-banking-demo";

// Enable Banking (PSD2-Kontozugriff): Die App „GRID Intranet“ im Enable-
// Banking-Control-Panel hat einen RSA-Schlüssel; jede Anfrage trägt ein damit
// signiertes JWT. Die Bank fragt beim Verbinden einmal Login und photoTAN ab,
// danach gilt die Freigabe bis valid_until (Commerzbank: bis 180 Tage).

const API = "https://api.enablebanking.com";

export class BankError extends Error {}

export type Aspsp = {
  name: string;
  country: string;
  logo?: string;
  psu_types: ("business" | "personal")[];
  maximum_consent_validity?: number;
};

export type EbAccount = {
  uid: string;
  account_id?: { iban?: string } | null;
  name?: string | null;
  product?: string | null;
  currency?: string | null;
};

export type EbSession = {
  session_id: string;
  accounts: EbAccount[];
  aspsp: { name: string; country: string };
  access: { valid_until: string };
};

type Amount = { currency: string; amount: string };

export type EbBalance = { name?: string; balance_amount: Amount; balance_type: string; reference_date?: string | null };

export type EbTransaction = {
  entry_reference?: string | null;
  transaction_id?: string | null;
  transaction_amount: Amount;
  credit_debit_indicator: "CRDT" | "DBIT";
  status?: string | null;
  booking_date?: string | null;
  value_date?: string | null;
  transaction_date?: string | null;
  creditor?: { name?: string | null } | null;
  debtor?: { name?: string | null } | null;
  creditor_account?: { iban?: string | null } | null;
  debtor_account?: { iban?: string | null } | null;
  remittance_information?: string[] | null;
};

/** Angaben zur Person am Bildschirm (manueller Abgleich). Mit ihnen zählt
 * der Abruf nicht gegen das PSD2-Limit von 4 automatischen Abrufen am Tag. */
export type Psu = { ip: string; userAgent: string };

let key: KeyObject | null = null;

export const bankConfigured = () => DEMO || (!!process.env.ENABLE_BANKING_APP_ID && !!process.env.ENABLE_BANKING_PRIVATE_KEY);

async function jwt() {
  const appId = process.env.ENABLE_BANKING_APP_ID;
  const pem = process.env.ENABLE_BANKING_PRIVATE_KEY;
  if (!appId || !pem) throw new BankError("ENABLE_BANKING_APP_ID / ENABLE_BANKING_PRIVATE_KEY fehlen");
  // In Vercel steht der Schlüssel oft mit \n statt Zeilenumbrüchen
  key ??= createPrivateKey(pem.replace(/\\n/g, "\n"));
  return new SignJWT({})
    .setProtectedHeader({ alg: "RS256", typ: "JWT", kid: appId })
    .setIssuer("enablebanking.com")
    .setAudience("api.enablebanking.com")
    .setIssuedAt()
    .setExpirationTime("1h")
    .sign(key);
}

async function call<T>(method: "GET" | "POST" | "DELETE", path: string, body?: unknown, psu?: Psu): Promise<T> {
  if (DEMO) return demoEnableBanking(method, path, body) as T;
  const response = await fetch(`${API}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${await jwt()}`,
      Accept: "application/json",
      ...(body ? { "Content-Type": "application/json" } : {}),
      ...(psu ? { "Psu-Ip-Address": psu.ip, "Psu-User-Agent": psu.userAgent } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
    cache: "no-store",
  });
  if (!response.ok) {
    const text = await response.text();
    let message = text;
    try {
      const json = JSON.parse(text);
      message = json.message ?? json.error ?? text;
    } catch {}
    throw new BankError(`Enable Banking ${path}: ${response.status} ${message}`);
  }
  return response.status === 204 ? (undefined as T) : response.json();
}

/** Banken in Deutschland, die Enable Banking anbindet */
export async function banks() {
  const { aspsps } = await call<{ aspsps: Aspsp[] }>("GET", "/aspsps?country=DE");
  return aspsps;
}

/** Startet die Freigabe bei der Bank; liefert die URL zum Bank-Login. */
export async function startAuth(aspsp: Aspsp, psuType: "business" | "personal", redirectUrl: string) {
  const state = randomBytes(24).toString("base64url");
  const seconds = Math.min(aspsp.maximum_consent_validity ?? 90 * 86_400, 180 * 86_400);
  const { url } = await call<{ url: string }>("POST", "/auth", {
    access: { valid_until: new Date(Date.now() + seconds * 1000 - 60_000).toISOString() },
    aspsp: { name: aspsp.name, country: aspsp.country },
    state,
    redirect_url: redirectUrl,
    psu_type: psuType,
  });
  return { url, state };
}

/** Code aus der Rückleitung gegen eine Sitzung mit Konten tauschen */
export const createSession = (code: string) => call<EbSession>("POST", "/sessions", { code });

export const deleteSession = (id: string) => call<void>("DELETE", `/sessions/${encodeURIComponent(id)}`);

export async function balances(uid: string, psu?: Psu) {
  const { balances } = await call<{ balances: EbBalance[] }>("GET", `/accounts/${encodeURIComponent(uid)}/balances`, undefined, psu);
  return balances;
}

/** Alle Umsätze ab dateFrom (yyyy-mm-dd), seitenweise */
export async function transactions(uid: string, dateFrom: string, psu?: Psu) {
  const out: EbTransaction[] = [];
  let continuation: string | null = null;
  for (let page = 0; page < 50; page++) {
    const query = new URLSearchParams({ date_from: dateFrom });
    if (continuation) query.set("continuation_key", continuation);
    const result: { transactions: EbTransaction[]; continuation_key?: string | null } = await call(
      "GET",
      `/accounts/${encodeURIComponent(uid)}/transactions?${query}`,
      undefined,
      psu
    );
    out.push(...result.transactions);
    continuation = result.continuation_key ?? null;
    if (!continuation) break;
  }
  return out;
}

/** Stabiler Schlüssel je Umsatz (Banken liefern nicht immer eine Referenz) */
export function transactionRef(accountKey: string, tx: EbTransaction) {
  const id = tx.entry_reference || tx.transaction_id;
  if (id) return `${accountKey}:${id}`;
  const fingerprint = [
    tx.booking_date,
    tx.value_date,
    tx.credit_debit_indicator,
    tx.transaction_amount.amount,
    tx.creditor?.name,
    tx.debtor?.name,
    (tx.remittance_information ?? []).join(" "),
  ].join("|");
  return `${accountKey}:h:${createHash("sha256").update(fingerprint).digest("hex").slice(0, 32)}`;
}
