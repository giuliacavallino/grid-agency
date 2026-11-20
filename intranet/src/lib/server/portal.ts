import "server-only";
import { createHash, randomBytes } from "node:crypto";
import { DEMO, SHARED_MAILBOX } from "@/lib/config";
import { POST_FORMATS, type Provider, type SocialPost } from "@/lib/marketing";
import { LOGIN_MINUTES, PORTAL_COOKIE, SESSION_DAYS, type PortalPost, type PortalUser, type PortalView, type PortalWindow } from "@/lib/portal";
import { PERIOD_LABELS, progress, QUOTA_KINDS, ruleText, rulesFor, windowOf } from "@/lib/posting-plan";
import { check } from "./billing";
import { sb } from "./db";
import { sendAppMail } from "./graph-app";
import { brandedMail, senderFor } from "./mail-template";
import { getPostingPlan } from "./social/posting-plan";
import { withUrls } from "./social/media";
import { listAccounts, listPosts, listWorkspaces } from "./social/store";

export class PortalError extends Error {}

const hash = (token: string) => createHash("sha256").update(token).digest("hex");
const clean = (email: string) => email.trim().toLowerCase();
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// ---------- Freigeschaltete Personen (Akte → Einstellungen → Kundenzugang) ----------

export async function listPortalUsers(workspaceId: string): Promise<PortalUser[]> {
  if (DEMO) return [];
  return check(await sb().from("portal_users").select("*").eq("workspace_id", workspaceId).order("created_at")) as PortalUser[];
}

export async function addPortalUser(workspaceId: string, input: { email: string; name?: string | null }, by: string) {
  const email = clean(input.email ?? "");
  if (!EMAIL.test(email)) throw new PortalError("Bitte eine gültige E-Mail-Adresse angeben");
  if (DEMO) throw new PortalError("In der Vorschau nicht verfügbar");
  check(
    await sb()
      .from("portal_users")
      .upsert({ workspace_id: workspaceId, email, name: input.name?.trim() || null, active: true, created_by: by }, { onConflict: "workspace_id,email" })
  );
  return listPortalUsers(workspaceId);
}

export async function removePortalUser(workspaceId: string, id: string) {
  if (DEMO) return [];
  check(await sb().from("portal_users").delete().eq("workspace_id", workspaceId).eq("id", id));
  return listPortalUsers(workspaceId);
}

/** Workspaces, die eine Adresse sehen darf */
async function workspacesFor(email: string) {
  if (DEMO) return (await listWorkspaces()).filter((w) => w.kind === "customer").slice(0, 2);
  const rows = check(await sb().from("portal_users").select("workspace_id").eq("email", clean(email)).eq("active", true)) as { workspace_id: string }[];
  const ids = new Set(rows.map((r) => r.workspace_id));
  return (await listWorkspaces()).filter((w) => ids.has(w.id));
}

// ---------- Anmeldung per Link ----------

async function storeToken(kind: "login" | "session", email: string, ms: number) {
  const token = randomBytes(32).toString("base64url");
  if (!DEMO) {
    check(await sb().from("portal_tokens").insert({ token_hash: hash(token), kind, email: clean(email), expires_at: new Date(Date.now() + ms).toISOString() }));
  }
  return token;
}

const loginUrl = (origin: string, token: string) => `${process.env.INTRANET_URL ?? origin}/portal/anmelden?token=${encodeURIComponent(token)}`;

/** Anmeldelink an eine freigeschaltete Adresse schicken. Unbekannte Adressen
 * bekommen nichts (die Antwort verrät nicht, ob es die Adresse gibt). */
