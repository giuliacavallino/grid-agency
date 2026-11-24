import { clients, clientSlug, faq, jobs, services, extraServices, agencyResults, caseStudyTeasers, roadmap, ebooks, team, vita } from "@/lib/content";

/** Zentrale Stammdaten für Suchmaschinen und KI-Crawler (JSON-LD,
 * sitemap.xml, llms.txt). Adressen und Kontakt wie im Impressum. */
export const SITE_URL = "https://grid-agency.de";

export const company = {
  name: "GRID Agency",
  legalName: "GRID Agency UG (haftungsbeschränkt)",
  description:
    "Social-Media-Agentur aus Frankfurt am Main und Berlin: Strategie, Content-Produktion mit Foto und Video, Kanalbetreuung, Influencer-Kooperationen, Meta Ads und Google Unternehmensprofil aus einer Hand. Schwerpunkt Gastronomie, Dienstleister und Lifestyle-Brands.",
  email: "hello@grid-agency.de",
  telephone: "+4915122910161",
  founder: team.name,
  foundingYear: "2021",
  logo: `${SITE_URL}/brand/grid_logo_sky.png`,
  image: `${SITE_URL}/team/giulia.jpg`,
  vatID: "DE350319219",
};

/** Standorte. Frankfurt ist Sitz laut Handelsregister. */
export const locations = [
  {
    id: "frankfurt",
    city: "Frankfurt am Main",
    street: "Eichendorffstraße 32",
    zip: "60320",
    region: "Hessen",
    areaServed: [
      "Frankfurt am Main",
      "Offenbach am Main",
      "Bad Homburg vor der Höhe",
      "Eschborn",
      "Hanau",
      "Darmstadt",
      "Wiesbaden",
      "Mainz",
      "Mannheim",
      "Heidelberg",
      "Rhein-Main-Gebiet",
      "Hessen",
    ],
  },
  {
    id: "berlin",
    city: "Berlin",
    street: "Sömmeringstraße 37",
    zip: "10589",
    region: "Berlin",
    areaServed: ["Berlin", "Potsdam", "Brandenburg"],
  },
] as const;

export const abs = (path: string) => (path.startsWith("http") ? path : `${SITE_URL}${path}`);

const orgId = `${SITE_URL}/#organization`;

function serviceName(s: { title: string; accent?: string }) {
  return s.accent ? `${s.title} ${s.accent}` : s.title;
}

/** Organisation + beide Standorte als lokale Unternehmen + Website.
 * Steht im Root-Layout, also auf jeder Seite. */
export function siteJsonLd() {
  const offerCatalog = {
    "@type": "OfferCatalog",
    name: "Leistungen",
    itemListElement: [
      ...services.map((s) => ({
        "@type": "Offer",
        itemOffered: { "@type": "Service", name: serviceName(s), description: `${s.tagline} ${s.bullets.join(" ")}` },
      })),
      ...extraServices.map((s) => ({
        "@type": "Offer",
        itemOffered: { "@type": "Service", name: s.title, description: s.bullets.join(" ") },
      })),
    ],
  };

  return {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Organization",
        "@id": orgId,
        name: company.name,
        legalName: company.legalName,
        url: SITE_URL,
        logo: company.logo,
        description: company.description,
        email: company.email,
        telephone: company.telephone,
        vatID: company.vatID,
        foundingDate: company.foundingYear,
        founder: { "@type": "Person", name: company.founder, jobTitle: "Geschäftsführerin" },
        knowsAbout: [
          "Social Media Marketing",
          "Instagram Marketing",
          "TikTok Marketing",
          "Content Creation",
          "Influencer Marketing",
          "Meta Ads",
          "Google Unternehmensprofil",
          "Local SEO",
          "Gastronomie-Marketing",
        ],
        address: postalAddress(locations[0]),
        department: locations.map((l) => ({ "@id": `${SITE_URL}/#${l.id}` })),
        hasOfferCatalog: offerCatalog,
      },
      ...locations.map((l) => ({
        "@type": "ProfessionalService",
        "@id": `${SITE_URL}/#${l.id}`,
        name: `${company.name} ${l.city === "Frankfurt am Main" ? "Frankfurt" : l.city}`,
        description: `Social-Media-Agentur in ${l.city}. ${company.description}`,
        url: SITE_URL,
        image: company.image,
        logo: company.logo,
        email: company.email,
        telephone: company.telephone,
        address: postalAddress(l),
        areaServed: l.areaServed.map((name) => ({ "@type": "Place", name })),
        parentOrganization: { "@id": orgId },
        hasOfferCatalog: offerCatalog,
      })),
      {
        "@type": "WebSite",
        "@id": `${SITE_URL}/#website`,
        url: SITE_URL,
        name: company.name,
        inLanguage: "de-DE",
        publisher: { "@id": orgId },
      },
    ],
  };
}

