import "server-only";
import sharp from "sharp";
import { DEMO } from "@/lib/config";
import { db, sb } from "./db";
import { storeMedia } from "./social/media";
import { accountToken, listAccounts, listWorkspaces } from "./social/store";

// Profilbilder der Kunden (Aufgaben). Quelle Instagram: über ein verbundenes
// Instagram-Business-Konto (Marketing Hub → Kanäle) mit der offiziellen
// Business Discovery der Meta Graph API. Sie liefert das Profilbild jedes
// öffentlichen Business- oder Creator-Kontos. Private Konten gehen nicht,
// dann bleibt der Upload. Gespeichert wird eine Kopie (256 × 256 JPG), weil
// die Instagram-Adressen nach kurzer Zeit ablaufen. Ausgeliefert wird es wie
// die Post-Medien über /api/social/media/<uuid>/… (öffentlich, nicht erratbar),
// damit <img> es ohne Anmelde-Header laden kann.

const BUCKET = "social-media";
const GRAPH = `https://graph.facebook.com/${process.env.META_GRAPH_VERSION ?? "v23.0"}`;

type ProjectRow = { id: string; instagram: string | null; avatar_path: string | null; avatar_source: string | null; avatar_updated_at: string | null };

/** „@huck_baeckerei“, „instagram.com/huck_baeckerei/“ → „huck_baeckerei“ */
export function instagramHandle(input: string) {
  const value = input.trim().replace(/^https?:\/\/(www\.)?instagram\.com\//i, "").replace(/^@/, "").split(/[/?#]/)[0];
  return /^[a-z0-9._]{1,30}$/i.test(value) ? value.toLowerCase() : null;
}

async function project(id: string): Promise<ProjectRow | null> {
  const { data, error } = await sb().from("task_projects").select("id, instagram, avatar_path, avatar_source, avatar_updated_at").eq("id", id).maybeSingle();
  if (error) throw new Error(error.message);
  return data as ProjectRow | null;
}

/** Bild verkleinern, quadratisch zuschneiden, ablegen und am Kunden vermerken */
async function store(id: string, bytes: Uint8Array, source: "instagram" | "upload", patch: Record<string, unknown> = {}) {
  const jpg = new Uint8Array(await sharp(bytes).rotate().resize(256, 256, { fit: "cover" }).jpeg({ quality: 85 }).toBuffer());
  const item = await storeMedia(jpg, "image/jpeg", "profilbild");
  if (DEMO) {
    await db().update("task_projects", id, { avatar_path: item.path, avatar_source: source, avatar_updated_at: new Date().toISOString(), ...patch });
    return item.path;
  }
  const previous = await project(id);
  const { error } = await sb()
    .from("task_projects")
    .update({ avatar_path: item.path, avatar_source: source, avatar_updated_at: new Date().toISOString(), ...patch })
    .eq("id", id);
  if (error) throw new Error(error.message);
  if (previous?.avatar_path) await sb().storage.from(BUCKET).remove([previous.avatar_path]);
  return item.path;
}

export async function uploadAvatar(id: string, file: File) {
  if (!file.type.startsWith("image/")) throw new Error("Bitte ein Bild hochladen");
  if (file.size > 8 * 1024 * 1024) throw new Error("Bild ist größer als 8 MB");
  await store(id, new Uint8Array(await file.arrayBuffer()), "upload");
}

/** Instagram-Konto, über das gefragt wird: bevorzugt das von GRID */
async function discoveryAccount() {
  const accounts = (await listAccounts()).filter((a) => a.provider === "instagram" && a.status === "active" && a.token);
  if (!accounts.length) throw new Error("Kein Instagram-Business-Konto verbunden (Marketing → Kanäle → Instagram + Facebook)");
  const agency = (await listWorkspaces()).find((w) => w.kind === "agency")?.id;
  return accounts.find((a) => a.workspace_id === agency) ?? accounts[0];
}

/** Profilbild über Business Discovery holen und speichern */
export async function avatarFromInstagram(id: string, handleInput?: string) {
  const row = DEMO ? null : await project(id);
  const handle = instagramHandle(handleInput ?? row?.instagram ?? "");
  if (!handle) throw new Error("Instagram-Name fehlt oder ist ungültig");
  if (DEMO) throw new Error("In der Vorschau nicht verfügbar");

  const account = await discoveryAccount();
  const params = new URLSearchParams({
    fields: `business_discovery.username(${handle}){username,profile_picture_url}`,
    access_token: accountToken(account) ?? "",
  });
  const response = await fetch(`${GRAPH}/${account.external_id}?${params}`);
  const data = (await response.json().catch(() => ({}))) as { business_discovery?: { profile_picture_url?: string }; error?: { message?: string } };
  if (!response.ok) {
    // Nur das Handle speichern, damit es beim nächsten Versuch vorausgefüllt ist
    await sb().from("task_projects").update({ instagram: handle }).eq("id", id);
    const message = data.error?.message ?? `Fehler ${response.status}`;
    throw new Error(/business|creator|not found|cannot be found/i.test(message) ? `@${handle} ist kein öffentliches Business- oder Creator-Konto. Bild bitte hochladen.` : `Instagram: ${message}`);
  }
  const url = data.business_discovery?.profile_picture_url;
  if (!url) throw new Error(`@${handle} hat kein Profilbild`);
  const image = await fetch(url);
  if (!image.ok) throw new Error("Profilbild konnte nicht geladen werden");
  await store(id, new Uint8Array(await image.arrayBuffer()), "instagram", { instagram: handle });
}

export async function removeAvatar(id: string) {
  if (DEMO) return void (await db().update("task_projects", id, { avatar_path: null, avatar_source: null, avatar_updated_at: null }));
  const row = await project(id);
  if (row?.avatar_path) await sb().storage.from(BUCKET).remove([row.avatar_path]);
  const { error } = await sb().from("task_projects").update({ avatar_path: null, avatar_source: null, avatar_updated_at: null }).eq("id", id);
  if (error) throw new Error(error.message);
}

/** Cron (wöchentlich): Instagram-Bilder auffrischen, die älter als 7 Tage sind */
export async function refreshAvatars() {
  if (DEMO) return [];
  const before = new Date(Date.now() - 7 * 86_400_000).toISOString();
  const { data, error } = await sb()
    .from("task_projects")
    .select("id, instagram")
    .eq("archived", false)
    .eq("avatar_source", "instagram")
    .lt("avatar_updated_at", before);
  if (error) throw new Error(error.message);
  const done: { id: string; error?: string }[] = [];
  for (const row of (data ?? []) as { id: string; instagram: string | null }[]) {
    try {
      await avatarFromInstagram(row.id, row.instagram ?? undefined);
      done.push({ id: row.id });
    } catch (e) {
      done.push({ id: row.id, error: e instanceof Error ? e.message : "Fehler" });
    }
  }
  return done;
}
