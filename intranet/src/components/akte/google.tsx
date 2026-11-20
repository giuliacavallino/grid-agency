"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Eye, EyeOff, ListPlus, MapPin, Plus, Star, Trash2 } from "lucide-react";
import { cn } from "@/lib/cn";
import { api } from "@/lib/api";
import { mutate, useResource } from "@/lib/data";
import { formatDate } from "@/lib/format";
import {
  formatRating,
  googleStats,
  LOCATION_STATUS,
  TODO_OWNER,
  TODO_STATUS,
  type GoogleBoard,
  type GoogleLocation,
  type GoogleTodo,
  type LocationStatus,
  type PortalGoogle,
  type TodoOwner,
  type TodoStatus,
} from "@/lib/google";
import { Button, Dialog, Empty, Field, IconButton, Input, Select, Sheet, Spinner, Textarea, useToast } from "@/components/ui";
import { useCurrentWorkspace } from "@/components/marketing/workspace";
import { GoogleOverview, StatusBadge, ToneBadge } from "@/components/google/overview";
import { AkteHeader } from "./header";

// Google-Betreuung in der Kundenakte: To-dos (wer muss was tun), Standorte
// mit Status und Bewertungen, dazu die Kundenansicht genau so, wie sie im
// Kundenportal erscheint. Interne Notizen und ausgeblendete To-dos sieht der
// Kunde nicht.

type Tab = "todos" | "standorte" | "kunde";
type Editing = { kind: "location"; row: GoogleLocation | null } | { kind: "todo"; row: GoogleTodo | null };

const urlOf = (id: string) => `/api/marketing/workspaces/${id}/google`;
const today = () => new Date().toISOString().slice(0, 10);

/** Dieselbe Auswahl wie das Kundenportal (lib/server/google → portalGoogle) */
function asPortal(board: GoogleBoard): PortalGoogle {
  const since = Date.now() - 60 * 86_400_000;
  const stamps = [...board.locations.map((l) => l.updated_at), ...board.todos.map((t) => t.updated_at)].sort();
  return {
    locations: board.locations.filter((l) => l.status !== "archiviert"),
    todos: board.todos.filter((t) => t.visible && (t.status !== "erledigt" || Date.parse(t.done_at ?? t.updated_at) >= since)),
    updated_at: stamps.at(-1) ?? null,
  };
}

