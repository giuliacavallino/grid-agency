import type { Metadata } from "next";
import { LegalShell } from "@/components/app/LegalShell";
import { EventsView } from "@/components/app/EventsView";

export const metadata: Metadata = {
  title: "Events — GRID Agency",
  description:
    "Aktuelle und vergangene Events von GRID Agency — sei beim nächsten dabei.",
};

export default function EventsPage() {
  return (
    <LegalShell title="Events">
      <EventsView />
    </LegalShell>
  );
}
