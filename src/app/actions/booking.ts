"use server";

export type Slot = { start: string; end: string };

export type BookingRequest = {
  start: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  company: string;
  street: string;
  number: string;
  zip: string;
  city: string;
  country: string;
  message: string;
  /** Honeypot */
  website: string;
};

export type BookingResult = { ok: true; slot: Slot } | { ok: false; message: string; taken?: boolean };

// Freie Zeiten und Buchung kommen vom Intranet (Kalender von Giulia und
// hello@, Lead in der Sales-Pipeline). Der Browser spricht nur mit unserer
// Domain; die Anfrage ans Intranet läuft hier auf dem Server.
const API = `${process.env.INTRANET_URL ?? "https://intranet.grid-agency.de"}/api/public/booking`;

const FAILED = "Buchen hat gerade nicht geklappt. Schreib uns sonst einfach eine Nachricht.";

/** Freie Erstgespräch-Zeiten; null, wenn der Kalender gerade nicht erreichbar ist. */
export async function getSlots(): Promise<Slot[] | null> {
  try {
    const res = await fetch(API, { cache: "no-store", signal: AbortSignal.timeout(8000) });
    if (!res.ok) return null;
    return ((await res.json()) as { slots: Slot[] }).slots;
  } catch {
    return null;
  }
}

export async function bookSlot(input: BookingRequest): Promise<BookingResult> {
  const field = (value: unknown) => String(value ?? "").trim();
  const name = [field(input.firstName), field(input.lastName)].filter(Boolean).join(" ");
  if (!field(input.start)) return { ok: false, message: "Such dir bitte zuerst eine Uhrzeit aus." };
  if (!name || !field(input.email)) return { ok: false, message: "Bitte gib Name und E-Mail an." };

  try {
    const res = await fetch(API, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        start: field(input.start),
        name,
        email: field(input.email),
        phone: field(input.phone),
        company: field(input.company),
        street: field(input.street),
        number: field(input.number),
        zip: field(input.zip),
        city: field(input.city),
        country: field(input.country),
        message: field(input.message),
        website: field(input.website),
      }),
      signal: AbortSignal.timeout(20000),
    });
    const data = (await res.json().catch(() => ({}))) as { slot?: Slot; error?: string };
    if (!res.ok || !data.slot) return { ok: false, message: data.error ?? FAILED, taken: res.status === 409 };
    return { ok: true, slot: data.slot };
  } catch {
    return { ok: false, message: FAILED };
  }
}
