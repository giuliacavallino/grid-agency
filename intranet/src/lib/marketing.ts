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
  /** Hinterlegte Profil-Links je Plattform (auch ohne Verbindung) */
  profiles: ProfileLinks;
  /** Social-Media-Planung (Planer, Tage-Autopilot); aus z. B. bei reiner Google-Betreuung */
  planning: boolean;
};

// ---------- Profile der Kanäle (Kachel im Cockpit) ----------

export type ProfileLinks = Partial<Record<PostProvider, string>>;

export const PROFILE_PROVIDERS: PostProvider[] = ["instagram", "tiktok", "facebook", "linkedin"];

export type ChannelProfile = {
  name: string;
  handle: string | null;
  avatar: string | null;
  followers?: number;
  following?: number;
  posts?: number;
  bio?: string;
  url: string | null;
};

export type ProfilePost = {
  id: string;
  image: string | null;
  caption: string;
  url: string | null;
  date: string | null;
  type: "image" | "video" | "carousel" | "text";
  likes?: number;
  comments?: number;
};

export type ProfileResponse = {
  connected: boolean;
  url: string | null;
  profile?: ChannelProfile;
  posts?: ProfilePost[];
  /** Was nicht geladen werden konnte (z. B. fehlende Rechte) */
  error?: string;
};

const HANDLE: Record<PostProvider, RegExp> = {
  instagram: /^[a-z0-9._]{1,30}$/i,
  tiktok: /^[a-z0-9._]{2,24}$/i,
  facebook: /^[a-z0-9.\-]{2,80}$/i,
  linkedin: /^[a-z0-9\-_.]{2,100}$/i,
};

const HOSTS: Record<PostProvider, string[]> = {
  instagram: ["instagram.com"],
  tiktok: ["tiktok.com"],
  facebook: ["facebook.com", "fb.com"],
  linkedin: ["linkedin.com"],
};

/** Pfade, die kein Profil sind (z. B. instagram.com/p/…) */
const RESERVED: Record<PostProvider, string[]> = {
  instagram: ["p", "reel", "reels", "explore", "stories", "accounts", "direct", "tv"],
  tiktok: [],
  facebook: ["share", "groups", "events", "watch", "marketplace", "login", "pages", "photo", "story.php", "permalink.php"],
  linkedin: [],
};

const canonical = (provider: PostProvider, handle: string, kind = "company") =>
  provider === "instagram"
    ? `https://www.instagram.com/${handle}/`
    : provider === "tiktok"
      ? `https://www.tiktok.com/@${handle}`
      : provider === "facebook"
        ? `https://www.facebook.com/${handle}`
        : `https://www.linkedin.com/${kind}/${handle}/`;

/** Profil-Link oder Name („@name“, „name“) in eine feste https-Adresse der
 * Plattform umwandeln; null, wenn es kein gültiges Profil ist. */
export function profileUrl(provider: PostProvider, input: string): string | null {
  const value = input.trim();
  if (!value || value.length > 300) return null;
  const looksLikeUrl = /^[a-z]+:\/\//i.test(value) || /^([a-z0-9-]+\.)*[a-z0-9-]+\.[a-z]{2,}\//i.test(value);
  if (!looksLikeUrl) {
    const handle = value.replace(/^@/, "");
    return HANDLE[provider].test(handle) && !RESERVED[provider].includes(handle.toLowerCase()) ? canonical(provider, handle) : null;
  }
  let url: URL;
  try {
    url = new URL(/^[a-z]+:\/\//i.test(value) ? value : `https://${value}`);
  } catch {
    return null;
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") return null;
  const host = url.hostname.toLowerCase();
  if (!HOSTS[provider].some((h) => host === h || host.endsWith(`.${h}`))) return null;
  const parts = url.pathname.split("/").filter(Boolean);
  if (provider === "facebook" && parts[0] === "profile.php") {
    const id = url.searchParams.get("id");
    return id && /^\d{3,25}$/.test(id) ? `https://www.facebook.com/profile.php?id=${id}` : null;
  }
  if (provider === "linkedin") {
    const [kind, slug] = parts;
    if (!["company", "school", "showcase", "in"].includes(kind ?? "") || !slug || !HANDLE.linkedin.test(slug)) return null;
    return canonical(provider, slug, kind);
  }
  const first = parts[0] ?? "";
  const handle = provider === "tiktok" ? (first.startsWith("@") ? first.slice(1) : "") : first;
  if (!HANDLE[provider].test(handle) || RESERVED[provider].includes(handle.toLowerCase())) return null;
  return canonical(provider, handle);
}

/** Kurzer Name aus einem Profil-Link, z. B. „@baeckerei“ */
export function profileHandle(provider: PostProvider, url: string) {
  try {
    const { pathname, searchParams } = new URL(url);
    const parts = pathname.split("/").filter(Boolean);
    if (provider === "linkedin") return parts[1] ?? null;
    if (provider === "facebook" && parts[0] === "profile.php") return searchParams.get("id");
    const first = parts[0]?.replace(/^@/, "");
    return first ? `@${first}` : null;
  } catch {
    return null;
  }
}

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
  /** Feed-Post (Standard), Story oder Karussell */
  format?: PostFormat;
  /** Social-Media-Tag, zu dem der Tage-Autopilot den Entwurf angelegt hat */
  day_id?: string | null;
  /** Änderungswünsche und Antworten des Agenten */
  review?: ReviewNote[];
};

export type PostFormat = "feed" | "story" | "carousel";
export const POST_FORMATS: Record<PostFormat, { label: string; ratio: string }> = {
  feed: { label: "Post", ratio: "4:5" },
  story: { label: "Story", ratio: "9:16" },
  carousel: { label: "Karussell", ratio: "4:5" },
};
export type ReviewNote = { at: string; by: string; text: string; kind: "wunsch" | "agent"; /** Grafiktexte des Agenten (für spätere Änderungen) */ slides?: { headline: string; subline: string }[] };
/** Kanäle, die Storys posten können */
export const STORY_PROVIDERS: PostProvider[] = ["instagram", "facebook"];

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
