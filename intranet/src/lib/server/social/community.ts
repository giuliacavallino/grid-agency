import "server-only";
import { randomUUID } from "node:crypto";
import Anthropic from "@anthropic-ai/sdk";
import { DEMO } from "@/lib/config";
import { agentBrief, INVITATION_LIMIT, type CommentStatus, type Outreach, type OutreachKind, type SocialComment } from "@/lib/marketing";
import { sb } from "../db";
import { createComment, linkedinKind, listComments, recentOrgPosts, type LinkedinComment } from "./linkedin";
import { getAccount, getBrand, getWorkspace, listAccounts, updateAccountMeta, type AccountRow } from "./store";

// Community Management für LinkedIn:
// 1. Kommentare unter den letzten Posts jeder verbundenen Unternehmensseite
//    abrufen (Cron, stündlich), samt Antworten in laufenden Gesprächen.
// 2. Mit Autopilot beantwortet Claude neue Kommentare selbst, in der CI der
//    Kundenwelt. Spam bleibt liegen, Heikles geht ans Team (needs_human).
// 3. Outreach: Nachrichten und Kontaktanfragen bietet LinkedIn nur
//    ausgewählten Partnern per API an. Der Agent legt sie als Entwurf an, das
//    Team schickt sie mit einem Klick auf LinkedIn ab.
// Kommentare im persönlichen Profil kann LinkedIn nicht herausgeben
// (r_member_social ist gesperrt); als Person kommentieren geht aber.

const demo = { comments: [] as SocialComment[], outreach: [] as Outreach[] };

function check<T>({ data, error }: { data: T; error: { message: string } | null }) {
  if (error) throw new Error(error.message);
  return data;
}

// ---------- Kommentare: Daten ----------

export async function listCommentRows(filter: { workspace_id?: string; status?: CommentStatus; account_id?: string; limit?: number } = {}): Promise<SocialComment[]> {
  if (DEMO) {
    return demo.comments
      .filter((c) => (!filter.workspace_id || c.workspace_id === filter.workspace_id) && (!filter.status || c.status === filter.status) && (!filter.account_id || c.account_id === filter.account_id))
      .sort((a, b) => (b.commented_at ?? "").localeCompare(a.commented_at ?? ""))
      .slice(0, filter.limit ?? 200);
  }
  let query = sb().from("social_comments").select("*").order("commented_at", { ascending: false, nullsFirst: false }).limit(filter.limit ?? 200);
  if (filter.workspace_id) query = query.eq("workspace_id", filter.workspace_id);
  if (filter.status) query = query.eq("status", filter.status);
  if (filter.account_id) query = query.eq("account_id", filter.account_id);
  return check(await query) as SocialComment[];
}

export async function getComment(id: string): Promise<SocialComment | null> {
  if (DEMO) return demo.comments.find((c) => c.id === id) ?? null;
  return check(await sb().from("social_comments").select("*").eq("id", id).maybeSingle()) as SocialComment | null;
}

async function updateComment(id: string, patch: Partial<SocialComment>) {
  const next = { ...patch, updated_at: new Date().toISOString() };
  if (DEMO) return void Object.assign(demo.comments.find((c) => c.id === id) ?? {}, next);
  check(await sb().from("social_comments").update(next).eq("id", id));
}

/** Kommentar nur übernehmen, wenn er offen ist (kein doppeltes Antworten) */
async function claimComment(id: string, from: CommentStatus[]): Promise<SocialComment | null> {
  if (DEMO) {
    const c = demo.comments.find((x) => x.id === id && from.includes(x.status));
    if (c) c.status = "skipped";
    return c ? { ...c, status: from[0] } : null;
  }
  const rows = check(
    await sb().from("social_comments").update({ status: "skipped", reason: "Wird beantwortet …", updated_at: new Date().toISOString() }).eq("id", id).in("status", from).select("*")
  ) as SocialComment[];
  return rows[0] ?? null;
}

export async function setCommentStatus(id: string, status: Extract<CommentStatus, "new" | "skipped" | "needs_human">, reason?: string) {
  await updateComment(id, { status, reason: reason ?? null });
}

type NewComment = Omit<SocialComment, "id" | "reason" | "reply_text" | "reply_urn" | "replied_by" | "replied_at" | "error">;

async function insertComments(rows: NewComment[]) {
  if (!rows.length) return 0;
  if (DEMO) {
    let added = 0;
    for (const row of rows) {
      if (demo.comments.some((c) => c.account_id === row.account_id && c.comment_urn === row.comment_urn)) continue;
      demo.comments.push({ id: randomUUID(), reason: null, reply_text: null, reply_urn: null, replied_by: null, replied_at: null, error: null, ...row });
      added++;
    }
    return added;
  }
  const inserted = check(
    await sb().from("social_comments").upsert(rows, { onConflict: "account_id,comment_urn", ignoreDuplicates: true }).select("id")
  ) as { id: string }[];
  return inserted.length;
}

