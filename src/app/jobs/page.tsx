import type { Metadata } from "next";
import { LegalShell } from "@/components/app/LegalShell";
import { JobsView } from "@/components/app/JobsView";
import { openJobs } from "@/lib/jobs";

export const metadata: Metadata = {
  title: "Jobs | GRID Agency",
  description:
    "Offene Stellen bei GRID Agency in Berlin und Frankfurt: Social Media Manager, Video Content Creator, Werkstudent:in und Praktikum im Social Media Marketing.",
};

// Welche Stellen online sind, steuert das Intranet; Änderungen erscheinen
// nach spätestens einer Minute.
export const revalidate = 60;

export default async function JobsPage() {
  return (
    <LegalShell title="Jobs">
      <JobsView jobs={await openJobs()} />
    </LegalShell>
  );
}
