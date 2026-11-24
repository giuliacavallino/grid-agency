import type { Metadata } from "next";
import { PageShell } from "@/components/app/PageShell";
import { EventsView } from "@/components/app/EventsView";
import { eventLists } from "@/lib/events";
import { JsonLd } from "@/components/JsonLd";
import { SITE_URL } from "@/lib/seo";

export const metadata: Metadata = {
  title: "Events | GRID Agency",
  alternates: { canonical: "/events" },
  description:
    "Aktuelle und vergangene Events von GRID Agency | sei beim nächsten dabei.",
};

// Neue Events erscheinen nach spätestens einer Minute.
export const revalidate = 60;

export default async function EventsPage() {
  const lists = await eventLists();
  return (
    <PageShell>
      {lists.upcoming.map((e) => (
        <JsonLd key={e.id} data={{
          "@context": "https://schema.org",
          "@type": "Event",
          name: e.title,
          startDate: e.starts_at,
          ...(e.description ? { description: e.description } : {}),
          ...(e.cover_url ? { image: e.cover_url } : {}),
          url: e.luma_url ?? `${SITE_URL}/events`,
          eventStatus: "https://schema.org/EventScheduled",
          eventAttendanceMode: "https://schema.org/OfflineEventAttendanceMode",
          ...(e.location ? { location: { "@type": "Place", name: e.location, address: e.location } } : {}),
          organizer: { "@id": `${SITE_URL}/#organization` },
        }} />
      ))}
      <EventsView {...lists} />
    </PageShell>
  );
}
