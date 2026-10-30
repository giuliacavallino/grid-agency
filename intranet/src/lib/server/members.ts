import "server-only";
import { DEMO, DOMAIN } from "@/lib/config";
import type { Member, Role } from "@/lib/access";
import { GRANTABLE_AREAS } from "@/lib/access";
import { sb } from "./db";

// Benutzer des Intranets aus Supabase (intranet_users), kurz zwischengespeichert,
// damit nicht jede API-Anfrage die Tabelle liest.

const TTL_MS = 30_000;
let cached: { at: number; members: Member[] } | null = null;

const demoMembers: Member[] = [
  { email: `vorschau@${DOMAIN}`, name: "Vorschau Konto", role: "admin", areas: [], active: true },
  { email: `giulia.cavallino@${DOMAIN}`, name: "Giulia Cavallino", role: "admin", areas: [], active: true },
  { email: `marine.eichner@${DOMAIN}`, name: "Marine Eichner", role: "member", areas: ["aufgaben"], active: true },
];

export async function listMembers(): Promise<Member[]> {
  if (DEMO) return structuredClone(demoMembers);
  if (cached && Date.now() - cached.at < TTL_MS) return cached.members;
  const { data, error } = await sb().from("intranet_users").select("*").order("name");
  if (error) throw new Error(error.message);
  cached = { at: Date.now(), members: data as Member[] };
  return cached.members;
}

/** Aktiver Benutzer zu einer E-Mail-Adresse, sonst null (kein Zugang) */
export async function getMember(email: string) {
  const member = (await listMembers()).find((m) => m.email === email.toLowerCase());
  return member?.active ? member : null;
}

export type MemberInput = Partial<Pick<Member, "name" | "role" | "areas" | "active">>;

function clean(input: MemberInput) {
  const out: Record<string, unknown> = {};
  if (input.name !== undefined) out.name = String(input.name).trim();
  if (input.role !== undefined) {
    if (!["admin", "member"].includes(input.role)) throw new Error("Unbekannte Rolle");
    out.role = input.role as Role;
  }
  if (input.areas !== undefined) out.areas = input.areas.filter((a) => GRANTABLE_AREAS.includes(a));
  if (input.active !== undefined) out.active = !!input.active;
  return out;
}

export async function createMember(email: string, input: MemberInput) {
  const address = email.trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(address)) throw new Error("Ungültige E-Mail-Adresse");
  const row = { email: address, name: address, role: "member", areas: ["aufgaben"], active: true, ...clean(input) } as Member;
  if (!row.name) throw new Error("Name fehlt");
  if (DEMO) {
    if (demoMembers.some((m) => m.email === address)) throw new Error("Gibt es schon");
    demoMembers.push(row);
    return row;
  }
  const { data, error } = await sb().from("intranet_users").insert(row).select().single();
  cached = null;
  if (error) throw new Error(error.code === "23505" ? "Gibt es schon" : error.message);
  return data as Member;
}

export async function updateMember(email: string, input: MemberInput) {
  const patch = clean(input);
  if (DEMO) {
    const member = demoMembers.find((m) => m.email === email);
    if (!member) throw new Error("Nicht gefunden");
    Object.assign(member, patch);
    return structuredClone(member);
  }
  const { data, error } = await sb().from("intranet_users").update(patch).eq("email", email).select().single();
  cached = null;
  if (error) throw new Error(error.message);
  return data as Member;
}

export async function deleteMember(email: string) {
  if (DEMO) {
    demoMembers.splice(demoMembers.findIndex((m) => m.email === email), 1);
    return;
  }
  const { error } = await sb().from("intranet_users").delete().eq("email", email);
  cached = null;
  if (error) throw new Error(error.message);
}

/** Wäre danach noch jemand Admin? Schützt davor, sich selbst auszusperren. */
export async function keepsAnAdmin(email: string, next: MemberInput | null) {
  const members = await listMembers();
  return members.some((m) => {
    const after = m.email === email ? (next ? { ...m, ...clean(next) } : null) : m;
    return after?.active && after.role === "admin";
  });
}
