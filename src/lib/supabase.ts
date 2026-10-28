import { createClient, type SupabaseClient } from "@supabase/supabase-js";

let client: SupabaseClient | null | undefined;

/** Supabase-Client, erst beim ersten Zugriff erzeugt. Fehlen die
 * Umgebungsvariablen (lokaler Build, Preview ohne Secrets), gibt es
 * `null` statt eines Absturzes beim Import, der sonst `next build`
 * abbricht. */
export function getSupabase(): SupabaseClient | null {
  if (client === undefined) {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    client = url && key ? createClient(url, key) : null;
  }
  return client;
}
