export type Client = {
  name: string;
  /** Path under /public; falls back to a text wordmark when missing. */
  logo?: string;
  /** Rendered logo height in px (defaults to 32). */
  height?: number;
  /** Alternative logo for the detail views (sheet + client page);
   * the marquee and logo grid keep using `logo`. */
  logoDetail?: string;
  /** Instagram handle without the @. Button is hidden while missing. */
  instagram?: string;
  /** Gallery image paths under /public; empty shows a placeholder. */
  gallery?: string[];
  /** Short agency-voice introduction shown in the client sheet. */
  intro?: string;
  /** Was GRID für die Marke gemacht hat — als Chips in der
   * Kundenansicht. Ohne Angabe greifen die Kernleistungen. */
  tags?: string[];
  /** What GRID actually did for this brand — shown as "Der Case". */
  caseStudy?: string;
  /** Extra per-client sections (Events, Behind the Scenes, Rebranding …). */
  sections?: ClientSection[];
};

export type ClientSection = {
  title: string;
  text?: string;
  /** Image paths under /public. */
  images?: string[];
  /** Optional showreel (mp4 under /public), shown above the images. */
  video?: string;
};

/** URL slug for the per-client page, e.g. "480 GRADI" -> "480-gradi". */
export function clientSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/ä/g, "ae")
    .replace(/ö/g, "oe")
    .replace(/ü/g, "ue")
    .replace(/ß/g, "ss")
    .replace(/é|è/g, "e")
    .replace(/&/g, "und")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export const clients: Client[] = [
  {
    name: "charly & ben bagels",
    logo: "/clients/charly-ben.png",
    height: 54,
    instagram: "charlyandbenbagels",
    intro:
      "Handgerollte Bagels, die aussehen, als hätte New York in Berlin geparkt. Wir sorgen dafür, dass man sie schon im Feed schmeckt.",
  },
  {
    name: "Shiso Burger",
    logo: "/clients/shiso.png",
    height: 36,
    instagram: "shisoburger.de",
    intro:
      "Asian Fusion trifft Burger-Kultur. Wasabi statt Ketchup. Ein Klassiker, den wir im Feed so frisch halten wie das Tatar.",
  },
  {
    name: "Goldies",
    tags: ["Social Media Management", "Content Creation", "YouTube", "Brand-Kollaborationen"],
    logo: "/clients/goldies.png",
    height: 34,
    instagram: "goldies_smashburger",
    intro:
      "Kreuzberger Kult: Smashburger und goldene Fritten, für die man ansteht. Unser Job: dass der Feed genauso knuspert.",
    caseStudy:
      "Goldies kam mit rund 6.000 Followern und einem Account weit unter seinem Potenzial zu uns. Unser Dreiklang: ein visuell kompromissloser Content-Plan mit Food-Fotografie, Behind-the-Scenes und Reels, die auf Burger-Fans zugeschnitten sind; Kooperationen mit Foodbloggern und Brands aus der Berliner und Frankfurter Gastro-Szene; und der Ausbau auf YouTube mit Short- und Longform-Content rund um Brand-Story und Community-Events. Heute steht der Account bei über 49.000 Followern, mit einer Community, die die Marke wirklich trägt.",
  },
  {
    name: "Frittenwerk",
    tags: ["Social Media Management", "Content Creation", "TikTok", "Brand-Kollaborationen"],
    logo: "/clients/frittenwerk.png",
    height: 22,
    instagram: "frittenwerk",
    intro:
      "Die Pommesmanufaktur, die Poutine nach Deutschland geholt hat. Deutschlandweit gesnackt, von uns ins Scrollen gebracht.",
    caseStudy:
      "Frittenwerks Mission: die Energie aus über 40 Stores in einen Online-Auftritt übersetzen, der die Community wirklich erreicht. Wir haben einen Content-Plan um Urban Vibe und Signature Loaded Fries gebaut: Food-Shots, Behind-the-Scenes und Reels mit viralen Hooks. Dazu Kooperationen mit Foodbloggern und Lifestyle-Influencern und TikTok als neue Bühne. Das Ergebnis: 125.000+ Follower auf Instagram und Reels im Millionen-Reichweiten-Bereich. Aus Followern wurden Fans.",
  },
  {
    name: "Lipstick", logo: "/clients/lipstick.png", height: 16,
    instagram: "lipstick.film",
    intro:
      "All-in-One-Studio für Film, VFX & AI, gebucht von Marken wie Cartier und Moët. High-End-Content, den wir laut machen.",
  },
  {
    name: "Casa Beef",
    tags: ["Social Media Management", "Content Creation", "Rebranding", "Opening-Event"],
    /* Aufgehellte Lila-Variante: das dunkle Brand-Lila (#37255B) hätte
       auf dem Sky-Hintergrund kaum Kontrast. */
    logo: "/clients/casa-beef-lila-hell.png",
    logoDetail: "/clients/casa-beef-lila.png",
    height: 34,
    instagram: "casa.beef",
    intro:
      "Beef in seiner schönsten Form. Wir bringen das Sizzling vom Grill direkt auf den Bildschirm.",
    caseStudy:
      "Über den Dächern Berlin-Charlottenburgs, im KaDeWe die Sechste, haben wir aus dem ehemaligen Beef Grill Club das Casa Beef gemacht: Wir haben das komplette Rebranding umgesetzt, vom Look bis zur Tonalität, und die Opening-Party auf die Beine gestellt. Full Service heißt bei uns wirklich full.",
    gallery: Array.from(
      { length: 53 },
      (_, i) => `/referenzen/casa-beef/${i + 1}.webp`,
    ),
    sections: [
      {
        title: "Grand Opening Dezember 2025",
        text: "Das Opening-Event: von uns geplant, orchestriert und dokumentiert.",
        video: "/referenzen/casa-beef/opening-reel.mp4",
        images: Array.from(
          { length: 43 },
          (_, i) => `/referenzen/casa-beef/events-${i + 1}.webp`,
        ),
      },
      {
        title: "Behind the Scenes",
        text: "Wie ein Casa-Beef-Content-Day wirklich aussieht.",
        images: [
          "/referenzen/casa-beef/bts-1.webp",
          "/referenzen/casa-beef/bts-2.webp",
        ],
      },
    ],
  },
  {
    name: "lovebirds",
    logo: "/clients/lovebirds.png",
    height: 30,
    instagram: "lovebirds.berlin",
    intro:
      "Contemporary Pizza mit Charakter, knusprig, verliebt, fotogen. Genau unser Beuteschema.",
  },
  {
    name: "Coffi", logo: "/clients/coffi.png", height: 34,
    instagram: "coffi.app",
    intro:
      "Die App, die Kaffee scannt, trackt und versteht, mit Stories von über 500 Röstereien. Wir geben dem Ganzen die Reichweite.",
  },
  {
    name: "Ditsch", logo: "/clients/ditsch.png", height: 36, instagram: "ditsch_brezel",
    intro:
      "Die Brezel-Institution, die jeder aus der Fußgängerzone kennt. Tradition, die wir für den Feed neu aufbacken.",
  },
  {
    name: "Hasir", logo: "/clients/hasir.png", height: 26,
    instagram: "hasir.wilmersdorf",
    intro:
      "Berliner Institution für Turkish Cuisine, seit Jahrzehnten eine Legende. Wir erzählen sie weiter, Post für Post.",
  },
  {
    name: "Tokyo Mylk",
    logo: "/clients/tokyo-mylk.png",
    height: 60,
    instagram: "tokyo_mylk",
    intro:
      "Japanisch inspirierte Desserts und Drinks aus Frankfurt, süß, fotogen, viral-verdächtig. Wir liefern den letzten Schubs.",
  },
  {
    name: "Kindly", logo: "/clients/kindly.png", height: 31,
    instagram: "kindlyberlin",
    intro:
      "Specialty Coffee, Matcha und Healthy Bites in Charlottenburg. So ästhetisch, dass der Feed sich fast von selbst füllt, fast.",
  },
  {
    name: "Friendly Fish",
    logo: "/clients/friendly-fish.png",
    height: 16,
    instagram: "friendlyfish.berlin",
    intro:
      "Fisch, aber freundlich: frisch, ehrlich, ohne Chichi. Wir machen daraus Content mit Biss.",
  },
  {
    name: "Marré",
    logo: "/clients/marre.png",
    height: 29,
    instagram: "marrejewelry",
    intro:
      "Schmuck, der bleibt, wenn Trends gehen. Wir setzen die Pieces so in Szene, wie sie es verdienen.",
  },
  {
    name: "yousthetics",
    logo: "/clients/yousthetics.png",
    height: 36,
    instagram: "yousthetics",
    intro:
      "Ästhetik-Treatments mit Ergebnis statt Versprechen. Wir übersetzen Vorher-Nachher in Scrollstopper.",
  },
  {
    name: "The Dawn",
    logo: "/clients/the-dawn.png",
    height: 48,
    instagram: "thedawn.berlin",
    intro:
      "Der Ort, an dem gute Abende anfangen. Wir sorgen dafür, dass sie im Feed weitergehen.",
  },
  {
    name: "capvin",
    logo: "/clients/capvin.png",
    height: 31,
    instagram: "capvin.berlin",
    intro:
      "Neapolitanische Pizza von Weltmeister Vincenzo Capuano, mitten in Berlin. Champions-League-Teig, Champions-League-Content.",
  },
  {
    name: "StoneX", logo: "/clients/stonex.png", height: 22,
    instagram: "stonexbullion",
    intro:
      "Gold und Silber, online gehandelt. Wir machen aus Edelmetall Edelcontent.",
  },
  {
    name: "Nippli", logo: "/clients/nippli.png", height: 34,
    instagram: "nippli.de",
    intro:
      "Das freche Accessoire-Label, über das man zweimal scrollt. Perfektes Match für unsere Sprache.",
  },
  {
    name: "480 GRADI",
    tags: ["Social Media Management", "Content Creation", "Feed-Konzept", "Opening-Event"],
    logo: "/clients/480gradi.png",
    height: 44,
    instagram: "480gradi_",
    intro:
      "Pizzeria Napoletana, life is too short for bad pizza. Frisch auf der Berger Straße, frisch in deinem Feed.",
    caseStudy:
      "Der Wunsch: ein dunkler Flash-Photography-Feed, der sich von jeder anderen Pizzeria abhebt. Die Besonderheit: 480 GRADI ist ein Halal-Konzept, statt Drinks arbeiten wir mit Softdrinks und setzen den Fokus auf coole Models und echte Berliner Coolness. Das Ergebnis: ein Feed, der nach Nacht, Blitzlicht und neapolitanischer Pizza schmeckt, und genau deshalb hängen bleibt.",
    gallery: [
      "/referenzen/480-gradi/4.webp",
      "/referenzen/480-gradi/9.webp",
      "/referenzen/480-gradi/10.webp",
      "/referenzen/480-gradi/12.webp",
      "/referenzen/480-gradi/18.webp",
      "/referenzen/480-gradi/19.webp",
      "/referenzen/480-gradi/21.webp",
      "/referenzen/480-gradi/26.webp",
      "/referenzen/480-gradi/27.webp",
      "/referenzen/480-gradi/30.webp",
      "/referenzen/480-gradi/32.webp",
      "/referenzen/480-gradi/38.webp",
      "/referenzen/480-gradi/45.webp",
      "/referenzen/480-gradi/48.webp",
      "/referenzen/480-gradi/50.webp",
      "/referenzen/480-gradi/52.webp",
      "/referenzen/480-gradi/53.webp",
      "/referenzen/480-gradi/55.webp",
      "/referenzen/480-gradi/56.webp",
      "/referenzen/480-gradi/58.webp",
      "/referenzen/480-gradi/59.webp",
      "/referenzen/480-gradi/61.webp",
      "/referenzen/480-gradi/62.webp",
      "/referenzen/480-gradi/63.webp",
      "/referenzen/480-gradi/66.webp",
      "/referenzen/480-gradi/67.webp",
      "/referenzen/480-gradi/70.webp",
      "/referenzen/480-gradi/74.webp",
      "/referenzen/480-gradi/78.webp",
      "/referenzen/480-gradi/79.webp",
      "/referenzen/480-gradi/81.webp",
      "/referenzen/480-gradi/82.webp",
      "/referenzen/480-gradi/87.webp",
      "/referenzen/480-gradi/89.webp",
      "/referenzen/480-gradi/90.webp",
      "/referenzen/480-gradi/92.webp",
      "/referenzen/480-gradi/93.webp",
      "/referenzen/480-gradi/95.webp",
      "/referenzen/480-gradi/97.webp",
      "/referenzen/480-gradi/98.webp",
      "/referenzen/480-gradi/99.webp",
      "/referenzen/480-gradi/100.webp",
      "/referenzen/480-gradi/101.webp",
      "/referenzen/480-gradi/102.webp",
      "/referenzen/480-gradi/103.webp",
      "/referenzen/480-gradi/104.webp",
      "/referenzen/480-gradi/108.webp",
    ],
  },
  {
    name: "heycar", logo: "/clients/heycar.png", height: 31,
    instagram: "heycar_deutschland",
    intro:
      "Geprüfte Gebrauchtwagen, online und ohne Kopfschmerzen. Wir bringen PS in die Timeline.",
  },
  {
    name: "Vault", logo: "/clients/vault.png", height: 31,
    instagram: "vault.berlin",
    intro:
      "Berlins Speakeasy hinter der unscheinbaren Tür: Signature Cocktails, Live-Shows, Hidden Beats. Psst, wir erzählen es trotzdem allen.",
  },
  {
    name: "eDrixx", logo: "/clients/edrixx.png", height: 36,
    instagram: "edrixx_digital_tipping",
    intro:
      "Digitales Trinkgeld, ganz ohne Kleingeld. Eine Idee, die wir gerne groß machen.",
  },
  {
    name: "Bäckerei Huck",
    tags: ["Social Media Management", "Content Creation", "Recruiting-System"],
    logo: "/clients/huck.png",
    height: 36,
    instagram: "baeckerei.huck",
    intro:
      "Frankfurter Traditionsbäckerei mit echtem Handwerk. Wir holen den Ofenduft in den Feed.",
  },
  {
    name: "Green & Protein",
    logo: "/clients/green-protein.png",
    height: 26,
    instagram: "greenandprotein.de",
    intro:
      "Bowls, die gesund aussehen und noch besser performen. Meal-Prep fürs Auge, von uns angerichtet.",
  },
  {
    name: "BOLD", logo: "/clients/bold.png", height: 24,
    instagram: "boldberlin",
    intro:
      "PR- und Kommunikationsagentur zwischen Berlin und L.A.. Kultur-Marketing at its finest. Game recognizes game.",
  },
  {
    name: "Smash by Hauptstadtburger",
    logo: "/clients/smash.png",
    height: 31,
    instagram: "smash.hauptstadtburger",
    intro:
      "Die Smash-Linie von Hauptstadtburger: dünn gepresst, laut gecrunches, schneller weg als fotografiert. Wir sind trotzdem schneller.",
  },
  {
    name: "YNG", logo: "/clients/yng.png", height: 32,
    instagram: "yng.life.official",
    intro:
      "Longevity- und Beauty-Supplements für alle, die jung bleiben statt jung tun. Wir liefern den Glow im Feed dazu.",
  },
  {
    name: "Hauptstadtburger",
    logo: "/clients/hauptstadtburger.png",
    height: 56,
    instagram: "hauptstadtburger",
    intro:
      "Burger mit Hauptstadt-Attitüde, saftig, direkt, kein Blabla. So machen wir auch den Content.",
  },
  {
    name: "What Do You Fancy Love",
    logo: "/clients/wdyfl.png",
    height: 56,
    instagram: "whatdoyoufancylove",
    intro:
      "Das Café, dessen Name schon ein Caption ist. Kult-Spot mit Herz, wir halten den Hype warm.",
  },
  {
    name: "Reshape", logo: "/clients/reshape.png", height: 30,
    instagram: "reshape_berlin",
    intro:
      "Brasilianische Lymphdrainage in Berlin, der Instant-Glow-Up unter den Treatments. Vorher-Nachher, das niemand wegscrollt.",
  },
  {
    name: "nuva pizza",
    logo: "/clients/nuva.png",
    height: 34,
    instagram: "nuvapizza",
    intro:
      "Neapels ambitionierteste Pizza, steht so im Logo, stimmt auch. Wir liefern die Ambition fürs Digitale.",
  },
  {
    name: "Clärchens",
    logo: "/clients/claerchens.png",
    height: 40,
    intro:
      "Original seit 1913, eine Berliner Institution. Wir übersetzen über hundert Jahre Geschichte in einen Feed von heute.",
  },
  {
    name: "The Pioneer",
    logo: "/clients/the-pioneer.png",
    height: 22,
    intro:
      "Journalismus, der vorausfährt. Wir sorgen dafür, dass die Inhalte auch im Feed Kurs halten.",
  },
  {
    name: "BerlinCuisine",
    logo: "/clients/berlincuisine.png",
    height: 36,
    intro:
      "Contemporary Taste aus Berlin. Event-Catering auf höchstem Niveau. Wir richten es so an, dass es auch digital schmeckt.",
  },
  {
    name: "Sajent Club",
    tags: ["Social Media Management", "Content Creation", "TikTok & Shorts", "Influencer-Kampagnen"],
    logo: "/clients/sajent-club.png",
    height: 48,
    instagram: "sajentclub",
    intro:
      "Die Dating-App fürs Schmuck-Shopping. Match statt Suchen. Wir haben der App eine Online-Identität gebaut, die funkelt.",
    caseStudy:
      "Sajent Club kam mit einer Mission zu uns: die App als Must-have etablieren. Wir haben einen visuell markanten Content-Plan um Features und User-Benefits gebaut. App-Walkthroughs, Success-Stories, Lifestyle-Reels, Kooperationen mit Tech-Influencern und Lifestyle-Bloggern kuratiert und die Marke per TikTok und YouTube Shorts auf neue Plattformen gebracht. Interaktive Stories mit Polls und Quizzes machen aus Reichweite Downloads.",
  },
  {
    name: "Ultra OOH",
    logo: "/clients/ultra-ooh.png",
    height: 40,
    intro:
      "Out-of-Home, das man nicht übersehen kann. Wir verlängern die Plakatwand in den Feed.",
  },
  {
    name: "Das kann auch nach vorne losgehen",
    logo: "/clients/nach-vorne-losgehen.png",
    height: 44,
  },
];

