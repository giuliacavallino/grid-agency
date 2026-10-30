"use client";

import { api } from "@/lib/api";
import { mutate, useResource } from "@/lib/data";
import type { VaultItem } from "@/lib/vault";

const BASE = "/api/vault";

export const useVault = () => useResource<VaultItem[]>(BASE);

/** Ob VAULT_KEY gesetzt ist; ohne ihn lassen sich keine Passwörter speichern */
export function useVaultReady() {
  const { data } = useResource<{ status: "ok" | "missing" | "invalid" }>(`${BASE}/status`);
  return data ? data.status === "ok" : null;
}

export const VAULT_LOCKED_HINT = "Erst mit VAULT_KEY möglich";

export type VaultPatch = Partial<Pick<VaultItem, "project_id" | "internal" | "title" | "username" | "url" | "notes">> & { password?: string | null };

export async function createVaultItem(values: VaultPatch) {
  const item = await api<VaultItem>(BASE, { method: "POST", body: JSON.stringify(values) });
  mutate<VaultItem[]>(BASE, (items) => [...items, item]);
  return item;
}

export async function updateVaultItem(id: string, patch: VaultPatch) {
  const item = await api<VaultItem>(`${BASE}/${id}`, { method: "PATCH", body: JSON.stringify(patch) });
  mutate<VaultItem[]>(BASE, (items) => items.map((i) => (i.id === id ? item : i)));
  return item;
}

export async function deleteVaultItem(id: string) {
  await api(`${BASE}/${id}`, { method: "DELETE" });
  mutate<VaultItem[]>(BASE, (items) => items.filter((i) => i.id !== id));
}

/** Holt das Passwort vom Server (wird dort protokolliert). */
export async function revealPassword(id: string, purpose: "show" | "copy") {
  const { password } = await api<{ password: string }>(`${BASE}/${id}/reveal`, { method: "POST", body: JSON.stringify({ purpose }) });
  return password;
}

/** Kopieren direkt aus dem Klick heraus, auch wenn das Passwort erst noch
 * geladen wird (Safari erlaubt sonst kein Kopieren nach await). */
export async function copyPassword(id: string) {
  const text = revealPassword(id, "copy");
  if (typeof ClipboardItem !== "undefined" && navigator.clipboard?.write) {
    await navigator.clipboard.write([new ClipboardItem({ "text/plain": text.then((t) => new Blob([t], { type: "text/plain" })) })]);
    return;
  }
  await navigator.clipboard.writeText(await text);
}
