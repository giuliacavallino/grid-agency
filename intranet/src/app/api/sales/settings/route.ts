import { DEFAULT_BILLING_SETTINGS, type BillingSettings } from "@/lib/billing";
import { withUser } from "@/lib/server/auth";
import { billingSettings } from "@/lib/server/billing";
import { db } from "@/lib/server/db";

const DEFAULT_CAPACITY = { team_hours_per_month: 480 };
const DEFAULT_DATEV = { upload_address: "" };

export const GET = withUser(async () => {
  const store = db();
  const capacity = (await store.getSetting("capacity")) ?? DEFAULT_CAPACITY;
  const datev = (await store.getSetting("datev")) ?? DEFAULT_DATEV;
  return Response.json({ capacity, datev, billing: await billingSettings() });
});

/** Nur bekannte Felder als Text übernehmen */
function cleanBilling(input: Partial<BillingSettings>): BillingSettings {
  const text = (value: unknown, fallback: string) => (typeof value === "string" ? value.trim().slice(0, 2000) : fallback);
  const company = Object.fromEntries(
    Object.entries(DEFAULT_BILLING_SETTINGS.company).map(([key, fallback]) => [key, text(input.company?.[key as keyof BillingSettings["company"]], fallback)])
  ) as BillingSettings["company"];
  const terms = Math.round(Number(input.payment_terms_days));
  return {
    company,
    payment_terms_days: Number.isFinite(terms) && terms >= 0 && terms <= 365 ? terms : DEFAULT_BILLING_SETTINGS.payment_terms_days,
    intro: text(input.intro, DEFAULT_BILLING_SETTINGS.intro),
    closing: text(input.closing, DEFAULT_BILLING_SETTINGS.closing),
    mail_subject: text(input.mail_subject, DEFAULT_BILLING_SETTINGS.mail_subject),
    mail_body: text(input.mail_body, DEFAULT_BILLING_SETTINGS.mail_body),
  };
}

/** Im Browser änderbar: Teamkapazität, DATEV-Upload-Adresse, Firmendaten und Texte der Rechnungen. */
export const PUT = withUser(async (_user, request) => {
  const body = await request.json();
  const store = db();
  const result: Record<string, unknown> = {};

  if (body?.capacity !== undefined) {
    const hours = Number(body.capacity?.team_hours_per_month);
    if (!Number.isFinite(hours) || hours < 0 || hours > 100_000) {
      return Response.json({ error: "Ungültige Kapazität" }, { status: 400 });
    }
    result.capacity = { team_hours_per_month: Math.round(hours) };
    await store.setSetting("capacity", result.capacity);
  }

  if (body?.datev !== undefined) {
    const address = String(body.datev?.upload_address ?? "").trim().toLowerCase();
    if (address && !/^[^\s@]+@uploadmail\.datev\.de$/.test(address)) {
      return Response.json({ error: "Bitte eine Adresse …@uploadmail.datev.de eintragen" }, { status: 400 });
    }
    result.datev = { upload_address: address };
    await store.setSetting("datev", result.datev);
  }

  if (body?.billing !== undefined) {
    const billing = cleanBilling(body.billing ?? {});
    if (!billing.company.name || !billing.company.iban) {
      return Response.json({ error: "Firmenname und IBAN sind Pflicht" }, { status: 400 });
    }
    await store.setSetting("billing", billing);
  }

  return Response.json({
    capacity: result.capacity ?? (await store.getSetting("capacity")) ?? DEFAULT_CAPACITY,
    datev: result.datev ?? (await store.getSetting("datev")) ?? DEFAULT_DATEV,
    billing: await billingSettings(),
  });
});