/** Name of the client shown as "Newest Collaboration" on the homepage. */
export const newestCollab = "480 GRADI";

/** Calendly booking link, opened in a new tab (no embed, so no
 * third-party scripts load and the Datenschutzerklärung stays as is). */
export const calendlyUrl =
  "https://calendly.com/giulia_cavallino/boost-your-socials";

export const heroStats = [
  { value: 30, suffix: "+", label: "Marken" },
  { value: 6098, suffix: "+", label: "Reichweite/Monat" },
  { value: 2, suffix: "", label: "Städte" },
];

export type Service = {
  number: string;
  title: string;
  /** Optionaler, farblich abgesetzter Teil des Titels. */
  accent?: string;
  /** Einordnender Satz unter dem Titel. */
  tagline: string;
  bullets: string[];
  /** Hervorgehobenes Verkaufsargument unter den Bullets. */
  highlight?: string;
};

/** Die fünf Leistungsbereiche — Wortlaut nach dem Leistungsspektrum
 * der Agentur (Stand 08/2026), fürs Web gekürzt. Bewusst ohne
 * Gedankenstriche im Fließtext und ohne Preise. */
export const services: Service[] = [
  {
    number: "01",
    title: "Setup",
    tagline: "Die technische Grundlage, einmalig zum Projektstart.",
    bullets: [
      "Einrichtung der Zugänge für Facebook und Instagram im Business Manager, inklusive Werbeanzeigenmanager",
      "Identifikation der Geschäftsziele und Definition messbarer Ziele für die Social-Media-Präsenz",
      "Definition von Themen, Tonalität und Stil für die Zielgruppenansprache",
      "Implementierung von Analyse-Tools für die Auswertung der Performance",
    ],
  },
  {
    number: "02",
    title: "Strategie",
    tagline: "Die inhaltliche Grundlage, ausgelegt auf sechs Monate.",
    bullets: [
      "Analyse von Standorten und Konzepten, damit Inhalte und Ansprache passgenau darauf ausgerichtet sind",
      "Redaktionskalender mit allen relevanten Daten, Events und Anlässen",
      "Markenspezifische visuelle Vorlagen für einen durchgängigen roten Faden",
      "Storytelling rund um Marke, Produkte, Team und Gästeerfahrungen",
      "Auf Wunsch Influencer- und Kollaborationskampagnen mit lokalen Partnern, die authentisch zur Marke passen",
    ],
  },
  {
    number: "03",
    title: "Content Creation",
    accent: "und Kanalbetreuung",
    tagline: "Die laufende Arbeit am Kanal.",
    bullets: [
      "Regelmäßige Reels und Fotoposts, der Umfang wird individuell auf deine Marke und deine Ziele abgestimmt",
      "Laufende Storys zuzüglich Reposts, neue Beiträge werden per Story beworben",
      "Texterstellung, Bildrecherche und Editing für jeden Post",
      "Pflege der Story-Highlights",
      "Ausschließlich lizenzfreie Musik",
    ],
    highlight:
      "Produktion inklusive: Fotograf und Videograf sind Teil der Leistung, keine Zusatzposition.",
  },
  {
    number: "04",
    title: "Performance",
    accent: "Marketing",
    tagline: "Bezahlte Reichweite auf Instagram und Facebook.",
    bullets: [
      "Planung und Einrichtung der Kampagnenstruktur, zwei Kampagnen pro Monat",
      "Copy, Call-to-Action und Creatives für Meta Ads",
      "Pflege und Monitoring der laufenden Kampagnen",
      "Budgetverwaltung, das Werbebudget geht direkt an Meta und nicht über die Agentur",
      "Monatliches Reporting",
    ],
  },
  {
    number: "05",
    title: "Google",
    accent: "Unternehmensprofil",
    tagline: "Lokale Sichtbarkeit und Reputation.",
    bullets: [
      "Pflege und laufende Optimierung der Profile: Öffnungszeiten, Leistungen, Kategorien und Bildmaterial",
      "Monatlich ein Google-Beitrag je Profil für Angebote, News und Aktionen",
      "Bessere lokale Sichtbarkeit über Local-SEO-Grundlagen, Kategorien und Keywords im Profiltext",
      "Bewertungsmanagement: Antworten auf eingehende Bewertungen innerhalb von 48 Stunden im abgestimmten Tone of Voice",
      "Kritische Bewertungen inklusive Antwortvorschlag zur Freigabe, Prüfung auf Verstöße gegen die Google-Richtlinien und Meldung zur Entfernung",
      "Monatliches Reporting zu Profilaufrufen, Suchanfragen, Anrufen, Routenanfragen und Bewertungsschnitt",
    ],
  },
];

