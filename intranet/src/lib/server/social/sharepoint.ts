import "server-only";
import { DEMO } from "@/lib/config";
import type { MediaItem } from "@/lib/marketing";
import { appGraph } from "../graph-app";
import { readMedia } from "./media";
import { getWorkspace, updateWorkspaceSettings, workspaceSettings } from "./store";

// Ablage je Kundenwelt in SharePoint: <Bibliothek>/Kundenwelten/<Kunde>/<JJJJ-MM>/…
// Alle Bilder und Videos eines Posts (Uploads, Canva-Exporte, vom Agenten)
// landen zusätzlich dort, damit das Team sie wie gewohnt in SharePoint/Teams
// findet. Für die Plattformen bleiben sie im Storage des Intranets.
// Braucht SHAREPOINT_SITE (z. B. gridagency.sharepoint.com:/sites/GRID) und
// für die Entra-App die Anwendungsberechtigung Sites.Selected (mit Freigabe
// für diese Website) oder Sites.ReadWrite.All.

const ROOT = process.env.SHAREPOINT_FOLDER ?? "Kundenwelten";
const SMALL = 4 * 1024 * 1024;
const CHUNK = 320 * 1024 * 16; // Vielfaches von 320 KiB, wie Graph es verlangt

export const sharepointConfigured = () => !!process.env.SHAREPOINT_SITE && !!process.env.MS_CLIENT_SECRET;

let driveId: string | null = null;

async function drive() {
  if (driveId) return driveId;
  const site = await appGraph<{ id: string }>(`/sites/${process.env.SHAREPOINT_SITE}`);
  const d = await appGraph<{ id: string }>(`/sites/${site.id}/drive`);
  driveId = d.id;
  return driveId;
}

const segment = (name: string) => name.replace(/["*:<>?/\\|#%]/g, "-").replace(/\s+/g, " ").trim().slice(0, 100) || "Ordner";

/** Ordner anlegen, falls er fehlt; liefert id und webUrl */
async function ensureFolder(parts: string[]) {
  const d = await drive();
  let parent = "root";
  let folder = { id: "", webUrl: "" };
  for (const part of parts.map(segment)) {
    const children = await appGraph<{ value: { id: string; name: string; webUrl: string; folder?: unknown }[] }>(
      `/drives/${d}/items/${parent}/children?$filter=name eq '${part.replace(/'/g, "''")}'&$select=id,name,webUrl,folder`
    );
    const existing = children.value.find((c) => c.folder && c.name.toLowerCase() === part.toLowerCase());
    folder =
      existing ??
      (await appGraph<{ id: string; webUrl: string }>(`/drives/${d}/items/${parent}/children`, {
        method: "POST",
        body: JSON.stringify({ name: part, folder: {}, "@microsoft.graph.conflictBehavior": "replace" }),
      }));
    parent = folder.id;
  }
  return folder;
}

/** Ordner der Kundenwelt (wird beim ersten Mal angelegt und gemerkt) */
export async function workspaceFolder(workspaceId: string) {
  if (DEMO || !sharepointConfigured()) return null;
  const settings = await workspaceSettings(workspaceId);
  if (typeof settings.sharepoint_folder_id === "string") return { id: settings.sharepoint_folder_id, webUrl: String(settings.sharepoint_url ?? "") };
  const ws = await getWorkspace(workspaceId);
  if (!ws) return null;
  const folder = await ensureFolder([ROOT, ws.name]);
  await updateWorkspaceSettings(workspaceId, { sharepoint_folder_id: folder.id, sharepoint_url: folder.webUrl });
  return folder;
}

async function upload(folderId: string, name: string, bytes: Uint8Array, mime: string) {
  const d = await drive();
  const target = `/drives/${d}/items/${folderId}:/${encodeURIComponent(segment(name))}:`;
  if (bytes.byteLength <= SMALL) {
    return appGraph<{ webUrl: string }>(`${target}/content`, { method: "PUT", headers: { "Content-Type": mime }, body: Buffer.from(bytes) });
  }
  const session = await appGraph<{ uploadUrl: string }>(`${target}/createUploadSession`, {
    method: "POST",
    body: JSON.stringify({ item: { "@microsoft.graph.conflictBehavior": "rename" } }),
  });
  let item: { webUrl: string } | null = null;
  for (let start = 0; start < bytes.byteLength; start += CHUNK) {
    const end = Math.min(start + CHUNK, bytes.byteLength);
    // Die Upload-Adresse ist selbst signiert; kein Authorization-Header
    const response = await fetch(session.uploadUrl, {
      method: "PUT",
      headers: { "Content-Range": `bytes ${start}-${end - 1}/${bytes.byteLength}` },
      body: Buffer.from(bytes.subarray(start, end)),
    });
    if (!response.ok) throw new Error(`SharePoint-Upload fehlgeschlagen (${response.status})`);
    if (end === bytes.byteLength) item = await response.json();
  }
  return item!;
}

/** Medien eines Posts in den Ordner der Kundenwelt legen (nur noch nicht abgelegte) */
export async function archiveMedia(workspaceId: string, media: MediaItem[]): Promise<MediaItem[]> {
  if (!media.some((m) => !m.sharepoint_url)) return media;
  const folder = await workspaceFolder(workspaceId);
  if (!folder) return media;
  const month = await ensureFolderIn(folder.id, new Date().toISOString().slice(0, 7));
  const out: MediaItem[] = [];
  for (const m of media) {
    if (m.sharepoint_url) {
      out.push(m);
      continue;
    }
    try {
      const file = await readMedia(m.path);
      if (!file) throw new Error("Datei fehlt im Storage");
      const item = await upload(month, m.path.split("/").pop()!, file.bytes, file.mime);
      out.push({ ...m, sharepoint_url: item.webUrl });
    } catch (error) {
      console.error("SharePoint-Ablage", error);
      out.push(m);
    }
  }
  return out;
}

async function ensureFolderIn(parentId: string, name: string) {
  const d = await drive();
  const children = await appGraph<{ value: { id: string; name: string; folder?: unknown }[] }>(
    `/drives/${d}/items/${parentId}/children?$filter=name eq '${name}'&$select=id,name,folder`
  );
  const existing = children.value.find((c) => c.folder && c.name === name);
  if (existing) return existing.id;
  const created = await appGraph<{ id: string }>(`/drives/${d}/items/${parentId}/children`, {
    method: "POST",
    body: JSON.stringify({ name, folder: {}, "@microsoft.graph.conflictBehavior": "replace" }),
  });
  return created.id;
}
