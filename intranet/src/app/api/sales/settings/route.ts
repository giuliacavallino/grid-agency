import { DEFAULT_BILLING_SETTINGS, type BillingSettings } from "@/lib/billing";
import { withUser } from "@/lib/server/auth";
import { billingSettings, contractTemplate } from "@/lib/server/billing";
import type { ContractTemplate } from "@/lib/contract";
import { db } from "@/lib/server/db";

const DEFAULT_CAPACITY = { team_hours_per_month: 480 };
const DEFAULT_DATEV = { upload_address: "" };

export const GET = withUser(async () => {
  const store = db();
  const capacity = (await store.getSetting("capacity")) ?? DEFAULT_CAPACITY;
  const datev = (await store.getSetting("datev")) ?? DEFAULT_DATEV;
  return Response.json({
    capacity,
    datev,
    billing: await billingSettings(),
    contract: await contractTemplate(),
    grid_signature: await store.getSetting("grid_signature"),
  });
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

  if (body?.contract !== undefined) {
    const contract = body.contract as ContractTemplate;
    const sections = Array.isArray(contract?.sections)
      ? contract.sections
          .map((s) => ({ heading: String(s?.heading ?? "").trim().slice(0, 200), body: String(s?.body ?? "").trim().slice(0, 20_000) }))
          .filter((s) => s.heading && s.body)
      : [];
    if (!sections.length) return Response.json({ error: "Der Vertrag braucht mindestens einen Abschnitt" }, { status: 400 });
    await store.setSetting("contract", { title: String(contract.title ?? "Agenturvertrag").trim().slice(0, 120) || "Agenturvertrag", sections });
  }

  // Gespeicherte Unterschrift für GRID (zum Wiederverwenden beim Versand)
  if (body?.grid_signature !== undefined) {
    const sig = body.grid_signature as { signer?: string; image?: string } | null;
    if (sig && !(typeof sig.image === "string" && /^data:image\/png;base64,/.test(sig.image) && sig.image.length < 400_000)) {
      return Response.json({ error: "Ungültige Unterschrift" }, { status: 400 });
    }
    await store.setSetting("grid_signature", sig ? { signer: String(sig.signer ?? "").slice(0, 120), image: sig.image } : null);
  }

  return Response.json({
    capacity: result.capacity ?? (await store.getSetting("capacity")) ?? DEFAULT_CAPACITY,
    datev: result.datev ?? (await store.getSetting("datev")) ?? DEFAULT_DATEV,
    billing: await billingSettings(),
    contract: await contractTemplate(),
    grid_signature: await store.getSetting("grid_signature"),
  });
});