export async function requestLogin(rawEmail: string, origin: string, invite?: { by: string; workspace: string }) {
  const email = clean(rawEmail);
  if (!EMAIL.test(email)) throw new PortalError("Bitte eine gültige E-Mail-Adresse angeben");
  const workspaces = await workspacesFor(email);
  if (!workspaces.length) return { sent: false };
  const token = await storeToken("login", email, (invite ? 7 * 24 * 60 : LOGIN_MINUTES) * 60_000);
  const url = loginUrl(origin, token);
  if (DEMO) return { sent: true, demo_url: url };
  const names = workspaces.map((w) => w.name).join(", ");
  const html = brandedMail({
    eyebrow: "GRID Kundenportal",
    title: invite ? `Dein Zugang für ${invite.workspace}` : "Dein Anmeldelink",
    paragraphs: invite
      ? [
          "Hallo,",
          `ab sofort siehst du im GRID Kundenportal jederzeit, was für ${invite.workspace} wann gepostet wird und wie viele Beiträge diese Woche und diesen Monat schon eingeplant sind.`,
          "Mit dem Button meldest du dich direkt an. Später forderst du auf derselben Seite einfach einen neuen Link mit deiner E-Mail-Adresse an.",
        ]
      : ["Hallo,", `hier ist dein Link zum GRID Kundenportal (${names}).`],
    button: { label: "Zum Kundenportal", href: url },
    note: invite ? "Der Link ist 7 Tage gültig und funktioniert einmal." : `Der Link ist ${LOGIN_MINUTES} Minuten gültig und funktioniert einmal. Falls du ihn nicht angefordert hast, ignoriere diese Mail einfach.`,
    sender: invite ? senderFor(/giulia/i.test(invite.by) ? "Giulia" : "GRID Agency", invite.by) : senderFor("GRID Agency"),
  });
  await sendAppMail(SHARED_MAILBOX, { to: [email], subject: invite ? `Dein Zugang zum GRID Kundenportal (${invite.workspace})` : "Dein Anmeldelink für das GRID Kundenportal", body: html, html: true });
  if (invite) check(await sb().from("portal_users").update({ invited_at: new Date().toISOString() }).eq("email", email));
  return { sent: true };
}

/** Anmeldelink einlösen: liefert das Sitzungs-Token für das Cookie */
export async function redeemLogin(token: string) {
  if (DEMO) return { session: `demo.${token.slice(0, 8)}`, email: "vorschau@kunde.de" };
  if (!token || token.length < 20) return null;
  const { data } = await sb().from("portal_tokens").select("email,expires_at,used_at,kind").eq("token_hash", hash(token)).maybeSingle();
  const row = data as { email: string; expires_at: string; used_at: string | null; kind: string } | null;
  if (!row || row.kind !== "login" || row.used_at || Date.parse(row.expires_at) < Date.now()) return null;
  // Nur einmal einlösbar (auch bei zwei gleichzeitigen Klicks)
  const used = await sb().from("portal_tokens").update({ used_at: new Date().toISOString() }).eq("token_hash", hash(token)).is("used_at", null).select("email");
  if (!used.data?.length) return null;
  if (!(await workspacesFor(row.email)).length) return null;
  const session = await storeToken("session", row.email, SESSION_DAYS * 86_400_000);
  check(await sb().from("portal_users").update({ last_login_at: new Date().toISOString() }).eq("email", row.email).eq("active", true));
  return { session, email: row.email };
}

export const sessionCookie = (value: string, maxAge = SESSION_DAYS * 86_400) =>
  `${PORTAL_COOKIE}=${value}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAge}${process.env.NODE_ENV === "production" ? "; Secure" : ""}`;

function cookieOf(request: Request) {
  const raw = request.headers.get("cookie") ?? "";
  const match = raw.split(/;\s*/).find((part) => part.startsWith(`${PORTAL_COOKIE}=`));
  return match ? decodeURIComponent(match.slice(PORTAL_COOKIE.length + 1)) : null;
}

/** E-Mail der angemeldeten Person oder null */
export async function portalSession(request: Request) {
  const token = cookieOf(request);
  if (!token) return null;
  if (DEMO) return token.startsWith("demo.") ? "vorschau@kunde.de" : null;
  const { data } = await sb().from("portal_tokens").select("email,expires_at,kind").eq("token_hash", hash(token)).maybeSingle();
  const row = data as { email: string; expires_at: string; kind: string } | null;
  if (!row || row.kind !== "session" || Date.parse(row.expires_at) < Date.now()) return null;
  return row.email;
}

