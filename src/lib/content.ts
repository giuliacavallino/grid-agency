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
      "Asian Fusion trifft Burger-Kultur — Wasabi statt Ketchup. Ein Klassiker, den wir im Feed so frisch halten wie das Tatar.",
  },
  {
    name: "Goldies",
    logo: "/clients/goldies.png",
    height: 34,
    instagram: "goldies_smashburger",
    intro:
      "Kreuzberger Kult: Smashburger und goldene Fritten, für die man ansteht. Unser Job: dass der Feed genauso knuspert.",
  },
  {
    name: "Frittenwerk",
    logo: "/clients/frittenwerk.png",
    height: 22,
    instagram: "frittenwerk",
    intro:
      "Die Pommesmanufaktur, die Poutine nach Deutschland geholt hat. Deutschlandweit gesnackt, von uns ins Scrollen gebracht.",
  },
  {
    name: "Lipstick", logo: "/clients/lipstick.png", height: 16,
    instagram: "lipstick.film",
    intro:
      "All-in-One-Studio für Film, VFX & AI — gebucht von Marken wie Cartier und Moët. High-End-Content, den wir laut machen.",
  },
  {
    name: "Casa Beef",
    logo: "/clients/casa-beef.png",
    logoDetail: "/clients/casa-beef-lila.png",
    height: 34,
    instagram: "casa.beef",
    intro:
      "Beef in seiner schönsten Form. Wir bringen das Sizzling vom Grill direkt auf den Bildschirm.",
    caseStudy:
      "Über den Dächern Berlin-Charlottenburgs, im KaDeWe die Sechste, haben wir aus dem ehemaligen Beef Grill Club das Casa Beef gemacht: Wir haben das komplette Rebranding umgesetzt — vom Look bis zur Tonalität — und die Opening-Party auf die Beine gestellt. Full Service heißt bei uns wirklich full.",
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
      "Contemporary Pizza mit Charakter — knusprig, verliebt, fotogen. Genau unser Beuteschema.",
  },
  {
    name: "Coffi", logo: "/clients/coffi.png", height: 34,
    instagram: "coffi.app",
    intro:
      "Die App, die Kaffee scannt, trackt und versteht — mit Stories von über 500 Röstereien. Wir geben dem Ganzen die Reichweite.",
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
      "Berliner Institution für Turkish Cuisine — seit Jahrzehnten eine Legende. Wir erzählen sie weiter, Post für Post.",
  },
  {
    name: "Tokyo Mylk",
    logo: "/clients/tokyo-mylk.png",
    height: 60,
    instagram: "tokyo_mylk",
    intro:
      "Japanisch inspirierte Desserts und Drinks aus Frankfurt — süß, fotogen, viral-verdächtig. Wir liefern den letzten Schubs.",
  },
  {
    name: "Kindly", logo: "/clients/kindly.png", height: 31,
    instagram: "kindlyberlin",
    intro:
      "Specialty Coffee, Matcha und Healthy Bites in Charlottenburg. So ästhetisch, dass der Feed sich fast von selbst füllt — fast.",
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
      "Neapolitanische Pizza von Weltmeister Vincenzo Capuano — mitten in Berlin. Champions-League-Teig, Champions-League-Content.",
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
    logo: "/clients/480gradi.png",
    height: 44,
    instagram: "480gradi_",
    intro:
      "Pizzeria Napoletana — life is too short for bad pizza. Frisch auf der Berger Straße, frisch in deinem Feed.",
    caseStudy:
      "Der Wunsch: ein dunkler Flash-Photography-Feed, der sich von jeder anderen Pizzeria abhebt. Die Besonderheit: 480 GRADI ist ein Halal-Konzept — statt Drinks arbeiten wir mit Softdrinks und setzen den Fokus auf coole Models und echte Berliner Coolness. Das Ergebnis: ein Feed, der nach Nacht, Blitzlicht und neapolitanischer Pizza schmeckt — und genau deshalb hängen bleibt.",
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
      "Berlins Speakeasy hinter der unscheinbaren Tür: Signature Cocktails, Live-Shows, Hidden Beats. Psst — wir erzählen es trotzdem allen.",
  },
  {
    name: "eDrixx", logo: "/clients/edrixx.png", height: 36,
    instagram: "edrixx_digital_tipping",
    intro:
      "Digitales Trinkgeld, ganz ohne Kleingeld. Eine Idee, die wir gerne groß machen.",
  },
  {
    name: "Bäckerei Huck",
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
      "PR- und Kommunikationsagentur zwischen Berlin und L.A. — Kultur-Marketing at its finest. Game recognizes game.",
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
      "Burger mit Hauptstadt-Attitüde — saftig, direkt, kein Blabla. So machen wir auch den Content.",
  },
  {
    name: "What Do You Fancy Love",
    logo: "/clients/wdyfl.png",
    height: 56,
    instagram: "whatdoyoufancylove",
    intro:
      "Das Café, dessen Name schon ein Caption ist. Kult-Spot mit Herz — wir halten den Hype warm.",
  },
  {
    name: "Reshape", logo: "/clients/reshape.png", height: 30,
    instagram: "reshape_berlin",
    intro:
      "Brasilianische Lymphdrainage in Berlin — der Instant-Glow-Up unter den Treatments. Vorher-Nachher, das niemand wegscrollt.",
  },
  {
    name: "nuva pizza",
    logo: "/clients/nuva.png",
    height: 34,
    instagram: "nuvapizza",
    intro:
      "Neapels ambitionierteste Pizza — steht so im Logo, stimmt auch. Wir liefern die Ambition fürs Digitale.",
  },
];

/** Name of the client shown as "Newest Collaboration" on the homepage. */
export const newestCollab = "480 GRADI";

export const heroStats = [
  { value: 30, suffix: "+", label: "Marken" },
  { value: 6098, suffix: "+", label: "Reichweite/Monat" },
  { value: 2, suffix: "", label: "Städte" },
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
    text: "Zugänge, Ziele, Analytics — wir verkabeln alle Plattformen und definieren, was Erfolg für dich überhaupt heißt. Messbar. Nicht gefühlt.",
  },
  {
    number: "02",
    title: "Strategie",
    claim: "Kein Bauchgefühl. Ein System.",
    text: "Content-Pillars, Tonalität, Roadmap. Deine Marke bekommt eine Stimme, die man im Feed sofort erkennt — und einen Plan, der sie trägt.",
  },
  {
    number: "03",
    title: "Content Days",
    claim: "Ein Tag Dreh. Ein Monat Content.",
    text: "Shotlist, Regie, Hook-Mechaniken — wir konzipieren jede Aufnahme auf die ersten 1,5 Sekunden. Der Rest ist Handwerk.",
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
  bio: "Glaubt an gute Hooks mehr als an Horoskope. Baut seit 2021 Marken, die man nicht wegscrollen kann — von Berlin bis Frankfurt.",
  facts: [
    { value: "∞", label: "Ideen pro Tag" },
    { value: "24/7", label: "online (leider)" },
    { value: "1", label: "Ziel: dein Wachstum" },
  ],
};