export type ExtraService = {
  title: string;
  /** Referenz, z. B. der Kunde, für den die Leistung aufgebaut wurde. */
  reference: string;
  bullets: string[];
  highlight?: string;
};

/** Zusatzleistungen jenseits des Standardpakets. */
export const extraServices: ExtraService[] = [
  {
    title: "Recruiting-System",
    reference: "Aufgebaut für Bäckerei Huck",
    bullets: [
      "Bewerbungen aus allen Kanälen laufen zentral in ein Dashboard: E-Mail, Social-Media-Funnel und Speed-Bewerbung per QR-Code direkt in der Filiale",
      "Jede neue Bewerbung löst automatisch eine Rückmeldung aus, mit Formular und Lebenslauf-Upload",
      "Am Ende liegt eine vollständige Bewerberakte vor, statt drei Zeilen aus einer Direktnachricht",
      "Keine Dubletten, eine einzige Quelle der Wahrheit",
    ],
    highlight: "Kein Recruiting-Marketing, sondern ein Prozess.",
  },
  {
    title: "Eventkommunikation",
    reference: "Regelmäßig umgesetzt für das KaDeWe",
    bullets: [
      "Eröffnungen, Aktionen und Saisonhöhepunkte mit Vorbereitung, Begleitung und Nachbereitung statt eines einzelnen Posts am Veranstaltungstag",
      "Besonders relevant bei Neueröffnungen, weil die Aufmerksamkeit dort nur einmal entsteht",
    ],
  },
];