export function AkteGoogle() {
  const { workspace } = useCurrentWorkspace();
  const key = workspace ? urlOf(workspace.id) : null;
  const board = useResource<GoogleBoard>(key);
  const toast = useToast();
  const [tab, setTab] = useState<Tab>("todos");
  const [editing, setEditing] = useState<Editing | null>(null);
  const [bulk, setBulk] = useState(false);

  if (!workspace || !key) return null;
  if (board.error) return <Empty title="Google-Stand konnte nicht geladen werden" text={board.error.message} />;
  if (!board.data) {
    return (
      <div className="grid h-full place-items-center">
        <Spinner />
      </div>
    );
  }
  const data = board.data;
  const stats = googleStats(data);

  /** Anlegen (id null) oder ändern; liefert true bei Erfolg */
  async function save(kind: "location" | "todo", id: string | null, values: Record<string, unknown>, success?: string) {
    try {
      const next = id
        ? await api<GoogleBoard>(`${key}/${id}?kind=${kind}`, { method: "PATCH", body: JSON.stringify(values) })
        : await api<GoogleBoard>(key!, { method: "POST", body: JSON.stringify({ ...values, kind }) });
      mutate<GoogleBoard>(key!, () => next);
      if (success) toast(success);
      return true;
    } catch (error) {
      toast(error instanceof Error ? error.message : "Speichern fehlgeschlagen", "error");
      return false;
    }
  }

  async function remove(kind: "location" | "todo", id: string) {
    try {
      const next = await api<GoogleBoard>(`${key}/${id}?kind=${kind}`, { method: "DELETE" });
      mutate<GoogleBoard>(key!, () => next);
      toast(kind === "location" ? "Standort gelöscht" : "To-do gelöscht");
      return true;
    } catch (error) {
      toast(error instanceof Error ? error.message : "Löschen fehlgeschlagen", "error");
      return false;
    }
  }

  const meta = data.locations.length
    ? `${stats.live} von ${stats.total} Standorten live · Ø ${formatRating(stats.rating)} ★ · ${stats.openCustomer} offen beim Kunden · ${stats.openGrid} bei GRID`
    : "Standorte, Bewertungen und To-dos – intern und im Kundenportal";

  return (
    <div className="flex h-full flex-col">
      <AkteHeader title="Google" meta={meta}>
        <div role="tablist" aria-label="Ansicht" className="flex rounded-full border border-snow/12 p-0.5">
          {(
            [
              ["todos", "To-dos"],
              ["standorte", "Standorte"],
              ["kunde", "Kundenansicht"],
            ] as const
          ).map(([value, label]) => (
            <button
              key={value}
              type="button"
              role="tab"
              aria-selected={tab === value}
              onClick={() => setTab(value)}
              className={cn("h-8 rounded-full px-3 text-[13px]", tab === value ? "bg-snow/[0.12] font-medium text-snow" : "text-snow/60 hover:text-snow")}
            >
              {label}
            </button>
          ))}
        </div>
        {tab === "standorte" && (
          <Button size="sm" icon={<ListPlus className="h-4 w-4" />} onClick={() => setBulk(true)}>
            Mehrere einfügen
          </Button>
        )}
        {tab !== "kunde" && (
          <Button size="sm" variant="primary" icon={<Plus className="h-4 w-4" />} onClick={() => setEditing(tab === "standorte" ? { kind: "location", row: null } : { kind: "todo", row: null })}>
            {tab === "standorte" ? "Standort" : "To-do"}
          </Button>
        )}
      </AkteHeader>

      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-5 md:px-7">
        {tab === "todos" && <Todos board={data} onEdit={(row) => setEditing({ kind: "todo", row })} save={save} />}
        {tab === "standorte" && <LocationTable board={data} onEdit={(row) => setEditing({ kind: "location", row })} save={save} onBulk={() => setBulk(true)} />}
        {tab === "kunde" && (
          <div className="mx-auto max-w-5xl">
            <p className="mb-5 rounded-2xl border border-snow/[0.08] bg-panel px-4 py-3 text-[13px] text-snow/65">
              So sieht der Kunde den Stand im Kundenportal. Ausgeblendete To-dos, interne Notizen und archivierte Standorte fehlen hier.{" "}
              <Link href={`/akte/${workspace.id}/einstellungen/kundenzugang`} className="underline underline-offset-4 hover:text-snow">
                Kundenzugang verwalten
              </Link>
            </p>
            {data.locations.length || data.todos.length ? <GoogleOverview data={asPortal(data)} /> : <Empty title="Noch nichts angelegt" text="Lege Standorte und To-dos an, dann erscheinen sie hier und im Kundenportal." />}
          </div>
        )}
      </div>

      {editing?.kind === "location" && (
        <LocationSheet row={editing.row} onClose={() => setEditing(null)} save={save} remove={remove} />
      )}
      {editing?.kind === "todo" && <TodoSheet row={editing.row} locations={data.locations} onClose={() => setEditing(null)} save={save} remove={remove} />}
      {bulk && <BulkDialog onClose={() => setBulk(false)} save={save} />}
    </div>
  );
}

type Save = (kind: "location" | "todo", id: string | null, values: Record<string, unknown>, success?: string) => Promise<boolean>;
type Remove = (kind: "location" | "todo", id: string) => Promise<boolean>;

// ---------- To-dos ----------

const OWNER_ORDER: TodoOwner[] = ["kunde", "grid", "google"];