export async function endSession(request: Request) {
  const token = cookieOf(request);
  if (token && !DEMO) await sb().from("portal_tokens").delete().eq("token_hash", hash(token));
}

// ---------- Ansicht ----------

const shown = (post: SocialPost): PortalPost["status"] | null => {
  if (post.status === "published") return "online";
  if (post.status === "partial" || post.status === "failed") return post.published_at ? "online" : "fehler";
  if (post.status === "scheduled" || post.status === "publishing") return "geplant";
  if (post.status === "draft" && post.scheduled_at) return "abstimmung";
  return null;
};

export async function portalView(email: string, workspaceId: string | null, origin: string): Promise<PortalView | null> {
  const workspaces = await workspacesFor(email);
  const workspace = workspaces.find((w) => w.id === workspaceId) ?? workspaces[0];
  if (!workspace) return null;
  const summary = (w: (typeof workspaces)[number]) => ({ id: w.id, name: w.name, color: w.color, avatar_url: w.avatar_url, logo_url: w.logo_url });

  const [posts, plan, accounts] = await Promise.all([listPosts({ workspace_id: workspace.id, limit: 500 }), getPostingPlan(workspace.id), listAccounts(workspace.id)]);
  const providerOf = new Map(accounts.map((a) => [a.id, a.provider as Provider]));

  // Zeitraum: zwei Wochen zurück bis acht Wochen voraus
  const now = Date.now();
  const from = now - 14 * 86_400_000;
  const to = now + 56 * 86_400_000;
  const visible: PortalPost[] = posts
    .map((post) => {
      const status = shown(post);
      const at = post.published_at ?? post.scheduled_at;
      if (!status || !at) return null;
      const time = Date.parse(at);
      if (time < from || time > to) return null;
      return {
        id: post.id,
        at,
        status,
        format: post.format && post.format in POST_FORMATS ? post.format : "feed",
        caption: post.caption,
        media: withUrls(post.media.filter((m) => m.kind !== "audio"), origin)
          .slice(0, 10)
          .map((m) => ({ url: m.url!, kind: m.kind === "video" ? ("video" as const) : ("image" as const) })),
        providers: [...new Set(post.account_ids.map((id) => providerOf.get(id)).filter((p): p is Provider => !!p))],
      } satisfies PortalPost;
    })
    .filter((p): p is PortalPost => !!p)
    .sort((a, b) => a.at.localeCompare(b.at));

  let windows: PortalWindow[] = [];
  if (workspace.planning && plan.rules.length) {
    const week = windowOf("week");
    const nextWeek = windowOf("week", new Date(Date.parse(`${week.to}T12:00:00Z`) + 2 * 86_400_000));
    const month = windowOf("month");
    const make = (key: string, label: string, w: ReturnType<typeof windowOf>, period: "week" | "month") => ({
      key,
      label,
      from: w.from,
      to: w.to,
      quotas: rulesFor(plan, period)
        // Rhythmus („alle 2 Tage“) nur bei den Wochen, sonst doppelt
        .filter((rule) => !(period === "month" && rule.period === "days"))
        .map((rule) => {
          const p = progress(rule, posts, w);
          return {
            label: QUOTA_KINDS[rule.kind].label,
            rule: rule.period === "days" ? ruleText(rule) : PERIOD_LABELS[rule.period],
            required: p.required,
            max: p.max,
            done: p.done,
            open: p.open,
          };
        }),
    });
    windows = [make("woche", `Diese Woche (${week.label})`, week, "week"), make("naechste", `Nächste Woche (${nextWeek.label})`, nextWeek, "week"), make("monat", month.label, month, "month")].filter(
      (w) => w.quotas.length
    );
  }

  return {
    email,
    workspaces: workspaces.map(summary),
    workspace: { ...summary(workspace), planning: workspace.planning },
    plan: windows.length ? { start: plan.start, windows, platforms: plan.platforms } : null,
    posts: visible,
  };
}
