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
