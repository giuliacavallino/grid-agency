import type { Metadata } from "next";
import { PageShell } from "@/components/app/PageShell";
import { ProjekteView } from "@/components/app/ProjekteView";

export const metadata: Metadata = {
  title: "Projekte | GRID Agency",
  description:
    "Alle Marken, die GRID Agency auf Social Media betreut, mit direktem Draht zu ihren Instagram-Kanälen.",
};

export default function ProjektePage() {
  return (
    <PageShell>
      <ProjekteView />
    </PageShell>
  );
}