export type CaseStudyTeaser = {
  /** Muss einem Eintrag in `clients` entsprechen (verlinkt auf dessen Seite). */
  client: string;
  /** Freigestelltes Mockup unter /public/cases. */
  image: string;
  /** Kurzfassung für die Startseite; der volle Case steht beim Kunden. */
  teaser: string;
  /** Kennzahl-Highlight, z. B. "6.000 → 49.000+ Follower". */
  stat: string;
};

/** Die drei Case Studies aus der Agentur-Präsentation für die Startseite. */
export const caseStudyTeasers: CaseStudyTeaser[] = [
  {
    client: "Goldies",
    image: "/cases/goldies.webp",
    stat: "6.000 → 49.000+ Follower",
    teaser:
      "Content-Revamp mit Food-Fotografie und Reels, Kooperationen in der Berliner und Frankfurter Gastro-Szene, Ausbau auf YouTube, aus einem unterschätzten Account wurde eine Community, die die Marke trägt.",
  },
  {
    client: "Frittenwerk",
    image: "/cases/frittenwerk.webp",
    stat: "125.000+ Follower auf Instagram",
    teaser:
      "Die Energie aus über 40 Stores in den Feed übersetzt: Urban Vibe, Signature Loaded Fries, virale Hooks, plus TikTok als neue Bühne. Reels im Millionen-Reichweiten-Bereich inklusive.",
  },
  {
    client: "Sajent Club",
    image: "/cases/sajent-club.webp",
    stat: "Von null auf Online-Identität",
    teaser:
      "App-Walkthroughs, Success-Stories und Lifestyle-Reels, kuratierte Influencer-Kooperationen und der Sprung auf TikTok und YouTube Shorts, interaktive Stories machen aus Reichweite Downloads.",
  },
];

