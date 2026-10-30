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
};

export type MediaItem = {
  path: string;
  mime: string;
  kind: "image" | "video";
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
