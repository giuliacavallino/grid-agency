import "server-only";
import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";
import { DEMO } from "@/lib/config";
import type { VaultItem, VaultLogEntry } from "@/lib/vault";
import type { User } from "./auth";
import { sb } from "./db";

// Passwort-Tresor. Passwörter werden hier mit AES-256-GCM verschlüsselt,
// bevor sie in die Datenbank gehen, und nur auf ausdrückliche Anfrage
// (Anzeigen/Kopieren) entschlüsselt und protokolliert. Der Schlüssel
// VAULT_KEY (32 Byte, base64) liegt nur in Vercel, nicht in der Datenbank.

const VERSION = "v1";

function key() {
  const raw = process.env.VAULT_KEY;
  if (DEMO && !raw) return Buffer.alloc(32, 7);
  if (!raw) throw new Error("VAULT_KEY fehlt");
  const buf = Buffer.from(raw, "base64");
  if (buf.length !== 32) throw new Error("VAULT_KEY muss 32 Byte (base64) lang sein");
  return buf;
}

export function encrypt(plain: string) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key(), iv);
  const data = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  return [VERSION, iv.toString("base64"), cipher.getAuthTag().toString("base64"), data.toString("base64")].join(":");
}

/** Aus Asana übernommene Passwörter liegen bis zum ersten Aufruf mit
 * VAULT_KEY als „plain:…“ vor (so offen wie vorher im Briefing) und werden
 * dann automatisch verschlüsselt, siehe sealPlain(). */
const PLAIN = "plain:";

export function decrypt(stored: string) {
  if (stored.startsWith(PLAIN)) return stored.slice(PLAIN.length);
  const [version, iv, tag, data] = stored.split(":");
  if (version !== VERSION) throw new Error("Unbekanntes Format");
  const decipher = createDecipheriv("aes-256-gcm", key(), Buffer.from(iv, "base64"));
  decipher.setAuthTag(Buffer.from(tag, "base64"));
  return Buffer.concat([decipher.update(Buffer.from(data, "base64")), decipher.final()]).toString("utf8");
}

type Row = Omit<VaultItem, "has_secret"> & { secret: string | null };

/** Was der Browser sieht: alles außer dem verschlüsselten Passwort */
const toItem = ({ secret, ...rest }: Row): VaultItem => ({ ...rest, has_secret: !!secret });

export const canSee = (user: User, row: Pick<Row, "internal">) => !row.internal || user.admin;

// ---------- Speicher (Supabase oder Demo im Speicher) ----------

const demoRows: Row[] = [];
const demoLog: VaultLogEntry[] = [];
let demoSeeded = false;

function seedDemo() {
  if (demoSeeded) return;
  demoSeeded = true;
  const now = new Date().toISOString();
  const add = (project_id: string | null, internal: boolean, title: string, username: string, password: string, url: string | null) =>
    demoRows.push({ id: `demo-v${demoRows.length + 1}`, created_at: now, updated_at: now, project_id, internal, title, username, secret: encrypt(password), url, notes: null, created_by: null, updated_by: null });
  add("demo-tp-1", false, "Instagram", "baeckerei.sonne", "Beispiel123!", "https://www.instagram.com/");
  add("demo-tp-1", false, "TikTok", "baeckereisonne", "Beispiel456!", "https://www.tiktok.com/");
  add("demo-tp-2", false, "Instagram", "pizzeria.forno", "Forno2026!", "https://www.instagram.com/");
  add(null, true, "Hootsuite", "vorschau@grid-agency.de", "Intern123!", "https://hootsuite.com/");
}

export async function listItems(user: User): Promise<VaultItem[]> {
  if (DEMO) {
    seedDemo();
    return demoRows.filter((r) => canSee(user, r)).map(toItem);
  }
  let query = sb().from("vault_items").select("*").order("title");
  if (!user.admin) query = query.eq("internal", false);
  const { data, error } = await query;
  if (error) throw new Error(error.message);
  await sealPlain(data as Row[]);
  return (data as Row[]).map(toItem);
}

