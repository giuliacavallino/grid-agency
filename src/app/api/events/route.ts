import { supabase } from "@/lib/supabase";

/** Events für Startseite, Kundenseiten und /events. Die Abfrage läuft
 * bewusst serverseitig: Der Browser der Besucher spricht nur mit unserer
 * eigenen Domain und baut keine Verbindung zu Supabase auf, es werden also
 * keine IP-Adressen an Dritte übertragen. */
export async function GET() {
  const { data, error } = await supabase
    .from("events")
    .select("*")
    .order("starts_at", { ascending: false });

  if (error) {
    return Response.json({ events: [] }, { status: 502 });
  }

  return Response.json(
    { events: data ?? [] },
    // Kurz am CDN zwischenspeichern, damit nicht jeder Aufruf die
    // Datenbank trifft; neue Events erscheinen nach spätestens einer Minute.
    { headers: { "Cache-Control": "public, s-maxage=60, stale-while-revalidate=300" } },
  );
}