function postalAddress(l: (typeof locations)[number]) {
  return {
    "@type": "PostalAddress",
    streetAddress: l.street,
    postalCode: l.zip,
    addressLocality: l.city,
    addressRegion: l.region,
    addressCountry: "DE",
  };
}

export function breadcrumbJsonLd(items: { name: string; path: string }[]) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: item.name,
      item: abs(item.path),
    })),
  };
}

/** Antworttext einer FAQ als Fließtext (für JSON-LD und llms.txt). */
export function faqAnswer(item: (typeof faq)[number]) {
  return [item.intro, ...(item.points ?? []).map((p) => `${p.title}: ${p.text}`), item.outro]
    .filter(Boolean)
    .join(" ");
}

/* ------------------------------------------------------------------ */
/* llms.txt                                                           */
/* ------------------------------------------------------------------ */

/** Seitenübersicht im llms.txt-Format (https://llmstxt.org): Markdown,
 * das KI-Systeme ohne JavaScript und Layout lesen können. `full` hängt
 * die kompletten Inhalte an (llms-full.txt). */
export function llmsTxt(full: boolean) {
  const lines: string[] = [];
  const push = (...l: string[]) => lines.push(...l);
  const showcased = clients.filter((c) => c.caseStudy || c.intro);

  push(
    `# ${company.name}`,
    "",
    `> ${company.description}`,
    "",
    `${company.legalName}, gegründet ${company.foundingYear} von ${company.founder}. Standorte: ${locations
      .map((l) => `${l.street}, ${l.zip} ${l.city}`)
      .join(" und ")}. Kontakt: ${company.email}, +49 1512 2910161. Kostenloses Erstgespräch (30 Minuten per Video-Call) über ${SITE_URL}/#dm.`,
    "",
    `Einzugsgebiet: ${[...new Set(locations.flatMap((l) => l.areaServed))].join(", ")}. Zusammenarbeit auch deutschlandweit remote.`,
    "",
    "## Seiten",
    "",
    `- [Startseite](${SITE_URL}/): Überblick über die Agentur. Hero mit Kennzahlen, Kundenlogos, sechs Leistungsbereiche (${services
      .map(serviceName)
      .join(", ")}), durchschnittliche Ergebnisse, Case Studies (${caseStudyTeasers
      .map((c) => c.client)
      .join(", ")}), Instagram-Feed, Projekte, Roadmap der Zusammenarbeit, Team und Kontaktformular.`,
    `- [Projekte](${SITE_URL}/projekte): Alle ${clients.length} Marken, die GRID auf Social Media betreut, mit Link zur jeweiligen Projektseite und zum Instagram-Kanal.`,
    `- [FAQ](${SITE_URL}/faq): ${faq.length} häufige Fragen zur Zusammenarbeit, unter anderem: ${faq
      .map((f) => f.question)
      .join(" ")}`,
    `- [Jobs](${SITE_URL}/jobs): Offene Stellen in Berlin und Frankfurt: ${jobs.map((j) => `${j.title} (${j.scope})`).join(", ")}. Bewerbung direkt über die Seite.`,
    `- [E-Book](${SITE_URL}/ebook): ${ebooks
      .map((e) => `Kostenloses E-Book „${e.title}“ (${e.pages} Seiten): ${e.subtitle}`)
      .join(" ")} Download nach Eingabe der E-Mail-Adresse.`,
    `- [Events](${SITE_URL}/events): Anstehende und vergangene Events, die GRID für Kund:innen plant und begleitet, mit Fotos und Anmeldelink.`,
    `- [Impressum](${SITE_URL}/impressum): Anbieterkennzeichnung, Handelsregister Amtsgericht Frankfurt am Main.`,
    `- [AGB](${SITE_URL}/agb): Allgemeine Geschäftsbedingungen für Social-Media-, Content- und Event-Leistungen.`,
    `- [Datenschutz](${SITE_URL}/datenschutz): Datenschutzerklärung.`,
    "",
    "## Projekte",
    "",
    ...showcased.map((c) => {
      const tags = c.tags?.length ? ` Leistungen: ${c.tags.join(", ")}.` : "";
      const stats = c.results?.length ? ` Ergebnisse: ${c.results.map((r) => `${r.value} ${r.label}`).join(", ")}.` : "";
      return `- [${c.name}](${SITE_URL}/projekte/${clientSlug(c.name)}): ${c.intro ?? ""}${tags}${stats}`;
    }),
    "",
    "## Optional",
    "",
    `- [Vollständige Inhalte](${SITE_URL}/llms-full.txt): Alle Texte der Website in einer Datei (Leistungen im Detail, Case Studies, FAQ-Antworten, Stellenbeschreibungen).`,
    `- [Sitemap](${SITE_URL}/sitemap.xml)`,
  );

  if (!full) return lines.join("\n") + "\n";

  push("", "---", "", "## Leistungen im Detail", "");
  for (const s of services) {
    push(`### ${s.number} ${serviceName(s)}`, "", s.tagline, "", ...s.bullets.map((b) => `- ${b}`));
    if (s.highlight) push("", s.highlight);
    push("");
  }
  for (const s of extraServices) {
    push(`### ${s.title}`, "", s.reference, "", ...s.bullets.map((b) => `- ${b}`));
    if (s.highlight) push("", s.highlight);
    push("");
  }

  push("## Durchschnittliche Ergebnisse über alle Kund:innen", "");
  push(...agencyResults.map((r) => `- **${r.value} ${r.label}**: ${r.text}`), "");

  push("## Ablauf der Zusammenarbeit", "");
  push(...roadmap.map((r) => `${r.number}. **${r.title}**: ${r.text}`), "");

  push("## Über GRID", "", `${team.name}, ${team.role}. ${team.bio}`, "");
  push(...vita.map((v) => `- ${v.year}: ${v.text}`), "");

  push("## Case Studies", "");
  for (const c of clients.filter((c) => c.caseStudy)) {
    push(`### ${c.name}`, "", `${SITE_URL}/projekte/${clientSlug(c.name)}`, "", c.caseStudy!);
    if (c.results?.length) push("", ...c.results.map((r) => `- **${r.value} ${r.label}**: ${r.text}`));
    if (c.resultsSource) push("", c.resultsSource);
    if (c.testimonial) push("", `> „${c.testimonial.quote}“ (${c.testimonial.name}${c.testimonial.meta ? `, ${c.testimonial.meta}` : ""})`);
    push("");
  }

  push("## FAQ", "");
  for (const f of faq) push(`### ${f.question}`, "", faqAnswer(f), "");

  push("## Offene Stellen", "");
  for (const j of jobs) {
    push(
      `### ${j.title}`,
      "",
      `${j.scope}, ${j.location}${j.duration ? `, ${j.duration}` : ""}. ${j.role}`,
      "",
      "Aufgaben:",
      ...j.tasks.map((t) => `- ${t}`),
      "",
      "Profil:",
      ...j.profile.map((t) => `- ${t}`),
      "",
      "Benefits:",
      ...j.benefits.map((t) => `- ${t}`),
      "",
    );
  }

  return lines.join("\n") + "\n";
}