/** Verschlüsselt noch offen gespeicherte Passwörter, sobald VAULT_KEY da ist. */
async function sealPlain(rows: Row[]) {
  if (!process.env.VAULT_KEY) return;
  for (const row of rows) {
    if (!row.secret?.startsWith(PLAIN)) continue;
    const secret = encrypt(decrypt(row.secret));
    const { error } = await sb().from("vault_items").update({ secret }).eq("id", row.id).eq("secret", row.secret);
    if (error) throw new Error(error.message);
    row.secret = secret;
  }
}

async function getRow(id: string): Promise<Row | null> {
  if (DEMO) {
    seedDemo();
    return demoRows.find((r) => r.id === id) ?? null;
  }
  const { data, error } = await sb().from("vault_items").select("*").eq("id", id).maybeSingle();
  if (error) throw new Error(error.message);
  return data as Row | null;
}

/** Eintrag, den der Nutzer sehen darf, sonst null */
export async function getVisible(user: User, id: string) {
  const row = await getRow(id);
  return row && canSee(user, row) ? row : null;
}

export type VaultInput = Partial<Pick<Row, "project_id" | "internal" | "title" | "username" | "url" | "notes">> & { password?: string | null };

function toRow(input: VaultInput, user: User) {
  const row: Record<string, unknown> = { updated_by: user.email };
  for (const key of ["project_id", "internal", "title", "username", "url", "notes"] as const) {
    if (key in input) row[key] = input[key] === "" ? null : input[key];
  }
  if ("password" in input) row.secret = input.password ? encrypt(input.password) : null;
  // Interne Zugänge gehören zu keinem Kunden
  if (row.internal === true) row.project_id = null;
  return row;
}

export async function createItem(user: User, input: VaultInput) {
  const row = { ...toRow(input, user), created_by: user.email };
  let saved: Row;
  if (DEMO) {
    seedDemo();
    const now = new Date().toISOString();
    saved = { id: `demo-v${demoRows.length + 1}`, created_at: now, updated_at: now, project_id: null, internal: false, title: "", username: null, secret: null, url: null, notes: null, updated_by: null, ...row } as Row;
    demoRows.push(saved);
  } else {
    const { data, error } = await sb().from("vault_items").insert(row).select().single();
    if (error) throw new Error(error.message);
    saved = data as Row;
  }
  await log(user, saved, "angelegt");
  return toItem(saved);
}

export async function updateItem(user: User, current: Row, input: VaultInput) {
  const patch = toRow(input, user);
  let saved: Row;
  if (DEMO) {
    Object.assign(current, patch, { updated_at: new Date().toISOString() });
    saved = current;
  } else {
    const { data, error } = await sb().from("vault_items").update(patch).eq("id", current.id).select().single();
    if (error) throw new Error(error.message);
    saved = data as Row;
  }
  if ("password" in input) await log(user, saved, "Passwort geändert");
  return toItem(saved);
}

export async function deleteItem(user: User, current: Row) {
  await log(user, current, "gelöscht");
  if (DEMO) {
    demoRows.splice(demoRows.indexOf(current), 1);
    return;
  }
  const { error } = await sb().from("vault_items").delete().eq("id", current.id);
  if (error) throw new Error(error.message);
}

export async function log(user: User, row: Pick<Row, "id" | "title">, action: string) {
  const entry = { item_id: row.id, item_title: row.title, user_email: user.email, action };
  if (DEMO) {
    demoLog.unshift({ id: demoLog.length + 1, at: new Date().toISOString(), ...entry });
    return;
  }
  const { error } = await sb().from("vault_log").insert(entry);
  if (error) throw new Error(error.message);
}

export async function listLog(itemId?: string): Promise<VaultLogEntry[]> {
  if (DEMO) return demoLog.filter((e) => !itemId || e.item_id === itemId).slice(0, 200);
  let query = sb().from("vault_log").select("*").order("at", { ascending: false }).limit(200);
  if (itemId) query = query.eq("item_id", itemId);
  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return data as VaultLogEntry[];
}