// ---------- Kommentare: Abrufen ----------

const isLinkedinPage = (a: AccountRow) => a.provider === "linkedin" && linkedinKind(a) === "organization" && a.status === "active";

/** Kommentare aller LinkedIn-Seiten (oder einer Kundenwelt) abrufen */
export async function syncComments(workspaceId?: string) {
  const accounts = await listAccounts(workspaceId);
  const ours = new Set(accounts.filter((a) => a.provider === "linkedin").map((a) => a.external_id));
  const report: { account: string; added?: number; error?: string }[] = [];
  for (const account of accounts.filter(isLinkedinPage)) {
    try {
      report.push({ account: account.name, added: await syncAccount(account, ours) });
    } catch (error) {
      report.push({ account: account.name, error: error instanceof Error ? error.message : "Fehler" });
    }
  }
  return report;
}

async function syncAccount(account: AccountRow, ours: Set<string>) {
  if (DEMO) return 0;
  // Beim ersten Abruf alles als „älter“ ablegen, damit der Agent nicht auf
  // Wochen alte Kommentare antwortet
  const first = !account.meta?.comments_synced_at;
  const known = new Set((await listCommentRows({ account_id: account.id, limit: 1000 })).map((c) => c.comment_urn));
  const rows: NewComment[] = [];
  const toRow = (c: LinkedinComment, post: { urn: string; text: string }): NewComment => ({
    workspace_id: account.workspace_id,
    account_id: account.id,
    post_urn: post.urn,
    object_urn: c.object,
    comment_urn: c.urn,
    parent_urn: c.parent,
    author_urn: c.actor,
    text: c.text.slice(0, 5000),
    post_text: post.text.slice(0, 3000),
    commented_at: c.created_at,
    status: ours.has(c.actor) ? "own" : first ? "old" : "new",
  });

  for (const post of await recentOrgPosts(account, 10)) {
    const ref = { urn: post.id, text: post.commentary ?? "" };
    for (const c of await listComments(account, post.id)) if (!known.has(c.urn)) rows.push(toRow(c, ref));
  }

  // Laufende Gespräche: Antworten unter Kommentaren, auf die wir in den
  // letzten 7 Tagen geantwortet haben (LinkedIn kennt nur eine Ebene)
  const since = Date.now() - 7 * 86_400_000;
  const threads = (await listCommentRows({ account_id: account.id, status: "replied", limit: 50 }))
    .filter((c) => c.replied_at && new Date(c.replied_at).getTime() > since)
    .map((c) => ({ thread: c.parent_urn ?? c.comment_urn, post: { urn: c.post_urn, text: c.post_text } }))
    .filter((t, i, all) => all.findIndex((x) => x.thread === t.thread) === i)
    .slice(0, 10);
  for (const { thread, post } of threads) {
    for (const c of await listComments(account, thread)) {
      if (!known.has(c.urn)) rows.push(toRow({ ...c, parent: c.parent ?? thread }, post));
    }
  }

  const added = await insertComments(rows.filter((r, i) => rows.findIndex((x) => x.comment_urn === r.comment_urn) === i));
  await updateAccountMeta(account.id, { comments_synced_at: new Date().toISOString() });
  return added;
}

// ---------- Kommentare: Antworten ----------

/** Antwort auf LinkedIn schreiben. Bei Antworten in einem Gespräch geht sie an
 * den obersten Kommentar (LinkedIn verschachtelt nur eine Ebene). */
export async function replyToComment(id: string, text: string, by: string) {
  const clean = text.trim().slice(0, 1250);
  if (!clean) throw new Error("Antwort ist leer");
  const comment = await claimComment(id, ["new", "needs_human", "failed", "skipped"]);
  if (!comment) throw new Error("Kommentar wird schon beantwortet oder ist erledigt");
  const account = await getAccount(comment.account_id);
  if (!account) {
    await updateComment(id, { status: "failed", error: "Kanal nicht mehr verbunden" });
    throw new Error("Kanal nicht mehr verbunden");
  }
  try {
    const thread = comment.parent_urn ?? comment.comment_urn;
    const urn = DEMO ? `demo-reply-${Date.now()}` : await createComment(account, { target: thread, object: comment.object_urn, text: clean, parent: thread });
    await updateComment(id, { status: "replied", reply_text: clean, reply_urn: urn || null, replied_by: by, replied_at: new Date().toISOString(), error: null, reason: null });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Antworten fehlgeschlagen";
    await updateComment(id, { status: "failed", error: message.slice(0, 500), reason: null });
    throw error;
  }
  return getComment(id);
}

