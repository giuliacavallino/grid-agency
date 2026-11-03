// Marketing Hub: Typen für Browser und Server

export type Provider = "canva" | "linkedin" | "facebook" | "instagram" | "tiktok";

/** Was man verbinden kann (Meta verbindet Facebook-Seiten und Instagram zusammen) */
export type ConnectProvider = "canva" | "linkedin" | "meta" | "tiktok";

export type Workspace = {
  id: string;
  name: string;
  kind: "agency" | "customer";
  /** CI: Hauptfarbe, Zweitfarbe, Logo (öffentliche Adresse) */
  color: string;
  secondary_color: string | null;
  logo_url: string | null;
  /** Profilbild wie bei Instagram (rund im Hub), getrennt vom Logo für Grafiken */
  avatar_url: string | null;
  project_id: string | null;
  customer_id: string | null;
  archived: boolean;
  /** Ordner in SharePoint für Bilder, Videos usw. */
  sharepoint_url: string | null;
};

/** Verbundenes Konto, so wie der Browser es sieht (ohne Tokens) */
export type SocialAccount = {
  id: string;
  workspace_id: string;
  provider: Provider;
  external_id: string;
  name: string;
  handle: string | null;
  avatar_url: string | null;
  expires_at: string | null;
  status: "active" | "error";
  error: string | null;
  connected_by: string | null;
  connected_at: string;
};

export type MediaItem = {
  path: string;
  mime: string;
  /** audio: Voiceover/Musik für Videos, nicht direkt postbar */
  kind: "image" | "video" | "audio";
  width?: number;
  height?: number;
  canva_design_id?: string;
  /** Kopie im SharePoint-Ordner der Kundenwelt */
  sharepoint_url?: string;
  /** Öffentliche Adresse für Meta/TikTok (vom Server ergänzt) */
  url?: string;
};

export type PostStatus = "draft" | "scheduled" | "publishing" | "published" | "partial" | "failed";

export type PostResult = { status: "published" | "failed"; remote_id?: string; url?: string; error?: string; at: string };

export type SocialPost = {
  id: string;
  created_at: string;
  updated_at: string;
  workspace_id: string;
  status: PostStatus;
  caption: string;
  media: MediaItem[];
  account_ids: string[];
  scheduled_at: string | null;
  published_at: string | null;
  results: Record<string, PostResult>;
  created_by: string | null;
};

export const PROVIDERS: Record<Provider, { label: string; color: string }> = {
  canva: { label: "Canva", color: "#00c4cc" },
  linkedin: { label: "LinkedIn", color: "#0a66c2" },
  facebook: { label: "Facebook", color: "#1877f2" },
  instagram: { label: "Instagram", color: "#d62976" },
  tiktok: { label: "TikTok", color: "#25f4ee" },
};

export const CONNECTORS: { id: ConnectProvider; label: string; text: string; providers: Provider[] }[] = [
  { id: "meta", label: "Instagram + Facebook", text: "Facebook-Seiten und die verknüpften Instagram-Business-Konten", providers: ["instagram", "facebook"] },
  { id: "linkedin", label: "LinkedIn", text: "Unternehmensseiten, auf denen das Konto Admin ist", providers: ["linkedin"] },
  { id: "tiktok", label: "TikTok", text: "TikTok-Konto (Videos und Foto-Posts)", providers: ["tiktok"] },
];

export const POST_STATUS: Record<PostStatus, { label: string; color?: string }> = {
  draft: { label: "Entwurf" },
  scheduled: { label: "Geplant", color: "#7fa8ff" },
  publishing: { label: "Wird gepostet" , color: "#f5a524" },
  published: { label: "Veröffentlicht", color: "#30a46c" },
  partial: { label: "Teilweise", color: "#f5a524" },
  failed: { label: "Fehler", color: "#e5484d" },
};

// ---------- CI-Welt (Vorgabe für Team und Agenten) ----------

export type BrandColor = { name: string; hex: string; role: "Primär" | "Sekundär" | "Akzent" | "Hintergrund" | "Text" | "Sonstige" };
export type BrandFont = { role: string; family: string; source?: string; notes?: string };
export type BrandLogo = { path: string; variant: string; notes?: string; url?: string };
/** Bildmaterial im Markenkit: Fotos, Grafiken, Icons (für Team und Agent) */
export type BrandAsset = { path: string; kind: "Foto" | "Grafik" | "Icon"; notes?: string; url?: string };
export const ASSET_KINDS: BrandAsset["kind"][] = ["Foto", "Grafik", "Icon"];

