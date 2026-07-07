import type { Metadata } from "next";
import { LegalShell } from "@/components/app/LegalShell";
import { ReferenzenView } from "@/components/app/ReferenzenView";

export const metadata: Metadata = {
  title: "Referenzen — GRID Agency",
  description:
    "Alle Marken, die GRID Agency auf Social Media betreut — mit direktem Draht zu ihren Instagram-Kanälen.",
};

export default function ReferenzenPage() {
  return (
    <LegalShell title="Referenzen">
      <ReferenzenView />
    </LegalShell>
  );
}