const SYSTEM = `Du bist Community-Managerin der Social-Media-Agentur GRID AGENCY und betreust die LinkedIn-Unternehmensseite einer Kundenwelt. Du entscheidest selbstständig, ob und wie auf einen Kommentar geantwortet wird, und schreibst die Antwort im Namen der Seite.

Regeln:
- Halte dich strikt an die CI-Vorgabe (Tonalität, Ansprache, Dos & Don'ts). Ohne Vorgabe: freundlich, professionell, nahbar, Sie-Form auf LinkedIn.
- Antworte in der Sprache des Kommentars. 1 bis 3 kurze Sätze, persönlich und konkret auf den Kommentar bezogen, keine Floskeln, keine Hashtags, keine Gedankenstriche, höchstens ein Emoji.
- Keine Namen erfinden oder verwenden (du kennst den Namen nicht). Keine Preise, Rabatte, Termine, Zusagen oder Fakten, die nicht im Post oder der Vorgabe stehen.
- action "reply": normale Kommentare, Lob, Fragen, die sich aus Post und Vorgabe beantworten lassen.
- action "skip": Spam, Bots, reine Emojis oder Tags ohne Inhalt, Eigenwerbung Dritter, Kommentare, die keine Antwort brauchen (z. B. ein Dank auf unsere Antwort).
- action "handover": Beschwerden, rechtliche Themen, Gesundheit, Bewerbungen, Preis- oder Angebotsanfragen, Kritik an Personen, Krisen, alles Heikle oder wo Wissen fehlt. Dann kurz in "reason" sagen, warum, und in "text" einen Antwortvorschlag fürs Team.`;

const SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["action", "text", "reason"],
  properties: {
    action: { type: "string", enum: ["reply", "skip", "handover"] },
    text: { type: "string", description: "Antwort (bei skip leer)" },
    reason: { type: "string", description: "Kurze Begründung, ein Satz" },
  },
} as const;

type Decision = { action: "reply" | "skip" | "handover"; text: string; reason: string };

let client: Anthropic | null = null;

/** Claude entscheidet über einen Kommentar und schreibt die Antwort */
export async function draftReply(comment: SocialComment): Promise<Decision> {
  if (DEMO && !process.env.ANTHROPIC_API_KEY) return { action: "reply", text: "Danke für Ihren Kommentar, das freut uns sehr!", reason: "Vorschau" };
  if (!process.env.ANTHROPIC_API_KEY) throw new Error("ANTHROPIC_API_KEY fehlt");
  const workspace = await getWorkspace(comment.workspace_id);
  const brief = workspace ? agentBrief(workspace.name, await getBrand(workspace.id)) : "";
  const thread = comment.parent_urn
    ? (await listCommentRows({ account_id: comment.account_id, limit: 1000 }))
        .filter((c) => c.comment_urn === comment.parent_urn || (c.parent_urn === comment.parent_urn && c.id !== comment.id))
        .sort((a, b) => (a.commented_at ?? "").localeCompare(b.commented_at ?? ""))
        .flatMap((c) => [`${c.status === "own" ? "Wir" : "Kommentar"}: ${c.text}`, ...(c.reply_text ? [`Wir: ${c.reply_text}`] : [])])
    : [];
  const input = [
    brief || "(keine CI-Vorgabe)",
    "",
    "## Post",
    comment.post_text || "(Text nicht verfügbar)",
    ...(thread.length ? ["", "## Bisheriges Gespräch", ...thread] : []),
    "",
    "## Neuer Kommentar",
    comment.text,
  ].join("\n");

  client ??= new Anthropic();
  const response = await client.beta.messages.create({
    model: "claude-opus-5-5",
    max_tokens: 1024,
    betas: ["server-side-fallback-2026-07-01"],
    fallbacks: "default",
    output_config: { effort: "low", format: { type: "json_schema", schema: SCHEMA } },
    system: SYSTEM,
    messages: [{ role: "user", content: input }],
  });
  const block = response.content.find((b) => b.type === "text");
  if (response.stop_reason === "refusal" || !block || block.type !== "text") return { action: "handover", text: "", reason: "Claude hat keine Antwort geliefert" };
  return JSON.parse(block.text) as Decision;
}

/** Autopilot: offene Kommentare auf Seiten mit eingeschaltetem Autopilot
 * beantworten, überspringen oder ans Team übergeben */
