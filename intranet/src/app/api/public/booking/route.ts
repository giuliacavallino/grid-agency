import { CaptchaError, verifyAltcha } from "@/lib/server/altcha";
import { book, freeSlots } from "@/lib/server/booking";
import { bookingView, bookWithLink, FlowError, type MeetingKind } from "@/lib/server/lead-flow";

// Öffentlich (ohne Login): Die Website holt hierüber serverseitig freie
// Zeiten und bucht Erstgespräche. Mit Einladungslink (?l=…) gehört die
// Buchung zu einem bestehenden Lead, mit art=kickoff ist es der Kick-off
// nach der Unterschrift. Jede Buchung prüft Captcha und Kalender erneut.

export const maxDuration = 30;

const kindOf = (value: unknown): MeetingKind => (value === "kickoff" ? "kickoff" : "erstgespraech");

export async function GET(request: Request) {
  const search = new URL(request.url).searchParams;
  const token = search.get("l");
  const kind = kindOf(search.get("art"));
  try {
    if (token || kind === "kickoff") return Response.json(await bookingView(kind, token), { headers: { "Cache-Control": "no-store" } });
    return Response.json({ slots: await freeSlots() }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    if (error instanceof FlowError) return Response.json({ error: error.message }, { status: 400 });
    console.error("Buchung: freie Zeiten", error);
    return Response.json({ error: "Kalender gerade nicht erreichbar" }, { status: 503 });
  }
}

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const text = (value: unknown, max: number) => String(value ?? "").trim().slice(0, max);

export async function POST(request: Request) {
  const input = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  if (!input) return Response.json({ error: "Ungültige Anfrage" }, { status: 400 });
  // Honeypot: nur Bots füllen das versteckte Feld aus
  if (text(input.website, 200)) return Response.json({ ok: true });

  const booking = {
    start: text(input.start, 40),
    name: text(input.name, 120),
    email: text(input.email, 200),
    company: text(input.company, 160),
    phone: text(input.phone, 60),
    message: text(input.message, 4000),
    address: {
      street: text(input.street, 160),
      number: text(input.number, 20),
      zip: text(input.zip, 20),
      city: text(input.city, 120),
      country: text(input.country, 80),
    },
  };
  const token = text(input.token, 80);
  if (!booking.name || !EMAIL.test(booking.email) || Number.isNaN(Date.parse(booking.start))) {
    return Response.json({ error: "Bitte Name, gültige E-Mail und eine Uhrzeit angeben." }, { status: 400 });
  }

  try {
    await verifyAltcha(text(input.altcha, 4000));
    const slot = token ? await bookWithLink({ ...booking, kind: kindOf(input.kind), token }) : await book(booking);
    if (!slot) return Response.json({ error: "Die Zeit ist leider gerade weg. Such dir bitte eine andere aus." }, { status: 409 });
    return Response.json({ ok: true, slot });
  } catch (error) {
    if (error instanceof CaptchaError || error instanceof FlowError) return Response.json({ error: error.message }, { status: 400 });
    console.error("Buchung", error);
    return Response.json({ error: "Buchen hat gerade nicht geklappt." }, { status: 503 });
  }
}
