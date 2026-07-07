export type Client = {
  name: string;
  /** Path under /public; falls back to a text wordmark when missing. */
  logo?: string;
  /** Rendered logo height in px (defaults to 32). */
  height?: number;
};

export const clients: Client[] = [
  { name: "Friendly Fish", logo: "/clients/friendly-fish.png", height: 20 },
  { name: "Frittenwerk", logo: "/clients/frittenwerk.png", height: 22 },
  { name: "Goldies", logo: "/clients/goldies.png", height: 30 },
  { name: "The Dawn", logo: "/clients/the-dawn.png", height: 40 },
  { name: "lovebirds", logo: "/clients/lovebirds.png", height: 30 },
  { name: "yousthetics", logo: "/clients/yousthetics.png", height: 40 },
  { name: "nuva pizza", logo: "/clients/nuva.png", height: 36 },
  { name: "capvin", logo: "/clients/capvin.png", height: 26 },
  { name: "480 GRADI", logo: "/clients/480gradi.png", height: 26 },
  {
    name: "charly & ben bagels",
    logo: "/clients/charly-ben.png",
    height: 48,
  },
  { name: "Marré", logo: "/clients/marre.png", height: 24 },
  {
    name: "Smash by Hauptstadtburger",
    logo: "/clients/smash.png",
    height: 36,
  },
  {
    name: "Hauptstadtburger",
    logo: "/clients/hauptstadtburger.png",
    height: 44,
  },
  { name: "Tokyo Mylk", logo: "/clients/tokyo-mylk.png", height: 44 },
  { name: "Casa Beef", logo: "/clients/casa-beef.png", height: 30 },
  { name: "Bäckerei Huck", logo: "/clients/huck.png", height: 36 },
  { name: "Shiso Burger", logo: "/clients/shiso.png", height: 36 },
  { name: "eDrixx", logo: "/clients/edrixx.png", height: 34 },
  { name: "Vault", logo: "/clients/vault.png", height: 34 },
  { name: "Ditsch", logo: "/clients/ditsch.png", height: 34 },
  { name: "BOLD", logo: "/clients/bold.png", height: 24 },
  { name: "Nippli", logo: "/clients/nippli.png", height: 30 },
  {
    name: "What Do You Fancy Love",
    logo: "/clients/wdyfl.png",
    height: 44,
  },
  { name: "Kindly", logo: "/clients/kindly.png", height: 26 },
  { name: "Hasir", logo: "/clients/hasir.png", height: 30 },
  { name: "StoneX", logo: "/clients/stonex.png", height: 24 },
  { name: "heycar", logo: "/clients/heycar.png", height: 28 },
  {
    name: "Green & Protein",
    logo: "/clients/green-protein.png",
    height: 26,
  },
  { name: "Lipstick", logo: "/clients/lipstick.png", height: 30 },
  { name: "Coffi", logo: "/clients/coffi.png", height: 28 },
  { name: "Reshape" },
  { name: "YNG", logo: "/clients/yng.png", height: 26 },
];

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
