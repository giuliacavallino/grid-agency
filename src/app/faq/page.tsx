import type { Metadata } from "next";
import { PageShell } from "@/components/app/PageShell";
import { FaqView } from "@/components/app/FaqView";
import { faq } from "@/lib/content";
import { JsonLd } from "@/components/JsonLd";
import { faqAnswer } from "@/lib/seo";

export const metadata: Metadata = {
  title: "FAQ | GRID Agency",
  alternates: { canonical: "/faq" },
  description:
    "Häufige Fragen zur Zusammenarbeit mit GRID Agency: erste Beiträge, Followerzuwachs, Plattformen, Content-Formate, Erfolgsmessung und Community Management.",
};

/** Strukturierte Daten, damit Google die Fragen als FAQ erkennt. */
function faqJsonLd() {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: faq.map((item) => ({
      "@type": "Question",
      name: item.question,
      acceptedAnswer: { "@type": "Answer", text: faqAnswer(item) },
    })),
  };
}

export default function FaqPage() {
  return (
    <PageShell>
      <JsonLd data={faqJsonLd()} />
      <FaqView />
    </PageShell>
  );
}
