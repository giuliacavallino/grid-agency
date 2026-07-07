export type Client = {
  name: string;
  /** Path under /public; falls back to a text wordmark when missing. */
  logo?: string;
  /** Rendered logo height in px (defaults to 32). */
  height?: number;
};

export const clients: Client[] = [
  { name: "Friendly Fish" },
  { name: "Frittenwerk" },
  { name: "Goldies", logo: "/clients/goldies.png", height: 30 },
  { name: "the dawn" },
  { name: "lovebirds", logo: "/clients/lovebirds.png", height: 44 },
  { name: "yousthetics" },
  { name: "nuva pizza" },
  { name: "capvin" },
  { name: "480 gradi" },
  {
    name: "charly & ben bagels",
    logo: "/clients/charly-ben.png",
    height: 48,
  },
  { name: "mare" },
  { name: "smash hauptstadt burger" },
  { name: "Tokyo Mylk", logo: "/clients/tokyo-mylk.png", height: 44 },
  { name: "Casa Beef" },
  { name: "Bäckerei Huck", logo: "/clients/huck.png", height: 36 },
  { name: "Shiso Burger", logo: "/clients/shiso.png", height: 36 },
];

export const heroStats = [
  { value: 16, suffix: "+", label: "Marken im Feed" },
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
