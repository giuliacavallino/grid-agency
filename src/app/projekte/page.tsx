import type { Metadata } from "next";
import { PageShell } from "@/components/app/PageShell";
import { ProjekteView } from "@/components/app/ProjekteView";
import { JsonLd } from "@/components/JsonLd";
import { clients, clientSlug } from "@/lib/content";
import { SITE_URL } from "@/lib/seo";

export const metadata: Metadata = {
  title: "Projekte | GRID Agency",
  alternates: { canonical: "/projekte" },
  description:
    "Alle Marken, die GRID Agency auf Social Media betreut, mit direktem Draht zu ihren Instagram-Kanälen.",
};

export default function ProjektePage() {
  return (
    <PageShell>
      <JsonLd data={{
        "@context": "https://schema.org",
        "@type": "ItemList",
        name: "Projekte von GRID Agency",
        itemListElement: clients.map((c, i) => ({
          "@type": "ListItem",
          position: i + 1,
          name: c.name,
          url: `${SITE_URL}/projekte/${clientSlug(c.name)}`,
        })),
      }} />
      <ProjekteView />
    </PageShell>
  );
}
