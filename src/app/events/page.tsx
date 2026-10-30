import type { Metadata } from "next";
import { PageShell } from "@/components/app/PageShell";
import { EventsView } from "@/components/app/EventsView";

export const metadata: Metadata = {
  title: "Events | GRID Agency",
  description:
    "Aktuelle und vergangene Events von GRID Agency | sei beim nächsten dabei.",
};

export default function EventsPage() {
  return (
    <PageShell>
      <EventsView />
    </PageShell>
  );
}
