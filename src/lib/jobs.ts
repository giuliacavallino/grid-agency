import { getSupabase } from "@/lib/supabase";

/** Slugs der Stellen, die im Intranet (Personal → Stellen) auf „Wird
 * gesucht“ stehen. Alle Stellen aus content.ts bleiben immer sichtbar und
 * wählbar; ohne Datenbank fehlt nur der Chip. */
export async function searchedJobs(): Promise<string[]> {
  const supabase = getSupabase();
  if (!supabase) return [];
  const { data, error } = await supabase.from("job_postings").select("slug").eq("active", true);
  if (error || !data) return [];
  return data.map((row) => row.slug as string);
}