export type Brand = {
  website?: string;
  colors: BrandColor[];
  fonts: BrandFont[];
  logos: BrandLogo[];
  assets: BrandAsset[];
  tone: string;
  audience: string;
  imagery: string;
  dos: string[];
  donts: string[];
  hashtags: string[];
  /** Stimme für Voiceovers (ElevenLabs Voice-ID) */
  voice_id?: string;
  notes: string;
};

export const EMPTY_BRAND: Brand = { colors: [], fonts: [], logos: [], assets: [], tone: "", audience: "", imagery: "", dos: [], donts: [], hashtags: [], notes: "" };

export const COLOR_ROLES: BrandColor["role"][] = ["Primär", "Sekundär", "Akzent", "Hintergrund", "Text", "Sonstige"];

/** Die CI als klare Vorgabe in Textform: so bekommt sie der Agent */
export function agentBrief(name: string, brand: Brand) {
  const list = (items: string[]) => items.map((item) => `- ${item}`).join("\n");
  const parts = [
    `# CI-Vorgabe: ${name}`,
    "Halte dich bei allen Posts, Designs und Texten für diesen Kunden strikt an diese Vorgabe.",
    brand.website && `Website: ${brand.website}`,
    brand.colors.length && `## Farben\n${list(brand.colors.map((c) => `${c.role}: ${c.name} ${c.hex}`))}`,
    brand.fonts.length && `## Schriften\n${list(brand.fonts.map((f) => `${f.role}: ${f.family}${f.notes ? ` (${f.notes})` : ""}`))}`,
    brand.logos.length && `## Logos\n${list(brand.logos.map((l) => `${l.variant}${l.notes ? `: ${l.notes}` : ""}${l.url ? ` – ${l.url}` : ""}`))}`,
    brand.assets.length && `## Bildmaterial (Medienpfade für Posts)\n${list(brand.assets.map((a) => `${a.kind}${a.notes ? `: ${a.notes}` : ""} – ${a.path}`))}`,
    brand.tone && `## Tonalität\n${brand.tone}`,
    brand.audience && `## Zielgruppe\n${brand.audience}`,
    brand.imagery && `## Bildsprache\n${brand.imagery}`,
    brand.dos.length && `## Dos\n${list(brand.dos)}`,
    brand.donts.length && `## Don'ts\n${list(brand.donts)}`,
    brand.hashtags.length && `## Hashtags\n${brand.hashtags.join(" ")}`,
    brand.voice_id && `## Stimme (Voiceover)\nElevenLabs Voice-ID: ${brand.voice_id}`,
    brand.notes && `## Weitere Hinweise\n${brand.notes}`,
  ];
  return parts.filter(Boolean).join("\n\n");
}

// ---------- Posts vorschlagen (Trend-Recherche) und Autopilot ----------

export type PostProvider = Exclude<Provider, "canva">;

export type IdeaVisual = {
  /** Kurze Zeile für die Grafik (max. ~70 Zeichen) */
  headline: string;
  /** Zweite Zeile, optional */
  subline?: string;
  /** Bildformat der Grafik */
  format: "1:1" | "4:5" | "9:16" | "1.91:1";
};

export type PostIdea = {
  id: string;
  created_at: string;
  workspace_id: string;
  status: "new" | "used" | "dismissed";
  provider: PostProvider;
  title: string;
  /** Warum das Thema gerade relevant ist (Trend, Anlass) */
  trend: string;
  caption: string;
  hashtags: string[];
  visual: IdeaVisual;
  sources: { title: string; url: string }[];
  post_id: string | null;
  created_by: string | null;
};

/** Autopilot je Kundenwelt: recherchiert jede Woche, erstellt und plant Posts */
export type Autopilot = {
  enabled: boolean;
  providers: PostProvider[];
  /** Posts pro Woche je Plattform */
  per_week: number;
  /** Wochentage 1 = Mo … 7 = So */
  weekdays: number[];
  /** Uhrzeit (Berlin), z. B. "09:00" */
  time: string;
  /** auto: wird gepostet; review: landet als Entwurf mit Termin zur Freigabe */
  mode: "auto" | "review";
  /** Themen, auf die sich die Recherche konzentriert */
  focus: string;
  /** To-dos aus Calls automatisch übernehmen und an den Agenten geben */
  agent_calls: boolean;
  last_run?: string | null;
  last_result?: string | null;
};

export const DEFAULT_AUTOPILOT: Autopilot = { enabled: false, providers: ["linkedin"], per_week: 2, weekdays: [2, 4], time: "09:00", mode: "review", focus: "", agent_calls: false };

export const WEEKDAY_LABELS = ["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"];

/** Lesbare Schrift auf einer Farbfläche (hell auf dunkel, dunkel auf hell) */
export function inkOn(hex: string) {
  if (!/^#[0-9a-f]{6}$/i.test(hex)) return "#ffffff";
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b > 0.4 ? "#141414" : "#ffffff";
}