function Todos({ board, onEdit, save }: { board: GoogleBoard; onEdit: (row: GoogleTodo) => void; save: Save }) {
  const [owner, setOwner] = useState<TodoOwner | "alle">("alle");
  const [showDone, setShowDone] = useState(false);
  const [title, setTitle] = useState("");
  const [newOwner, setNewOwner] = useState<TodoOwner>("grid");
  const [busy, setBusy] = useState(false);
  const names = useMemo(() => new Map(board.locations.map((l) => [l.id, l.name])), [board.locations]);

  async function quickAdd(event: React.FormEvent) {
    event.preventDefault();
    if (!title.trim()) return;
    setBusy(true);
    if (await save("todo", null, { title, owner: newOwner })) setTitle("");
    setBusy(false);
  }

  const rows = board.todos.filter((t) => (owner === "alle" || t.owner === owner) && (showDone || t.status !== "erledigt"));
  const groups = OWNER_ORDER.map((o) => [o, rows.filter((t) => t.owner === o)] as const).filter(([, list]) => list.length);
  const doneCount = board.todos.filter((t) => t.status === "erledigt").length;

  return (
    <div className="mx-auto max-w-5xl">
      <form onSubmit={quickAdd} className="mb-4 flex flex-wrap gap-2">
        <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Neues To-do, z. B. „Mietvertrag Kamps BER anfordern“" className="min-w-0 flex-1 basis-64" aria-label="Neues To-do" />
        <Select value={newOwner} onChange={(e) => setNewOwner(e.target.value as TodoOwner)} className="w-32" aria-label="Zuständig">
          {OWNER_ORDER.map((o) => (
            <option key={o} value={o}>
              {TODO_OWNER[o].label}
            </option>
          ))}
        </Select>
        <Button type="submit" loading={busy} loadingText="Wird angelegt …" disabled={!title.trim()} icon={<Plus className="h-4 w-4" />}>
          Hinzufügen
        </Button>
      </form>

      <div className="mb-4 flex flex-wrap items-center gap-2">
        {(["alle", ...OWNER_ORDER] as const).map((o) => (
          <button
            key={o}
            type="button"
            aria-pressed={owner === o}
            onClick={() => setOwner(o)}
            className={cn("h-8 rounded-full border px-3 text-[12.5px]", owner === o ? "border-snow/40 bg-snow/[0.1] font-medium" : "border-snow/12 text-snow/65 hover:text-snow")}
          >
            {o === "alle" ? "Alle" : TODO_OWNER[o].label}
          </button>
        ))}
        <label className="ml-auto flex items-center gap-2 text-[13px] text-snow/65">
          <input type="checkbox" checked={showDone} onChange={(e) => setShowDone(e.target.checked)} className="accent-current" />
          Erledigte zeigen ({doneCount})
        </label>
      </div>

      {groups.length ? (
        groups.map(([o, list]) => (
          <section key={o} className="mb-6">
            <p className="mb-2 text-[11.5px] font-medium tracking-wide text-snow/45 uppercase">
              {o === "kunde" ? "Beim Kunden" : o === "grid" ? "Bei GRID" : "Bei Google"} · {list.length}
            </p>
            <ul className="divide-y divide-snow/[0.06] overflow-hidden rounded-2xl border border-snow/[0.08] bg-surface">
              {list.map((t) => (
                <TodoRow key={t.id} todo={t} location={t.location_id ? names.get(t.location_id) : undefined} onEdit={() => onEdit(t)} save={save} />
              ))}
            </ul>
          </section>
        ))
      ) : (
        <Empty title={board.todos.length ? "Nichts offen" : "Noch keine To-dos"} text="Neue To-dos oben eintragen. Was für den Kunden sichtbar ist, erscheint sofort im Kundenportal." />
      )}
    </div>
  );
}

