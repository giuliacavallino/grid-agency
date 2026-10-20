import type { Metadata } from "next";
import { LegalShell } from "@/components/app/LegalShell";
import { FaqView } from "@/components/app/FaqView";
import { faq } from "@/lib/content";

export const metadata: Metadata = {
  title: "FAQ | GRID Agency",
  description:
    "Häufige Fragen zur Zusammenarbeit mit GRID Agency: erste Beiträge, Followerzuwachs, Plattformen, Content-Formate, Erfolgsmessung und Community Management.",
};

/** Strukturierte Daten, damit Google die Fragen als FAQ erkennt. */
function faqJsonLd() {
  const text = (item: (typeof faq)[number]) =>
    [
      item.intro,
      ...(item.points ?? []).map((p) => `${p.title}: ${p.text}`),
      item.outro,
    ]
      .filter(Boolean)
      .join(" ");
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: faq.map((item) => ({
      "@type": "Question",
      name: item.question,
      acceptedAnswer: { "@type": "Answer", text: text(item) },
    })),
  };
}

export default function FaqPage() {
  return (
    <LegalShell title="FAQ">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd()) }}
      />
      <FaqView />
    </LegalShell>
  );
}
