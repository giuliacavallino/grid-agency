import type { Metadata } from "next";
import { PageShell } from "@/components/app/PageShell";
import { EbookView } from "@/components/app/EbookView";
import { MetaPixelConsent } from "@/components/app/MetaPixelConsent";

export const metadata: Metadata = {
  title: "E-Book: Social Media 2027 | GRID Agency",
  description:
    "Kostenloses E-Book für Unternehmer:innen: Wie sich Social Media bis 2027 verändert und was du jetzt tun musst, um mehr Umsatz, zufriedenere Kund:innen und mehr Bewerbungen zu gewinnen.",
  openGraph: {
    title: "Social Media 2027 – kostenloses E-Book",
    description:
      "Der Wandel und dein 90-Tage-Fahrplan für mehr Umsatz, zufriedenere Kund:innen und mehr Bewerbungen.",
    url: "https://grid-agency.de/ebook",
    siteName: "GRID Agency",
    locale: "de_DE",
    type: "website",
    images: ["/ebook/cover.jpg"],
  },
};

export default function EbookPage() {
  return (
    <PageShell>
      <EbookView />
      <MetaPixelConsent />
    </PageShell>
  );
}