export type Testimonial = {
  quote: string;
  name: string;
  /** Z. B. Rolle oder Unternehmen. */
  meta?: string;
  /** Sterne 1 bis 5, Standard 5. */
  rating?: number;
};

/** Echte Kundenstimmen. Wortlaut 1:1 aus der Bewertung übernommen,
 * nichts umformuliert. */
export const testimonials: Testimonial[] = [
  {
    quote:
      "Sehr angenehme und professionelle Zusammenarbeit. Giulia hat tolle Ergebnisse auf unseren Social Media Accounts erzielt. Wir können die Agentur definitiv weiterempfehlen",
    name: "Simon Meinberg",
    meta: "Inhaber & Geschäftsführer, Raumstation & Friends GmbH · via Sortlist",
    rating: 5,
  },
];

/** Link zu den Google-Bewertungen der Agentur. */
export const googleReviewsUrl =
  "https://www.google.com/search?q=GRID+Agency+Social+Media+Bewertungen";

export type RoadmapStep = {
  number: string;
  title: string;
  text: string;
};

/** So ist eine Zusammenarbeit getimed, nach der Roadmap aus der
 * Agentur-Präsentation. */
export const roadmap: RoadmapStep[] = [
  {
    number: "01",
    title: "Terminanfrage",
    text: "Frage über unsere Homepage eine kostenlose Erstberatung an und beantworte uns einige kurze Fragen.",
  },
  {
    number: "02",
    title: "Beratungsgespräch",
    text: "Giulia führt mit dir ein Vorgespräch und prüft, wie wir dir am besten helfen können.",
  },
  {
    number: "03",
    title: "Beauftragung",
    text: "Wenn du ein gutes Gefühl hast, freuen wir uns über deine Beauftragung. Wir starten umgehend zum Beginn des nächsten Monats.",
  },
  {
    number: "04",
    title: "Set-up & Strategie",
    text: "Wir beginnen damit, eine Strategie für dein Unternehmen zu erarbeiten. Im Anschluss benötigen wir von dir sämtliche Zugänge, Logos und vorhandenes Video- und Bildmaterial.",
  },
  {
    number: "05",
    title: "Zusammenarbeit",
    text: "Wir betreuen dich mindestens 12 Monate, um an deiner Brand optimale Ergebnisse zu erzielen. So richtig spürbar wird es ab dem dritten Monat. Danach gibt es für deinen digitalen Fußabdruck kein Halten mehr.",
  },
];

