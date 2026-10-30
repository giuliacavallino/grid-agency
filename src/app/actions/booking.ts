"use server";

export type Slot = { start: string; end: string };

export type BookingState = {
  status: "idle" | "success" | "error";
  message?: string;
  slot?: Slot & { url?: string | null };
};

// Freie Zeiten und Buchung kommen vom Intranet (Kalender von Giulia und
// hello@, Lead in der Sales-Pipeline). Der Browser spricht nur mit unserer
// Domain; die Anfrage ans Intranet läuft hier auf dem Server.
const API = `${process.env.INTRANET_URL ?? "https://intranet.grid-agency.de"}/api/public/booking`;

export type BookingInfo = {
  slots: Slot[];
  /** Mit Einladungslink: Dauer, bekannte Angaben, ggf. schon gebuchter Termin */
  minutes?: number;
  prefill?: { name: string; email: string; company: string } | null;
  booked?: { start: string; url: string | null } | null;
  error?: string;
};

/** Freie Zeiten (Erstgespräch, mit Link auch Kick-off); null, wenn der
 * Kalender gerade nicht erreichbar ist. */
export async function getSlots(kind: "erstgespraech" | "kickoff" = "erstgespraech", token: string | null = null): Promise<BookingInfo | null> {
  const params = new URLSearchParams({ ...(token ? { l: token } : {}), ...(kind === "kickoff" ? { art: "kickoff" } : {}) });
  try {
    const res = await fetch(`${API}${params.size ? `?${params}` : ""}`, { cache: "no-store", signal: AbortSignal.timeout(8000) });
    const data = (await res.json().catch(() => ({}))) as BookingInfo;
    if (res.status === 400) return { slots: [], error: data.error };
    if (!res.ok) return null;
    return data;
  } catch {
    return null;
  }
}

export async function bookSlot(_prev: BookingState, formData: FormData): Promise<BookingState> {
  const field = (name: string) => String(formData.get(name) ?? "").trim();
  if (!field("start")) return { status: "error", message: "Such dir bitte zuerst eine Uhrzeit aus." };
  if (!field("name") || !field("email")) {
    return { status: "error", message: "Bitte gib Name und E-Mail an." };
  }

  try {
    const res = await fetch(API, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        start: field("start"),
        name: field("name"),
        email: field("email"),
        company: field("company"),
        phone: field("phone"),
        message: field("message"),
        website: field("website"),
        token: field("token"),
        kind: field("kind"),
        altcha: field("altcha"),
      }),
      signal: AbortSignal.timeout(20000),
    });
    const data = (await res.json().catch(() => ({}))) as { slot?: Slot; error?: string };
    if (!res.ok) {
      return { status: "error", message: data.error ?? "Buchen hat gerade nicht geklappt. Schreib uns sonst einfach eine Nachricht." };
    }
    return { status: "success", slot: data.slot };
  } catch {
    return { status: "error", message: "Buchen hat gerade nicht geklappt. Schreib uns sonst einfach eine Nachricht." };
  }
}

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
  /** Lösung des Captchas (ALTCHA) */
  altcha: string;
  /** Honeypot */
  website: string;
};

export type BookingResult =
  | { ok: true; slot: Slot & { url?: string | null } }
  | { ok: false; message: string; taken?: boolean };

/** Buchung aus dem Erstgespräch-Popup: Ansprechpartner, Firma mit
 * Anschrift und Termin in einem Rutsch. */
export async function bookRequest(input: BookingRequest): Promise<BookingResult> {
  const field = (value: unknown) => String(value ?? "").trim();
  const name = [field(input.firstName), field(input.lastName)].filter(Boolean).join(" ");
  const failed = "Buchen hat gerade nicht geklappt. Schreib uns sonst einfach eine Nachricht.";
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
        altcha: field(input.altcha),
        kind: "erstgespraech",
      }),
      signal: AbortSignal.timeout(20000),
    });
    const data = (await res.json().catch(() => ({}))) as { slot?: Slot & { url?: string | null }; error?: string };
    if (!res.ok || !data.slot) return { ok: false, message: data.error ?? failed, taken: res.status === 409 };
    return { ok: true, slot: data.slot };
  } catch {
    return { ok: false, message: failed };
  }
}
