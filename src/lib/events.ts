import { getSupabase } from "@/lib/supabase";

export type GridEvent = {
  id: string;
  title: string;
  description: string | null;
  location: string | null;
  starts_at: string;
  luma_url: string | null;
  cover_url: string | null;
  gallery: string[];
  showreel_url: string | null;
};

/** Alle Events, neueste zuerst. Läuft auf dem Server (Seite mit
 * revalidate), Besucher bauen keine Verbindung zu Supabase auf. */
export async function getEvents(): Promise<GridEvent[]> {
  const supabase = getSupabase();
  if (!supabase) return [];
  const { data, error } = await supabase.from("events").select("*").order("starts_at", { ascending: false });
  return error ? [] : ((data ?? []) as GridEvent[]);
}

/** Nächstes anstehendes Event, optional nur mit diesem Markennamen im Titel. */
export async function nextEvent(match?: string): Promise<GridEvent | null> {
  const now = Date.now();
  const upcoming = (await getEvents())
    .filter((e) => new Date(e.starts_at).getTime() >= now)
    .sort((a, b) => Date.parse(a.starts_at) - Date.parse(b.starts_at));
  return (match ? upcoming.find((e) => e.title.toLowerCase().includes(match.toLowerCase())) : upcoming[0]) ?? null;
}

/** Anstehende (früheste zuerst) und vergangene Events. */
export async function eventLists() {
  const now = Date.now();
  const events = await getEvents();
  return {
    upcoming: events.filter((e) => Date.parse(e.starts_at) >= now).sort((a, b) => Date.parse(a.starts_at) - Date.parse(b.starts_at)),
    past: events.filter((e) => Date.parse(e.starts_at) < now),
  };
}
