import type { Metadata } from "next";
import { PageShell } from "@/components/app/PageShell";
import { EventsView } from "@/components/app/EventsView";
import { eventLists } from "@/lib/events";

export const metadata: Metadata = {
  title: "Events | GRID Agency",
  description:
    "Aktuelle und vergangene Events von GRID Agency | sei beim nächsten dabei.",
};

// Neue Events erscheinen nach spätestens einer Minute.
export const revalidate = 60;

export default async function EventsPage() {
  return (
    <PageShell>
      <EventsView {...await eventLists()} />
    </PageShell>
  );
}