function TodoRow({ todo, location, onEdit, save }: { todo: GoogleTodo; location?: string; onEdit: () => void; save: Save }) {
  const [busy, setBusy] = useState<string | null>(null);
  const done = todo.status === "erledigt";
  const overdue = !done && todo.due && todo.due < today();
  async function patch(field: string, values: Record<string, unknown>) {
    setBusy(field);
    await save("todo", todo.id, values);
    setBusy(null);
  }
  return (
    <li className="flex flex-wrap items-center gap-x-3 gap-y-2 px-3 py-2.5 md:flex-nowrap">
      <input
        type="checkbox"
        checked={done}
        disabled={busy === "done"}
        aria-busy={busy === "done" || undefined}
        onChange={() => patch("done", { status: done ? "offen" : "erledigt" })}
        aria-label={done ? "Wieder öffnen" : "Erledigt"}
        className="h-4 w-4 shrink-0 accent-current"
      />
      <button type="button" onClick={onEdit} className="min-w-0 flex-1 basis-48 text-left">
        <p className={cn("truncate text-[14px]", done && "text-snow/45 line-through")}>{todo.title}</p>
        <p className="truncate text-[12px] text-snow/45">
          {[location, todo.due && `bis ${formatDate(`${todo.due}T12:00:00`)}`, todo.internal_note && "Interne Notiz"].filter(Boolean).join(" · ") || " "}
          {overdue && <span className="text-error"> · überfällig</span>}
        </p>
      </button>
      <Select value={todo.status} onChange={(e) => patch("status", { status: e.target.value })} className="w-32" aria-label="Status" aria-busy={busy === "status"}>
        {(Object.keys(TODO_STATUS) as TodoStatus[]).map((s) => (
          <option key={s} value={s}>
            {TODO_STATUS[s].label}
          </option>
        ))}
      </Select>
      <Select value={todo.owner} onChange={(e) => patch("owner", { owner: e.target.value })} className="w-28" aria-label="Zuständig" aria-busy={busy === "owner"}>
        {OWNER_ORDER.map((o) => (
          <option key={o} value={o}>
            {TODO_OWNER[o].label}
          </option>
        ))}
      </Select>
      <IconButton
        label={todo.visible ? "Für den Kunden sichtbar – ausblenden" : "Nur intern – im Kundenportal zeigen"}
        onClick={() => patch("visible", { visible: !todo.visible })}
        disabled={busy === "visible"}
        aria-busy={busy === "visible" || undefined}
      >
        {todo.visible ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4 text-snow/40" />}
      </IconButton>
    </li>
  );
}

function TodoSheet({ row, locations, onClose, save, remove }: { row: GoogleTodo | null; locations: GoogleLocation[]; onClose: () => void; save: Save; remove: Remove }) {
  const [form, setForm] = useState({
    title: row?.title ?? "",
    owner: row?.owner ?? ("grid" as TodoOwner),
    status: row?.status ?? ("offen" as TodoStatus),
    location_id: row?.location_id ?? "",
    due: row?.due ?? "",
    note: row?.note ?? "",
    internal_note: row?.internal_note ?? "",
    visible: row?.visible ?? true,
  });
  const [busy, setBusy] = useState<"save" | "delete" | null>(null);
  const set = <K extends keyof typeof form>(k: K, v: (typeof form)[K]) => setForm((f) => ({ ...f, [k]: v }));

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setBusy("save");
    const ok = await save("todo", row?.id ?? null, { ...form, location_id: form.location_id || null, due: form.due || null }, row ? "Gespeichert" : "To-do angelegt");
    setBusy(null);
    if (ok) onClose();
  }

  return (
    <Sheet open onClose={onClose} title={row ? "To-do bearbeiten" : "Neues To-do"} subtitle={row ? `angelegt ${formatDate(row.created_at)}${row.created_by ? ` von ${row.created_by}` : ""}` : undefined}>
      <form onSubmit={submit} className="grid gap-4 p-5">
        <Field label="Titel">{(id) => <Input id={id} value={form.title} onChange={(e) => set("title", e.target.value)} required autoFocus />}</Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Zuständig">
            {(id) => (
              <Select id={id} value={form.owner} onChange={(e) => set("owner", e.target.value as TodoOwner)}>
                {OWNER_ORDER.map((o) => (
                  <option key={o} value={o}>
                    {TODO_OWNER[o].label}
                  </option>
                ))}
              </Select>
            )}
          </Field>
          <Field label="Status">
            {(id) => (
              <Select id={id} value={form.status} onChange={(e) => set("status", e.target.value as TodoStatus)}>
                {(Object.keys(TODO_STATUS) as TodoStatus[]).map((s) => (
                  <option key={s} value={s}>
                    {TODO_STATUS[s].label}
                  </option>
                ))}
              </Select>
            )}
          </Field>
          <Field label="Standort">
            {(id) => (
              <Select id={id} value={form.location_id} onChange={(e) => set("location_id", e.target.value)}>
                <option value="">Allgemein</option>
                {locations.map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.name}
                  </option>
                ))}
              </Select>
            )}
          </Field>
          <Field label="Fällig">{(id) => <Input id={id} type="date" value={form.due} onChange={(e) => set("due", e.target.value)} />}</Field>
        </div>
        <Field label="Notiz für den Kunden" hint="Erscheint im Kundenportal unter dem To-do.">
          {(id) => <Textarea id={id} value={form.note} onChange={(e) => set("note", e.target.value)} placeholder="z. B. Welches Dokument genau gebraucht wird" />}
        </Field>
        <Field label="Interne Notiz" hint="Sieht nur das GRID-Team.">
          {(id) => <Textarea id={id} value={form.internal_note} onChange={(e) => set("internal_note", e.target.value)} />}
        </Field>
        <label className="flex items-center gap-2 text-[14px]">
          <input type="checkbox" checked={form.visible} onChange={(e) => set("visible", e.target.checked)} className="h-4 w-4 accent-current" />
          Im Kundenportal anzeigen
        </label>
        <div className="flex items-center gap-2 pt-2">
          {row && (
            <Button
              variant="danger"
              icon={<Trash2 className="h-4 w-4" />}
              loading={busy === "delete"}
              loadingText="Wird gelöscht …"
              onClick={async () => {
                setBusy("delete");
                if (await remove("todo", row.id)) onClose();
                setBusy(null);
              }}
            >
              Löschen
            </Button>
          )}
          <Button type="submit" variant="primary" className="ml-auto" loading={busy === "save"} loadingText="Wird gespeichert …" disabled={!form.title.trim()}>
            Speichern
          </Button>
        </div>
      </form>
    </Sheet>
  );
}

