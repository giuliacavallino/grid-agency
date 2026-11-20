"use client";

import { useState } from "react";
import { clsx } from "clsx";
import { ExternalLink } from "lucide-react";
import { updateRow, useRows } from "@/lib/data";
import { DOMAIN } from "@/lib/config";
import type { Application, JobPosting } from "@/lib/sales/types";
import { Empty, Spinner, useToast } from "@/components/ui";
import { PILL } from "@/components/sales/pipeline";

const JOBS_URL = `https://${DOMAIN}/jobs`;

/** Stellen der Website als „Wird gesucht“ markieren. Alle Stellen stehen
 * immer auf /jobs und im Bewerbungsformular; markierte bekommen dort einen
 * grünen Chip. Die Website übernimmt Änderungen nach spätestens einer Minute. */
export function JobPostings() {
  const { data: jobs, loading, error } = useRows<JobPosting>("job_postings");
  const { data: applications } = useRows<Application>("applications");
  const active = jobs?.filter((j) => j.active).length ?? 0;

  return (
    <div className="flex h-full flex-col bg-sky">
      <h1 className="sr-only">Stellenanzeigen</h1>
      <div className="flex shrink-0 flex-wrap items-center gap-3 px-4 pt-1 pb-4 md:px-6">
        <p className="text-[15px] text-snow/55">
          <strong className="mr-1 text-[22px] font-semibold text-snow tabular-nums">{jobs ? active : "–"}</strong>
          {jobs ? `von ${jobs.length} gesucht` : "gesucht"}
        </p>
        <a
          href={JOBS_URL}
          target="_blank"
          rel="noopener noreferrer"
          className={clsx(PILL, "ml-auto inline-flex h-10 items-center gap-2 px-4 text-[13.5px] font-medium text-snow/80 hover:text-snow")}
        >
          <ExternalLink className="h-4 w-4" /> Jobseite ansehen
        </a>
      </div>

      {error ? (
        <Empty title="Stellen konnten nicht geladen werden" text={error.message} />
      ) : loading ? (
        <div className="grid flex-1 place-items-center">
          <Spinner />
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto px-4 pb-6 md:px-6">
          <p className="mb-4 max-w-2xl text-[13px] text-snow/55">
            Alle Stellen stehen immer auf der Jobseite und im Bewerbungsformular. Was wir gerade suchen, bekommt dort den grünen
            Chip „Wird gesucht“. Neue Bewerbungen landen als Karte in der Bewerber-Pipeline.
          </p>
          <ul className="grid max-w-3xl gap-2.5">
            {jobs?.map((job) => (
              <JobRow key={job.id} job={job} count={applications?.filter((a) => a.job_slug === job.slug).length ?? 0} />
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function JobRow({ job, count }: { job: JobPosting; count: number }) {
  const toast = useToast();
  const [toggling, setToggling] = useState(false);

  async function toggle() {
    setToggling(true);
    try {
      await updateRow<JobPosting>("job_postings", job.id, { active: !job.active });
      toast(job.active ? "Nicht mehr gesucht" : "Wird gesucht");
    } catch {
      toast("Ändern fehlgeschlagen", "error");
    }
    setToggling(false);
  }

  return (
    <li className="flex items-center gap-4 rounded-3xl border border-snow/[0.07] bg-surface px-5 py-4 shadow-[0_4px_18px_var(--shadow-color)]">
      <div className="min-w-0 flex-1">
        <p className={clsx("truncate text-[15px] font-medium", !job.active && "text-snow/60")}>{job.title}</p>
        <p className="text-[12px] text-snow/45">
          {count === 1 ? "1 Bewerbung" : `${count} Bewerbungen`} über die Website
        </p>
      </div>
      <label className="flex shrink-0 cursor-pointer items-center gap-2 text-[13px] text-snow/60" aria-busy={toggling || undefined}>
        {toggling ? <Spinner className="h-3.5 w-3.5" /> : <span>{job.active ? "Wird gesucht" : "Nicht gesucht"}</span>}
        <button
          type="button"
          role="switch"
          aria-checked={job.active}
          aria-label={`${job.title}: wird gesucht`}
          disabled={toggling}
          onClick={toggle}
          className={clsx("relative h-6 w-11 rounded-full transition-colors disabled:cursor-progress", job.active ? "bg-success" : "bg-snow/20")}
        >
          <span className={clsx("absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-sky transition-transform", job.active && "translate-x-5")} />
        </button>
      </label>
    </li>
  );
}
