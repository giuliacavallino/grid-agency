import { jobs, type Job } from "@/lib/content";
import { getSupabase } from "@/lib/supabase";

/** Stellen, die im Intranet (Personal → Stellen) auf „online“ stehen. Ist
 * die Datenbank nicht erreichbar, bleiben alle Stellen aus content.ts
 * sichtbar statt einer leeren Jobseite. */
export async function openJobs(): Promise<Job[]> {
  const supabase = getSupabase();
  if (!supabase) return jobs;
  const { data, error } = await supabase.from("job_postings").select("slug, active");
  if (error || !data) return jobs;
  const active = new Set(data.filter((row) => row.active).map((row) => row.slug));
  return jobs.filter((job) => active.has(job.slug));
}