export async function autoReply(limit = 15) {
  const accounts = (await listAccounts()).filter((a) => isLinkedinPage(a) && a.meta?.auto_reply !== false);
  const done: { id: string; action: string; error?: string }[] = [];
  for (const account of accounts) {
    const open = (await listCommentRows({ account_id: account.id, status: "new", limit })).reverse();
    for (const comment of open) {
      if (done.length >= limit) return done;
      try {
        const decision = await draftReply(comment);
        if (decision.action === "reply" && decision.text.trim()) {
          await replyToComment(comment.id, decision.text, "agent");
        } else if (decision.action === "handover") {
          await updateComment(comment.id, { status: "needs_human", reason: decision.reason, reply_text: decision.text || null });
        } else {
          await updateComment(comment.id, { status: "skipped", reason: decision.reason });
        }
        done.push({ id: comment.id, action: decision.action });
      } catch (error) {
        done.push({ id: comment.id, action: "error", error: error instanceof Error ? error.message : "Fehler" });
      }
    }
  }
  return done;
}

/** Als Seite oder Person einen Post kommentieren (auch fremde Posts) */
export async function commentOnPost(accountId: string, post: string, text: string) {
  const account = await getAccount(accountId);
  if (!account || account.provider !== "linkedin") throw new Error("LinkedIn-Kanal nicht gefunden");
  const clean = text.trim().slice(0, 1250);
  if (!clean) throw new Error("Kommentar ist leer");
  if (DEMO) return { comment_urn: `demo-comment-${Date.now()}` };
  return { comment_urn: await createComment(account, { target: post, object: post, text: clean }) };
}

// ---------- Outreach (Nachrichten, Kontaktanfragen) ----------

const PROFILE = /^https:\/\/([a-z]{2,3}\.)?(www\.)?linkedin\.com\/(in|company|sales\/lead)\/[^\s]+$/i;

export type OutreachInput = {
  workspace_id: string;
  account_id?: string | null;
  kind: OutreachKind;
  recipient: string;
  profile_url: string;
  text: string;
  context?: string | null;
};

export function validateOutreach(input: Partial<OutreachInput>) {
  if (!input.workspace_id) return "workspace_id fehlt";
  if (input.kind !== "message" && input.kind !== "invitation") return "kind muss message oder invitation sein";
  if (!input.recipient?.trim()) return "recipient fehlt";
  if (!input.profile_url || !PROFILE.test(input.profile_url.trim())) return "profile_url muss ein LinkedIn-Profil sein (https://www.linkedin.com/in/…)";
  if (input.kind === "message" && !input.text?.trim()) return "Text fehlt";
  if (input.kind === "invitation" && (input.text ?? "").length > INVITATION_LIMIT) return `Notiz zur Kontaktanfrage höchstens ${INVITATION_LIMIT} Zeichen`;
  return null;
}

export async function listOutreach(filter: { workspace_id?: string; status?: string } = {}): Promise<Outreach[]> {
  if (DEMO) return demo.outreach.filter((o) => (!filter.workspace_id || o.workspace_id === filter.workspace_id) && (!filter.status || o.status === filter.status));
  let query = sb().from("social_outreach").select("*").order("created_at", { ascending: false }).limit(300);
  if (filter.workspace_id) query = query.eq("workspace_id", filter.workspace_id);
  if (filter.status) query = query.eq("status", filter.status);
  return check(await query) as Outreach[];
}

export async function createOutreach(input: OutreachInput, by: string): Promise<Outreach> {
  const row = {
    workspace_id: input.workspace_id,
    account_id: input.account_id ?? null,
    kind: input.kind,
    recipient: input.recipient.trim().slice(0, 200),
    profile_url: input.profile_url.trim(),
    text: (input.text ?? "").trim().slice(0, 8000),
    context: input.context?.trim().slice(0, 2000) || null,
    status: "draft" as const,
    created_by: by,
  };
  if (DEMO) {
    const item: Outreach = { id: randomUUID(), created_at: new Date().toISOString(), sent_at: null, sent_by: null, ...row };
    demo.outreach.unshift(item);
    return item;
  }
  return check(await sb().from("social_outreach").insert(row).select("*").single()) as Outreach;
}

export async function updateOutreach(id: string, patch: { text?: string; status?: Outreach["status"] }, by: string): Promise<Outreach> {
  const next: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (typeof patch.text === "string") next.text = patch.text.trim().slice(0, 8000);
  if (patch.status) {
    next.status = patch.status;
    next.sent_at = patch.status === "sent" ? new Date().toISOString() : null;
    next.sent_by = patch.status === "sent" ? by : null;
  }
  if (DEMO) {
    const item = demo.outreach.find((o) => o.id === id);
    if (!item) throw new Error("Nicht gefunden");
    return Object.assign(item, next);
  }
  return check(await sb().from("social_outreach").update(next).eq("id", id).select("*").single()) as Outreach;
}

export async function deleteOutreach(id: string) {
  if (DEMO) return void demo.outreach.splice(demo.outreach.findIndex((o) => o.id === id), 1);
  check(await sb().from("social_outreach").delete().eq("id", id));
}
