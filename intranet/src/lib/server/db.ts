import "server-only";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { DEMO } from "@/lib/config";
import { demoStore } from "./demo-store";

/** Tabellen, die die Sales-API lesen und schreiben darf, mit den Spalten,
 * die vom Browser kommen dürfen. Alles andere (id, Zeitstempel, raw …)
 * setzt die Datenbank bzw. der Server. */
export const TABLES = {
  leads: {
    columns: [
      "stage", "position", "status", "source", "source_ref", "name", "company", "email",
      "phone", "message", "budget", "value", "owner", "next_step", "next_step_at",
      "customer_id", "lost_reason",
    ],
    filters: ["status", "stage", "customer_id", "source_ref"],
    order: { column: "position", ascending: true },
  },
  lead_activities: {
    columns: ["lead_id", "kind", "body"],
    filters: ["lead_id"],
    order: { column: "created_at", ascending: false },
  },
  customers: {
    columns: [
      "name", "contact_name", "email", "phone", "website", "industry", "city", "status",
      "source", "notes", "lead_id",
    ],
    filters: ["status"],
    order: { column: "name", ascending: true },
  },
  articles: {
    columns: ["name", "category", "description", "price", "unit", "hours", "active"],
    filters: ["active"],
    order: { column: "name", ascending: true },
  },
  retainers: {
    columns: [
      "customer_id", "article_id", "title", "monthly_fee", "hours_per_month", "start_date",
      "end_date", "status", "notes",
    ],
    filters: ["customer_id", "status"],
    order: { column: "start_date", ascending: false },
  },
  inbound_messages: {
    columns: [],
    filters: ["classification", "mailbox"],
    order: { column: "received_at", ascending: false },
  },
  invoices: {
    columns: [
      "stage", "position", "vendor", "vendor_email", "invoice_number", "invoice_date", "due_date",
      "amount", "currency", "description", "notes",
    ],
    filters: ["stage"],
    order: { column: "position", ascending: true },
  },
  applications: {
    columns: [
      "stage", "position", "name", "email", "phone", "position_title", "message", "owner",
      "next_step", "next_step_at", "notes",
    ],
    filters: ["stage"],
    order: { column: "position", ascending: true },
  },
  // Aufgaben: Kunde → Themen (Spalten) → To-dos (Karten)
  task_projects: {
    columns: ["name", "color", "customer_id", "position", "archived", "briefing"],
    filters: ["archived"],
    order: { column: "position", ascending: true },
  },
  task_sections: {
    columns: ["project_id", "name", "position"],
    filters: ["project_id"],
    order: { column: "position", ascending: true },
  },
  tasks: {
    columns: ["project_id", "section_id", "title", "notes", "done", "assignee", "due_on", "checklist", "position"],
    filters: ["project_id", "done"],
    order: { column: "position", ascending: false },
  },
} as const;

/** Tabellen mit Herkunftsschlüssel (source_ref) aus dem Mail-Eingang */
export type IngestTable = "leads" | "inbound_messages" | "invoices" | "applications";

export type TableName = keyof typeof TABLES;
export type EasybillTable = "customers" | "articles" | "retainers";
export type Row = Record<string, unknown> & { id: string };

export function isTable(name: string): name is TableName {
  return Object.hasOwn(TABLES, name);
}

/** Nur erlaubte Spalten übernehmen, leere Strings als null speichern. */
export function pick(table: TableName, input: Record<string, unknown>) {
  const allowed: readonly string[] = TABLES[table].columns;
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(input)) {
    if (allowed.includes(key)) out[key] = value === "" ? null : value;
  }
  return out;
}

export interface Store {
  list(table: TableName, filters?: Record<string, string>, ids?: string[]): Promise<Row[]>;
  get(table: TableName, id: string): Promise<Row | null>;
  insert(table: TableName, row: Record<string, unknown>): Promise<Row>;
  /** Insert, der bei bestehendem (source, source_ref) bzw. id nichts tut. */
  insertIgnore(table: IngestTable, row: Record<string, unknown>): Promise<Row | null>;
  update(table: TableName, id: string, patch: Record<string, unknown>): Promise<Row>;
  /** Anlegen oder aktualisieren über die easybill-ID. Spalten, die in keiner
   * Zeile vorkommen, bleiben bei bestehenden Zeilen unverändert. */
  upsertEasybill(table: EasybillTable, rows: Record<string, unknown>[]): Promise<Row[]>;
  remove(table: TableName, id: string): Promise<void>;
  getSetting<T>(key: string): Promise<T | null>;
  setSetting(key: string, value: unknown): Promise<void>;
}

let supabase: SupabaseClient | null = null;

function sb() {
  if (!supabase) {
    const url = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !key) {
      throw new Error("Datenbank nicht konfiguriert (SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY fehlen)");
    }
    supabase = createClient(url, key, { auth: { persistSession: false } });
  }
  return supabase;
}

function check<T>({ data, error }: { data: T; error: { message: string } | null }) {
  if (error) throw new Error(error.message);
  return data;
}

const supabaseStore: Store = {
  async list(table, filters = {}, ids) {
    const { order } = TABLES[table];
    let query = sb().from(table).select("*").order(order.column, { ascending: order.ascending });
    for (const [key, value] of Object.entries(filters)) query = query.eq(key, value);
    if (ids) query = query.in("id", ids);
    return check(await query.limit(5000)) as Row[];
  },
  async get(table, id) {
    return check(await sb().from(table).select("*").eq("id", id).maybeSingle()) as Row | null;
  },
  async insert(table, row) {
    return check(await sb().from(table).insert(row).select().single()) as Row;
  },
  async insertIgnore(table, row) {
    const onConflict = table === "leads" ? "source,source_ref" : table === "inbound_messages" ? "id" : "source_ref";
    const rows = check(
      await sb().from(table).upsert(row, { onConflict, ignoreDuplicates: true }).select()
    ) as Row[];
    return rows[0] ?? null;
  },
  async update(table, id, patch) {
    return check(await sb().from(table).update(patch).eq("id", id).select().single()) as Row;
  },
  async upsertEasybill(table, rows) {
    if (!rows.length) return [];
    return check(await sb().from(table).upsert(rows, { onConflict: "easybill_id" }).select()) as Row[];
  },
  async remove(table, id) {
    check(await sb().from(table).delete().eq("id", id));
  },
  async getSetting(key) {
    const row = check(
      await sb().from("sales_settings").select("value").eq("key", key).maybeSingle()
    ) as { value: unknown } | null;
    return (row?.value ?? null) as never;
  },
  async setSetting(key, value) {
    check(
      await sb()
        .from("sales_settings")
        .upsert({ key, value, updated_at: new Date().toISOString() })
    );
  },
};

export function db(): Store {
  return DEMO ? demoStore : supabaseStore;
}
