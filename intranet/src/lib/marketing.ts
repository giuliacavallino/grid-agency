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
  /** LinkedIn: Unternehmensseite oder persönliches Profil */
  kind?: "organization" | "member";
  /** LinkedIn-Seiten: Agent beantwortet Kommentare selbstständig */
  auto_reply?: boolean;
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
  { id: "linkedin", label: "LinkedIn", text: "Persönliches Profil und alle Unternehmensseiten, auf denen das Konto Admin ist", providers: ["linkedin"] },
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

export type Brand = {
  website?: string;
  colors: BrandColor[];
  fonts: BrandFont[];
  logos: BrandLogo[];
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

export const EMPTY_BRAND: Brand = { colors: [], fonts: [], logos: [], tone: "", audience: "", imagery: "", dos: [], donts: [], hashtags: [], notes: "" };

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

// ---------- Community Management (LinkedIn) ----------

export type CommentStatus = "new" | "replied" | "skipped" | "needs_human" | "failed" | "own" | "old";

export type SocialComment = {
  id: string;
  workspace_id: string;
  account_id: string;
  post_urn: string;
  object_urn: string;
  comment_urn: string;
  parent_urn: string | null;
  author_urn: string;
  text: string;
  post_text: string;
  commented_at: string | null;
  status: CommentStatus;
  reason: string | null;
  reply_text: string | null;
  reply_urn: string | null;
  replied_by: string | null;
  replied_at: string | null;
  error: string | null;
};

export const COMMENT_STATUS: Record<CommentStatus, { label: string; color?: string }> = {
  new: { label: "Offen", color: "#7fa8ff" },
  replied: { label: "Beantwortet", color: "#30a46c" },
  skipped: { label: "Ohne Antwort" },
  needs_human: { label: "Fürs Team", color: "#f5a524" },
  failed: { label: "Fehler", color: "#e5484d" },
  own: { label: "Eigener" },
  old: { label: "Älter" },
};

export type OutreachKind = "message" | "invitation";

export type Outreach = {
  id: string;
  created_at: string;
  workspace_id: string;
  account_id: string | null;
  kind: OutreachKind;
  recipient: string;
  profile_url: string;
  text: string;
  context: string | null;
  status: "draft" | "sent" | "discarded";
  created_by: string | null;
  sent_at: string | null;
  sent_by: string | null;
};

/** Notiz zur Kontaktanfrage: LinkedIn erlaubt höchstens 300 Zeichen */
export const INVITATION_LIMIT = 300;
