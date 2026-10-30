"use client";

import { useCallback, useEffect, useSyncExternalStore } from "react";
import { api } from "./api";

// Kleiner Cache für API-Daten: Komponenten, die dieselbe URL lesen, teilen
// sich Daten und Ladezustand; Schreibzugriffe aktualisieren alle Leser.

type Entry = {
  data?: unknown;
  error?: Error;
  promise?: Promise<void>;
  listeners: Set<() => void>;
  snapshot: Snapshot<unknown>;
};

export type Snapshot<T> = { data: T | undefined; error: Error | undefined; loading: boolean };

const cache = new Map<string, Entry>();

function entry(url: string) {
  let e = cache.get(url);
  if (!e) {
    e = { listeners: new Set(), snapshot: { data: undefined, error: undefined, loading: true } };
    cache.set(url, e);
  }
  return e;
}

function emit(url: string) {
  const e = entry(url);
  e.snapshot = { data: e.data, error: e.error, loading: !!e.promise && e.data === undefined };
  e.listeners.forEach((listener) => listener());
}

export function load(url: string, force = false) {
  const e = entry(url);
  if (e.promise || (!force && (e.data !== undefined || e.error))) return e.promise;
  e.promise = api(url)
    .then((data) => {
      e.data = data;
      e.error = undefined;
    })
    .catch((error: Error) => {
      e.error = error;
    })
    .finally(() => {
      e.promise = undefined;
      emit(url);
    });
  emit(url);
  return e.promise;
}

/** Setzt die Daten aller gecachten URLs, die mit prefix beginnen. */
export function mutate<T>(prefix: string, update: (data: T) => T) {
  for (const [url, e] of cache) {
    if (url.startsWith(prefix) && e.data !== undefined) {
      e.data = update(e.data as T);
      emit(url);
    }
  }
}

export function revalidate(prefix: string) {
  for (const url of cache.keys()) if (url.startsWith(prefix)) load(url, true);
}

const serverSnapshot: Snapshot<never> = { data: undefined, error: undefined, loading: true };

export function useResource<T>(url: string | null) {
  const subscribe = useCallback(
    (listener: () => void) => {
      if (!url) return () => {};
      const e = entry(url);
      e.listeners.add(listener);
      return () => e.listeners.delete(listener);
    },
    [url]
  );
  const snapshot = useSyncExternalStore(
    subscribe,
    () => (url ? (entry(url).snapshot as Snapshot<T>) : serverSnapshot),
    () => serverSnapshot
  );

  useEffect(() => {
    if (url) load(url);
  }, [url]);

  const reload = useCallback(() => (url ? load(url, true) : undefined), [url]);
  return { ...snapshot, reload };
}

// ---------- Sales-Tabellen ----------

const base = (table: string) => `/api/sales/${table}`;

export function useRows<T>(table: string, query = "") {
  return useResource<T[]>(`${base(table)}${query ? `?${query}` : ""}`);
}

type WithId = { id: string };

export async function createRow<T extends WithId>(table: string, values: Partial<T>) {
  const row = await api<T>(base(table), { method: "POST", body: JSON.stringify(values) });
  mutate<T[]>(base(table), (rows) => [...rows, row]);
  return row;
}

/** Optimistisch: Die Änderung ist sofort sichtbar und wird bei einem
 * Fehler zurückgerollt. */
export async function updateRow<T extends WithId>(table: string, id: string, patch: Partial<T>) {
  let previous: T | undefined;
  mutate<T[]>(base(table), (rows) =>
    rows.map((row) => {
      if (row.id !== id) return row;
      previous = row;
      return { ...row, ...patch };
    })
  );
  try {
    const row = await api<T>(`${base(table)}/${id}`, { method: "PATCH", body: JSON.stringify(patch) });
    mutate<T[]>(base(table), (rows) => rows.map((r) => (r.id === id ? row : r)));
    return row;
  } catch (error) {
    if (previous) mutate<T[]>(base(table), (rows) => rows.map((r) => (r.id === id ? previous! : r)));
    throw error;
  }
}

/** Zeile, die der Server geändert hat, in alle geladenen Listen übernehmen */
export function replaceRow<T extends WithId>(table: string, row: T) {
  mutate<T[]>(base(table), (rows) => rows.map((r) => (r.id === row.id ? row : r)));
}

export async function deleteRow(table: string, id: string) {
  await api(`${base(table)}/${id}`, { method: "DELETE" });
  mutate<WithId[]>(base(table), (rows) => rows.filter((row) => row.id !== id));
}
