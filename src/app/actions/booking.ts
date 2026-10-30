"use server";

export type Slot = { start: string; end: string };

export type BookingState = {
  status: "idle" | "success" | "error";
  message?: string;
  slot?: Slot;
};

// Freie Zeiten und Buchung kommen vom Intranet (Kalender von Giulia und
// hello@, Lead in der Sales-Pipeline). Der Browser spricht nur mit unserer
// Domain; die Anfrage ans Intranet läuft hier auf dem Server.
const API = `${process.env.INTRANET_URL ?? "https://intranet.grid-agency.de"}/api/public/booking`;

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