// ---------- Standorte ----------

function LocationTable({ board, onEdit, save, onBulk }: { board: GoogleBoard; onEdit: (row: GoogleLocation) => void; save: Save; onBulk: () => void }) {
  const [busy, setBusy] = useState<string | null>(null);
  const openBy = useMemo(() => {
    const map = new Map<string, number>();
    for (const t of board.todos) if (t.location_id && t.status !== "erledigt") map.set(t.location_id, (map.get(t.location_id) ?? 0) + 1);
    return map;
  }, [board.todos]);

  if (!board.locations.length) {
    return (
      <Empty
        icon={<MapPin className="h-8 w-8" />}
        title="Noch keine Standorte"
        text="Lege die Google-Profile an, die wir für den Kunden betreuen – einzeln oder als Liste."
        action={
          <Button icon={<ListPlus className="h-4 w-4" />} onClick={onBulk}>
            Mehrere einfügen
          </Button>
        }
      />
    );
  }

  return (
    <div className="overflow-x-auto rounded-2xl border border-snow/[0.08] bg-surface">
      <table className="w-full min-w-[860px] text-left text-[13.5px]">
        <thead className="border-b border-snow/[0.08] text-[11.5px] tracking-wide text-snow/45 uppercase">
          <tr>
            <th className="px-3 py-2.5 font-medium">Standort</th>
            <th className="w-44 px-3 py-2.5 font-medium">Status</th>
            <th className="px-3 py-2.5 text-right font-medium">Bewertung</th>
            <th className="px-3 py-2.5 text-right font-medium">Anzahl</th>
            <th className="px-3 py-2.5 text-right font-medium" title="Neue Bewertungen seit Betreuungsstart">Seit Start</th>
            <th className="px-3 py-2.5 text-right font-medium">Offen</th>
            <th className="px-3 py-2.5 font-medium">Notiz</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-snow/[0.06]">
          {board.locations.map((l) => {
            const gained = l.start_reviews != null && l.reviews != null ? l.reviews - l.start_reviews : null;
            return (
              <tr key={l.id} className={cn("align-top hover:bg-snow/[0.03]", l.status === "archiviert" && "opacity-55")}>
                <td className="px-3 py-2.5">
                  <button type="button" onClick={() => onEdit(l)} className="text-left">
                    <span className="font-medium hover:underline">{l.name}</span>
                    {(l.brand || l.address) && <span className="block text-[12px] text-snow/45">{[l.brand, l.address].filter(Boolean).join(" · ")}</span>}
                  </button>
                </td>
                <td className="px-3 py-2">
                  <Select
                    value={l.status}
                    aria-label={`Status ${l.name}`}
                    aria-busy={busy === l.id}
                    disabled={busy === l.id}
                    onChange={async (e) => {
                      setBusy(l.id);
                      await save("location", l.id, { status: e.target.value });
                      setBusy(null);
                    }}
                    renderButton={() => (
                      <span className="inline-flex items-center gap-1">
                        <StatusBadge status={l.status} />
                      </span>
                    )}
                  >
                    {(Object.keys(LOCATION_STATUS) as LocationStatus[]).map((s) => (
                      <option key={s} value={s}>
                        {LOCATION_STATUS[s].label}
                      </option>
                    ))}
                  </Select>
                </td>
                <td className="px-3 py-2.5 text-right tabular-nums">
                  {l.rating != null ? (
                    <span className="inline-flex items-center gap-1">
                      {formatRating(l.rating)} <Star className="h-3 w-3 fill-current text-snow/60" />
                    </span>
                  ) : (
                    <span className="text-snow/35">–</span>
                  )}
                </td>
                <td className="px-3 py-2.5 text-right tabular-nums">{l.reviews ?? <span className="text-snow/35">–</span>}</td>
                <td className={cn("px-3 py-2.5 text-right tabular-nums", gained != null && gained > 0 && "text-success", gained != null && gained < 0 && "text-error")}>
                  {gained == null ? <span className="text-snow/35">–</span> : `${gained > 0 ? "+" : ""}${gained}`}
                </td>
                <td className="px-3 py-2.5 text-right tabular-nums">{openBy.get(l.id) ?? <span className="text-snow/35">0</span>}</td>
                <td className="max-w-72 px-3 py-2.5 text-[12.5px] text-snow/65">
                  <span className="line-clamp-2">{l.note}</span>
                  {l.internal_note && <span className="line-clamp-1 text-snow/40 italic">Intern: {l.internal_note}</span>}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function LocationSheet({ row, onClose, save, remove }: { row: GoogleLocation | null; onClose: () => void; save: Save; remove: Remove }) {
  const str = (v: number | null | undefined) => (v == null ? "" : String(v).replace(".", ","));
  const [form, setForm] = useState({
    name: row?.name ?? "",
    brand: row?.brand ?? "",
    address: row?.address ?? "",
    maps_url: row?.maps_url ?? "",
    status: row?.status ?? ("anlage" as LocationStatus),
    rating: str(row?.rating),
    reviews: str(row?.reviews),
    start_rating: str(row?.start_rating),
    start_reviews: str(row?.start_reviews),
    note: row?.note ?? "",
    internal_note: row?.internal_note ?? "",
  });
  const [busy, setBusy] = useState<"save" | "delete" | null>(null);
  const set = <K extends keyof typeof form>(k: K, v: (typeof form)[K]) => setForm((f) => ({ ...f, [k]: v }));

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setBusy("save");
    const values: Record<string, unknown> = { ...form };
    // Bewertungen nur mitschicken, wenn geändert – sonst bleibt das Datum „Stand“
    if (row && form.rating === str(row.rating) && form.reviews === str(row.reviews)) {
      delete values.rating;
      delete values.reviews;
    }
    const ok = await save("location", row?.id ?? null, values, row ? "Gespeichert" : "Standort angelegt");
    setBusy(null);
    if (ok) onClose();
  }

  return (
    <Sheet open onClose={onClose} title={row ? row.name : "Neuer Standort"} subtitle={row?.rating_at ? `Bewertungen Stand ${formatDate(`${row.rating_at}T12:00:00`)}` : undefined}>
      <form onSubmit={submit} className="grid gap-4 p-5">
        <Field label="Name (wie bei Google)">{(id) => <Input id={id} value={form.name} onChange={(e) => set("name", e.target.value)} required autoFocus={!row} />}</Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Marke / Konzept">{(id) => <Input id={id} value={form.brand} onChange={(e) => set("brand", e.target.value)} placeholder="z. B. Slim Chickens" />}</Field>
          <Field label="Status">
            {(id) => (
              <Select id={id} value={form.status} onChange={(e) => set("status", e.target.value as LocationStatus)}>
                {(Object.keys(LOCATION_STATUS) as LocationStatus[]).map((s) => (
                  <option key={s} value={s}>
                    {LOCATION_STATUS[s].label}
                  </option>
                ))}
              </Select>
            )}
          </Field>
        </div>
        <Field label="Adresse / Lage">{(id) => <Input id={id} value={form.address} onChange={(e) => set("address", e.target.value)} placeholder="z. B. Flughafen Düsseldorf, Terminal C" />}</Field>
        <Field label="Google-Maps-Link">{(id) => <Input id={id} type="url" value={form.maps_url} onChange={(e) => set("maps_url", e.target.value)} placeholder="https://maps.app.goo.gl/…" />}</Field>
        <div className="grid grid-cols-2 gap-3 rounded-2xl border border-snow/[0.08] p-3">
          <Field label="Bewertung aktuell">{(id) => <Input id={id} inputMode="decimal" value={form.rating} onChange={(e) => set("rating", e.target.value)} placeholder="4,3" />}</Field>
          <Field label="Anzahl aktuell">{(id) => <Input id={id} inputMode="numeric" value={form.reviews} onChange={(e) => set("reviews", e.target.value)} placeholder="812" />}</Field>
          <Field label="Bewertung bei Start">{(id) => <Input id={id} inputMode="decimal" value={form.start_rating} onChange={(e) => set("start_rating", e.target.value)} />}</Field>
          <Field label="Anzahl bei Start">{(id) => <Input id={id} inputMode="numeric" value={form.start_reviews} onChange={(e) => set("start_reviews", e.target.value)} />}</Field>
        </div>
        <Field label="Notiz für den Kunden" hint="Erscheint im Kundenportal beim Standort.">
          {(id) => <Textarea id={id} value={form.note} onChange={(e) => set("note", e.target.value)} placeholder="z. B. Google prüft Name und Öffnungszeiten" />}
        </Field>
        <Field label="Interne Notiz" hint="Sieht nur das GRID-Team.">
          {(id) => <Textarea id={id} value={form.internal_note} onChange={(e) => set("internal_note", e.target.value)} />}
        </Field>
        <div className="flex items-center gap-2 pt-2">
          {row && (
            <Button
              variant="danger"
              icon={<Trash2 className="h-4 w-4" />}
              loading={busy === "delete"}
              loadingText="Wird gelöscht …"
              onClick={async () => {
                if (!window.confirm(`„${row.name}“ löschen? Zugehörige To-dos bleiben als „Allgemein“ erhalten.`)) return;
                setBusy("delete");
                if (await remove("location", row.id)) onClose();
                setBusy(null);
              }}
            >
              Löschen
            </Button>
          )}
          <Button type="submit" variant="primary" className="ml-auto" loading={busy === "save"} loadingText="Wird gespeichert …" disabled={!form.name.trim()}>
            Speichern
          </Button>
        </div>
      </form>
    </Sheet>
  );
}

/** Mehrere Standorte auf einmal: eine Zeile je Standort, „Name; Marke; Adresse“ */
function BulkDialog({ onClose, save }: { onClose: () => void; save: Save }) {
  const [textValue, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const toast = useToast();
  const lines = textValue
    .split("\n")
    .map((line) => line.split(/[;\t]/).map((p) => p.trim()))
    .filter((parts) => parts[0]);

  async function submit() {
    setBusy(true);
    let ok = 0;
    for (const [i, [name, brand, address]] of lines.entries()) {
      if (await save("location", null, { name, brand: brand || null, address: address || null, sort: i })) ok++;
      else break;
    }
    setBusy(false);
    if (ok) toast(`${ok} ${ok === 1 ? "Standort" : "Standorte"} angelegt`);
    if (ok === lines.length) onClose();
  }

  return (
    <Dialog
      open
      onClose={onClose}
      title="Mehrere Standorte einfügen"
      footer={
        <Button variant="primary" loading={busy} loadingText="Wird angelegt …" disabled={!lines.length} onClick={submit}>
          {lines.length ? `${lines.length} anlegen` : "Anlegen"}
        </Button>
      }
    >
      <p className="mb-3 text-[13px] text-snow/60">Eine Zeile je Standort, Teile mit Semikolon oder Tab getrennt (direkt aus Excel kopierbar): Name; Marke; Adresse.</p>
      <Textarea value={textValue} onChange={(e) => setText(e.target.value)} className="min-h-56 font-mono text-[12.5px]" placeholder={"Slim Chickens DUS; Slim Chickens; Flughafen Düsseldorf, Flugsteig C\nKamps BER; Kamps; Flughafen BER, Terminal 1"} />
      {lines.length > 0 && (
        <p className="mt-2 flex items-center gap-1.5 text-[12.5px] text-snow/50">
          <ToneBadge tone="neutral">{lines.length}</ToneBadge> erkannt, Status „{LOCATION_STATUS.anlage.label}“
        </p>
      )}
    </Dialog>
  );
}
