import type { Metadata } from "next";
import { LegalShell } from "@/components/app/LegalShell";
import { JobsView } from "@/components/app/JobsView";

export const metadata: Metadata = {
  title: "Jobs | GRID Agency",
  description:
    "Offene Stellen bei GRID Agency in Berlin und Frankfurt: Social Media Manager, Video Content Creator, Werkstudent:in und Praktikum im Social Media Marketing.",
};

export default function JobsPage() {
  return (
    <LegalShell title="Jobs">
      <JobsView />
    </LegalShell>
  );
}
