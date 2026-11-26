import type { Metadata } from "next";
import { PageShell } from "@/components/app/PageShell";
import { EbookView } from "@/components/app/EbookView";
import { MetaPixelConsent } from "@/components/app/MetaPixelConsent";
import { JsonLd } from "@/components/JsonLd";
import { ebooks } from "@/lib/content";
import { SITE_URL } from "@/lib/seo";

export const metadata: Metadata = {
  title: "E-Book: Social Media 2027 | GRID Agency",
  alternates: { canonical: "/ebook" },
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
      {ebooks.map((e) => (
        <JsonLd key={e.href} data={{
          "@context": "https://schema.org",
          "@type": "Book",
          name: `${e.title}: ${e.subtitle}`,
          url: `${SITE_URL}${e.href}`,
          image: `${SITE_URL}${e.cover}`,
          numberOfPages: e.pages,
          bookFormat: "https://schema.org/EBook",
          inLanguage: "de-DE",
          author: { "@id": `${SITE_URL}/#organization` },
          publisher: { "@id": `${SITE_URL}/#organization` },
          isAccessibleForFree: true,
          offers: { "@type": "Offer", price: "0", priceCurrency: "EUR", availability: "https://schema.org/InStock" },
        }} />
      ))}
      <EbookView />
      <MetaPixelConsent />
    </PageShell>
  );
}
