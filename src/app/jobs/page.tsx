import type { Metadata } from "next";
import { LegalShell } from "@/components/app/LegalShell";
import { JobsView } from "@/components/app/JobsView";

export const metadata: Metadata = {
  title: "Jobs | GRID Agency",
  description:
    "Offene Stellen bei GRID Agency in Berlin-Mitte: Social Media Manager, Video Content Creator, Werkstudent und Praktikum im Social Media Marketing.",
};

export default function JobsPage() {
  return (
    <LegalShell title="Jobs">
      <JobsView />
    </LegalShell>
  );
}
