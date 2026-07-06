export type StorySlide = {
  title: string;
  text: string;
};

export type ServiceStory = {
  id: string;
  label: string;
  emoji: string;
  slides: StorySlide[];
};

export const serviceStories: ServiceStory[] = [
  {
    id: "strategy",
    label: "Strategy",
    emoji: "🧭",
    slides: [
      {
        title: "Strategie, die 2030 denkt.",
        text: "Zieldefinition, Content-Pillars, Tonalität — wir bauen das Fundament, bevor andere überhaupt posten.",
      },
      {
        title: "Set-up aller Kanäle.",
        text: "Instagram, TikTok, LinkedIn — eingerichtet, verzahnt und messbar von Tag eins.",
      },
      {
        title: "Analyse-Tools inklusive.",
        text: "Was nicht gemessen wird, existiert nicht. Performance-Tracking gehört zum Set-up.",
      },
    ],
  },
  {
    id: "content-days",
    label: "Content Days",
    emoji: "🎬",
    slides: [
      {
        title: "Ein Tag. Ein Monat Content.",
        text: "Koordination, Shotlist, Regie vor Ort — mit Videograf:innen oder eurem eigenen Team.",
      },
      {
        title: "Hooks, die halten.",
        text: "Wir konzipieren jede Aufnahme auf die ersten 1,5 Sekunden hin. Der Rest ist Handwerk.",
      },
    ],
  },
  {
    id: "editing",
    label: "Editing",
    emoji: "✂️",
    slides: [
      {
        title: "Rohmaterial rein. Reels raus.",
        text: "Schnitt, Untertitel, Musik, Hook-Editing — fertig für Instagram, TikTok und LinkedIn.",
      },
      {
        title: "Euer Material reicht.",
        text: "Atelier-Aufnahmen, Prozess-Content, Handy-Videos — wir machen daraus Feed-Gold.",
      },
    ],
  },
  {
    id: "trends",
    label: "Trends 2030",
    emoji: "🛰️",
    slides: [
      {
        title: "Zwei Schritte voraus.",
        text: "Trend- & Benchmark-Scanning als Dauerzustand. Wir testen Formate, bevor sie Mainstream heißen.",
      },
      {
        title: "Wöchentliche Strategie-Calls.",
        text: "Performance, Kampagnen, saisonale Peaks — jede Woche neu justiert.",
      },
      {
        title: "Willkommen in 2030.",
        text: "Wenn der Trend bei allen ankommt, sind wir schon beim nächsten.",
      },
    ],
  },
];

export const profileStats = [
  { value: 6098, suffix: "+", label: "Reichweite/Monat" },
  { value: 15, suffix: "+", label: "Marken" },
  { value: 2, suffix: "", label: "Städte" },
];

export type FeedPost = {
  id: string;
  brand: string;
  handle: string;
  caption: string;
  hashtags: string[];
  likes: number;
  emoji: string;
  accent: string;
};

export const feedPosts: FeedPost[] = [
  {
    id: "casa-beef",
    brand: "Casa Beef",
    handle: "casabeefberlin",
    caption:
      "Eine kulturelle Erfahrung rund um Fleisch und Handwerkskunst — inszeniert als Feed, der Hunger macht.",
    hashtags: ["berlin", "finedining", "socialmedia"],
    likes: 2841,
    emoji: "🥩",
    accent: "#37255B",
  },
  {
    id: "huck",
    brand: "Bäckerei Huck",
    handle: "baeckerei.huck",
    caption:
      "Handwerk seit Generationen, erzählt in Reels: WE WILL WAGYU wurde zum Hook, der Frankfurt ins Schaufenster zog.",
    hashtags: ["frankfurt", "bakery", "reels"],
    likes: 1976,
    emoji: "🥐",
    accent: "#F2AF02",
  },
  {
    id: "green-protein",
    brand: "Green & Protein",
    handle: "greenandprotein",
    caption:
      "Healthy Living, bold photography. Ein Grid, das so frisch aussieht wie die Bowls.",
    hashtags: ["healthyfood", "berlin", "contentday"],
    likes: 3204,
    emoji: "🥗",
    accent: "#00864A",
  },
  {
    id: "shiso",
    brand: "Shiso Burger",
    handle: "shisoburger",
    caption:
      "Asian Fusion trifft Street Food — DE & INT parallel bespielt, ein Look, zwei Sprachen.",
    hashtags: ["burger", "fusion", "socialfirst"],
    likes: 2588,
    emoji: "🍔",
    accent: "#C4402A",
  },
];

export type Reel = {
  id: string;
  line1: string;
  line2: string;
  sub: string;
  tag: string;
};

export const reels: Reel[] = [
  {
    id: "r1",
    line1: "Andere planen",
    line2: "Quartale.",
    sub: "Wir denken in Trendzyklen von 48 Stunden.",
    tag: "SPEED",
  },
  {
    id: "r2",
    line1: "Der Feed ist",
    line2: "tot.",
    sub: "Es lebe der Moment. Content, der passiert — nicht produziert wirkt.",
    tag: "RAW",
  },
  {
    id: "r3",
    line1: "Reichweite",
    line2: "ist Handwerk.",
    sub: "Kein Zufall, kein Glück. Ein System, das wir seit 2021 verfeinern.",
    tag: "CRAFT",
  },
  {
    id: "r4",
    line1: "Willkommen",
    line2: "in 2030.",
    sub: "Wenn der Trend bei allen ankommt, sind wir schon zwei Schritte weiter.",
    tag: "FUTURE",
  },
];
