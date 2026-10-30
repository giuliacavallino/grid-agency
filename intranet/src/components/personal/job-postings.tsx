"use client";

import { useState } from "react";
import { clsx } from "clsx";
import { ExternalLink } from "lucide-react";
import { updateRow, useRows } from "@/lib/data";
import { DOMAIN } from "@/lib/config";
import type { Application, JobPosting } from "@/lib/sales/types";
import { Empty, Spinner, useToast } from "@/components/ui";
import { PageBar } from "@/components/sales/shell";

const JOBS_URL = `https://${DOMAIN}/jobs`;

/** Offene Stellen auf der Website an- und ausschalten. Aktive Stellen stehen
 * auf /jobs und im Bewerbungsformular; die Website übernimmt Änderungen
 * nach spätestens einer Minute. */
export function JobPostings() {
  const { data: jobs, loading, error } = useRows<JobPosting>("job_postings");
  const { data: applications } = useRows<Application>("applications");
  const active = jobs?.filter((j) => j.active).length ?? 0;

  return (
    <div className="flex h-full flex-col">
      <PageBar title="Stellen" meta={jobs && `${active} von ${jobs.length} online`}>
        <a
          href={JOBS_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex h-9 items-center gap-2 rounded-full border border-snow/15 bg-snow/[0.06] px-4 text-sm font-medium hover:bg-snow/12"
        >
          <ExternalLink className="h-4 w-4" /> Jobseite ansehen
        </a>
      </PageBar>

      {error ? (
        <Empty title="Stellen konnten nicht geladen werden" text={error.message} />
      ) : loading ? (
        <div className="grid flex-1 place-items-center">
          <Spinner />
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto p-4 md:p-5">
          <p className="mb-4 max-w-2xl text-[13px] text-snow/55">
            Aktive Stellen erscheinen auf der Jobseite und im Bewerbungsformular. Initiativbewerbungen sind immer möglich.
            Neue Bewerbungen landen als Karte unter Bewerbungen.
          </p>
          <ul className="grid max-w-2xl gap-2">
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
      toast(job.active ? "Stelle offline" : "Stelle online");
    } catch {
      toast("Ändern fehlgeschlagen", "error");
    }
    setToggling(false);
  }

  return (
    <li className="flex items-center gap-4 rounded-2xl border border-snow/[0.06] bg-surface px-4 py-3.5">
      <div className="min-w-0 flex-1">
        <p className={clsx("truncate text-[15px] font-medium", !job.active && "text-snow/50")}>{job.title}</p>
        <p className="text-[12px] text-snow/45">
          {count === 1 ? "1 Bewerbung" : `${count} Bewerbungen`} über die Website
        </p>
      </div>
      <label className="flex shrink-0 cursor-pointer items-center gap-2 text-[13px] text-snow/60" aria-busy={toggling || undefined}>
        {toggling ? <Spinner className="h-3.5 w-3.5" /> : <span>{job.active ? "Online" : "Offline"}</span>}
        <button
          type="button"
          role="switch"
          aria-checked={job.active}
          aria-label={`${job.title} ${job.active ? "offline nehmen" : "online stellen"}`}
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
