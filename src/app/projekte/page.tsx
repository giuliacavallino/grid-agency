import type { Metadata } from "next";
import { LegalShell } from "@/components/app/LegalShell";
import { ProjekteView } from "@/components/app/ProjekteView";

export const metadata: Metadata = {
  title: "Projekte | GRID Agency",
  description:
    "Alle Marken, die GRID Agency auf Social Media betreut, mit direktem Draht zu ihren Instagram-Kanälen.",
};

export default function ProjektePage() {
  return (
    <LegalShell title="Projekte">
      <ProjekteView />
    </LegalShell>
  );
}