export type ProcessStep = {
  number: string;
  title: string;
  claim: string;
  text: string;
};

export const processSteps: ProcessStep[] = [
  {
    number: "01",
    title: "Setup",
    claim: "Erst das Fundament. Dann die Show.",
    text: "Zugänge, Ziele, Analytics, wir verkabeln alle Plattformen und definieren, was Erfolg für dich überhaupt heißt. Messbar. Nicht gefühlt.",
  },
  {
    number: "02",
    title: "Strategie",
    claim: "Kein Bauchgefühl. Ein System.",
    text: "Content-Pillars, Tonalität, Roadmap. Deine Marke bekommt eine Stimme, die man im Feed sofort erkennt, und einen Plan, der sie trägt.",
  },
  {
    number: "03",
    title: "Content Days",
    claim: "Ein Tag Dreh. Ein Monat Content.",
    text: "Shotlist, Regie, Hook-Mechaniken, wir konzipieren jede Aufnahme auf die ersten 1,5 Sekunden. Der Rest ist Handwerk.",
  },
  {
    number: "04",
    title: "Editing",
    claim: "Rohmaterial rein. Scrollstopper raus.",
    text: "Schnitt, Untertitel, Sound, Timing. Aus deinem Material werden Reels, die man nicht wegwischen kann.",
  },
  {
    number: "05",
    title: "Scale",
    claim: "Zwei Schritte voraus. Immer.",
    text: "Wöchentliche Strategie-Calls, Trend-Scanning, Benchmarks. Wenn der Trend bei allen ankommt, sind wir schon beim nächsten.",
  },
];

