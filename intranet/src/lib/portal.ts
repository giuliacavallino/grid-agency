import type { PostFormat, Provider } from "@/lib/marketing";

// Kundenportal (/portal): Kund*innen sehen ihre Kundenwelt nur lesend –
// Fortschritt laut Postingplan („2 von 4 Beiträgen“) und eingeplante Posts.

export const PORTAL_COOKIE = "grid_portal";
/** Gültigkeit des Anmeldelinks und der Sitzung */
export const LOGIN_MINUTES = 30;
export const SESSION_DAYS = 30;

export type PortalUser = {
  id: string;
  created_at: string;
  workspace_id: string;
  email: string;
  name: string | null;
  active: boolean;
  invited_at: string | null;
  last_login_at: string | null;
};

export type PortalWorkspace = { id: string; name: string; color: string; avatar_url: string | null; logo_url: string | null };

export type PortalQuota = {
  /** z. B. „Beiträge“, „Storys“ */
  label: string;
  /** „pro Woche“, „alle 2 Tage“ … */
  rule: string;
  required: number;
  max: number | null;
  /** eingeplant bzw. veröffentlicht */
  done: number;
  /** Entwürfe mit Termin, noch in Abstimmung */
  open: number;
};

export type PortalWindow = { key: string; label: string; from: string; to: string; quotas: PortalQuota[] };

export type PortalPost = {
  id: string;
  at: string;
  status: "online" | "geplant" | "abstimmung" | "fehler";
  format: PostFormat;
  caption: string;
  media: { url: string; kind: "image" | "video" }[];
  providers: Provider[];
};

export type PortalView = {
  email: string;
  workspaces: PortalWorkspace[];
  workspace: PortalWorkspace & { planning: boolean };
  plan: { start: string | null; windows: PortalWindow[]; platforms: Provider[] } | null;
  posts: PortalPost[];
};
