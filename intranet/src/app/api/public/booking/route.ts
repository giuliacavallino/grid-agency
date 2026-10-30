import { book, freeSlots } from "@/lib/server/booking";

// Öffentlich (ohne Login): Die Website holt hierüber serverseitig freie
// Zeiten und bucht Erstgespräche. Kein Login, deshalb nur Termine in freien
// Zeiten, und jede Buchung prüft die Zeit noch einmal gegen den Kalender.

export async function GET() {
  try {
    return Response.json({ slots: await freeSlots() }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
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
  };
  if (!booking.name || !EMAIL.test(booking.email) || Number.isNaN(Date.parse(booking.start))) {
    return Response.json({ error: "Bitte Name, gültige E-Mail und eine Uhrzeit angeben." }, { status: 400 });
  }

  try {
    const slot = await book(booking);
    if (!slot) return Response.json({ error: "Die Zeit ist leider gerade weg. Such dir bitte eine andere aus." }, { status: 409 });
    return Response.json({ ok: true, slot });
  } catch (error) {
    console.error("Buchung", error);
    return Response.json({ error: "Buchen hat gerade nicht geklappt." }, { status: 503 });
  }
}