export const team = {
  name: "Giulia Cavallino",
  initials: "GC",
  role: "Founder & Head of Everything",
  bio: "Glaubt an gute Hooks mehr als an Horoskope. Baut seit 2021 Marken, die man nicht wegscrollen kann, von Berlin bis Frankfurt.",
  facts: [
    { value: "∞", label: "Ideen pro Tag" },
    { value: "24/7", label: "online (leider)" },
    { value: "1", label: "Ziel: dein Wachstum" },
  ],
};

/** Agentur-Vita für die Über-uns-Sektion — Stationen aus der
 * Agentur-Präsentation. */
export const vita = [
  {
    year: "2021",
    text: "Gründung in Berlin-Mitte. Giulia sammelt die ersten Erfahrungen mit unseren heutigen Kunden, damals noch vom WG-Schreibtisch aus, ganz ohne Büro.",
  },
  {
    year: "2022",
    text: "Die Agentur spezialisiert sich zunehmend auf Dienstleister, Gastronomie und Lifestyle-Brands.",
  },
  {
    year: "2023",
    text: "GRID wächst auf ein Team von sechs und bezieht das Büro in der Linienstraße. Die erste Welle an Anfragen bringt die Erkenntnis: Aus der Agentur muss ein Business werden.",
  },
  {
    year: "2024",
    text: "Die Agentur wächst weiter, hinterfragt Strukturen und definiert sie neu. Das Ziel: dein Social Media auf Autopilot.",
  },
];
