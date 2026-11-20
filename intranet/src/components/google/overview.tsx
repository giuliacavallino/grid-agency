"use client";

import { useMemo, useState } from "react";
import { CircleCheck, ExternalLink, Hand, MapPin, Search, Star, Wrench } from "lucide-react";
import { cn } from "@/lib/cn";
import { formatDate } from "@/lib/format";
import {
  formatRating,
  googleStats,
  LOCATION_STATUS,
  TODO_STATUS,
  type LocationStatus,
  type PortalGoogle,
  type PortalGoogleLocation,
  type PortalGoogleTodo,
  type Tone,
} from "@/lib/google";

// Google-Stand, wie ihn der Kunde sieht: Kennzahlen, was wir vom Kunden
// brauchen, woran GRID arbeitet, alle Standorte mit Status und Bewertungen.
// Wird im Kundenportal und intern als „Kundenansicht“ verwendet.

const TONE_COLOR: Partial<Record<Tone, string>> = { warn: "#f5a524", action: "#e8590c" };

export function ToneBadge({ tone, children, title }: { tone: Tone; children: React.ReactNode; title?: string }) {
  const color = TONE_COLOR[tone];
  return (
    <span
      title={title}
      className={cn(
        "inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-[11.5px] leading-4 font-medium whitespace-nowrap",
        tone === "success" && "bg-success/15 text-success",
        tone === "error" && "bg-error/12 text-error",
        tone === "neutral" && "bg-snow/[0.08] text-snow/80",
        tone === "muted" && "bg-snow/[0.05] text-snow/45"
      )}
      style={color ? { background: `color-mix(in srgb, ${color} 16%, transparent)`, color: `color-mix(in srgb, ${color} var(--accent-mix), var(--color-snow))` } : undefined}
    >
      {children}
    </span>
  );
}

export function StatusBadge({ status }: { status: LocationStatus }) {
  const s = LOCATION_STATUS[status];
  return (
    <ToneBadge tone={s.tone} title={s.hint}>
      {s.label}
    </ToneBadge>
  );
}

export function Stars({ rating, reviews, className }: { rating: number | null; reviews: number | null; className?: string }) {
  if (rating == null) return <span className={cn("text-[13px] text-snow/40", className)}>Noch keine Bewertung</span>;
  return (
    <span className={cn("inline-flex items-baseline gap-1 text-[14px] tabular-nums", className)}>
      <Star className="h-3.5 w-3.5 translate-y-[1px] self-center fill-current text-snow/70" aria-hidden />
      <strong className="font-semibold">{formatRating(rating)}</strong>
      {reviews != null && <span className="text-snow/50">({reviews.toLocaleString("de-DE")})</span>}
    </span>
  );
}

const delta = (l: PortalGoogleLocation) => (l.start_reviews != null && l.reviews != null ? l.reviews - l.start_reviews : null);

export function GoogleOverview({ data, audience = "kunde" }: { data: PortalGoogle; audience?: "kunde" | "intern" }) {
  const stats = googleStats({ locations: data.locations, todos: data.todos });
  const open = data.todos.filter((t) => t.status !== "erledigt");
  const forCustomer = open.filter((t) => t.owner === "kunde");
  const forUs = open.filter((t) => t.owner !== "kunde");
  const done = data.todos.filter((t) => t.status === "erledigt").sort((a, b) => (b.done_at ?? b.updated_at).localeCompare(a.done_at ?? a.updated_at));
  const names = new Map(data.locations.map((l) => [l.id, l.name]));

  return (
    <div className="grid gap-8">
      <section aria-label="Kennzahlen" className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Tile label="Standorte live" value={`${stats.live}`} sub={`von ${stats.total}`} bar={stats.total ? stats.live / stats.total : 0} />
        <Tile label="Ø Bewertung" value={formatRating(stats.rating)} sub={stats.reviews ? `${stats.reviews.toLocaleString("de-DE")} Bewertungen` : "noch keine Daten"} star={stats.rating != null} />
        <Tile
          label="Neue Bewertungen"
          value={stats.gained == null ? "–" : `${stats.gained > 0 ? "+" : ""}${stats.gained.toLocaleString("de-DE")}`}
          sub="seit Betreuungsstart"
        />
        <Tile label={audience === "kunde" ? "Offen bei dir" : "Offen beim Kunden"} value={String(stats.openCustomer)} sub={`${stats.openGrid + stats.openGoogle} bei GRID/Google`} highlight={stats.openCustomer > 0} />
      </section>

      {forCustomer.length > 0 && (
        <section>
          <Heading icon={Hand}>{audience === "kunde" ? "Das brauchen wir von dir" : "Wartet auf den Kunden"}</Heading>
          <div className="grid gap-2">
            {forCustomer.map((t) => (
              <TodoCard key={t.id} todo={t} location={t.location_id ? names.get(t.location_id) : undefined} strong />
            ))}
          </div>
        </section>
      )}

      <section>
        <Heading icon={Wrench}>Daran arbeiten wir</Heading>
        {forUs.length ? (
          <div className="grid gap-2">
            {forUs.map((t) => (
              <TodoCard key={t.id} todo={t} location={t.location_id ? names.get(t.location_id) : undefined} />
            ))}
          </div>
        ) : (
          <Note text="Gerade ist bei uns nichts offen." />
        )}
      </section>

      {data.locations.length > 0 && <Locations locations={data.locations} todos={open} />}

      {done.length > 0 && (
        <section>
          <Heading icon={CircleCheck}>Zuletzt erledigt</Heading>
          <ul className="grid gap-1.5">
            {done.slice(0, 12).map((t) => (
              <li key={t.id} className="flex items-baseline gap-3 rounded-xl px-1 text-[14px]">
                <span className="w-14 shrink-0 text-[12.5px] text-snow/45 tabular-nums">{formatDate(t.done_at ?? t.updated_at, { day: "2-digit", month: "2-digit" })}</span>
                <span className="min-w-0 flex-1">
                  {t.title}
                  {t.location_id && names.get(t.location_id) && <span className="text-snow/45"> · {names.get(t.location_id)}</span>}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {data.updated_at && <p className="text-center text-[12px] text-snow/40">Stand: {formatDate(data.updated_at, { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" })} Uhr</p>}
    </div>
  );
}

function Tile({ label, value, sub, bar, star, highlight }: { label: string; value: string; sub: string; bar?: number; star?: boolean; highlight?: boolean }) {
  return (
    <div className={cn("rounded-3xl border bg-surface p-4 shadow-[0_4px_18px_var(--shadow-color)] md:p-5", highlight ? "border-snow/25" : "border-snow/[0.07]")}>
      <p className="text-[11.5px] tracking-[0.14em] text-snow/50 uppercase">{label}</p>
      <p className="mt-2 flex items-center gap-1.5 text-[28px] leading-none font-semibold tracking-tight tabular-nums">
        {value}
        {star && <Star className="h-5 w-5 fill-current text-snow/70" aria-hidden />}
      </p>
      <p className="mt-1.5 text-[12.5px] text-snow/50">{sub}</p>
      {bar != null && (
        <div className="mt-2.5 h-1.5 overflow-hidden rounded-full bg-snow/[0.08]" aria-hidden>
          <span className="block h-full bg-success" style={{ width: `${Math.round(bar * 100)}%` }} />
        </div>
      )}
    </div>
  );
}

function Heading({ icon: Icon, children }: { icon: typeof Hand; children: React.ReactNode }) {
  return (
    <h2 className="mb-3 flex items-center gap-2 text-[17px] font-medium">
      <Icon className="h-5 w-5 text-snow/55" /> {children}
    </h2>
  );
}

function Note({ text }: { text: string }) {
  return <p className="rounded-2xl border border-snow/[0.08] bg-surface px-5 py-4 text-[14px] text-snow/65">{text}</p>;
}

function TodoCard({ todo, location, strong }: { todo: PortalGoogleTodo; location?: string; strong?: boolean }) {
  const status = TODO_STATUS[todo.status];
  const overdue = todo.due && todo.due < new Date().toISOString().slice(0, 10);
  return (
    <article className={cn("rounded-2xl border bg-surface px-4 py-3 shadow-[0_2px_10px_var(--shadow-color)]", strong ? "border-snow/20" : "border-snow/[0.07]")}>
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
        <p className="min-w-0 flex-1 text-[14.5px] font-medium">{todo.title}</p>
        {todo.owner === "google" && <ToneBadge tone="muted">Google</ToneBadge>}
        <ToneBadge tone={status.tone}>{status.label}</ToneBadge>
      </div>
      {(location || todo.due) && (
        <p className="mt-0.5 text-[12.5px] text-snow/50">
          {location && (
            <span className="inline-flex items-center gap-1">
              <MapPin className="h-3 w-3" /> {location}
            </span>
          )}
          {location && todo.due && " · "}
          {todo.due && <span className={cn(overdue && "text-error")}>bis {formatDate(`${todo.due}T12:00:00`, { day: "2-digit", month: "2-digit", year: "numeric" })}</span>}
        </p>
      )}
      {todo.note && <p className="mt-1.5 text-[13.5px] leading-relaxed whitespace-pre-line text-snow/70">{todo.note}</p>}
    </article>
  );
}

function Locations({ locations, todos }: { locations: PortalGoogleLocation[]; todos: PortalGoogleTodo[] }) {
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<LocationStatus | "alle">("alle");
  const counts = useMemo(() => {
    const map = new Map<LocationStatus, number>();
    for (const l of locations) map.set(l.status, (map.get(l.status) ?? 0) + 1);
    return [...map.entries()].sort((a, b) => Object.keys(LOCATION_STATUS).indexOf(a[0]) - Object.keys(LOCATION_STATUS).indexOf(b[0]));
  }, [locations]);
  const openBy = useMemo(() => {
    const map = new Map<string, number>();
    for (const t of todos) if (t.location_id) map.set(t.location_id, (map.get(t.location_id) ?? 0) + 1);
    return map;
  }, [todos]);
  const q = query.trim().toLowerCase();
  const shown = locations.filter(
    (l) => (status === "alle" || l.status === status) && (!q || [l.name, l.brand, l.address].some((v) => v?.toLowerCase().includes(q)))
  );

  return (
    <section>
      <Heading icon={MapPin}>Standorte</Heading>
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <Chip active={status === "alle"} onClick={() => setStatus("alle")}>
          Alle {locations.length}
        </Chip>
        {counts.map(([s, n]) => (
          <Chip key={s} active={status === s} onClick={() => setStatus(s)}>
            {LOCATION_STATUS[s].label} {n}
          </Chip>
        ))}
        {locations.length > 8 && (
          <label className="relative ml-auto w-full sm:w-56">
            <span className="sr-only">Standort suchen</span>
            <Search className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-snow/40" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Standort suchen"
              className="h-9 w-full rounded-full border border-snow/12 bg-surface pr-3 pl-9 text-[13.5px] outline-none placeholder:text-snow/35 focus:border-snow/35"
            />
          </label>
        )}
      </div>
      <div className="grid gap-2">
        {shown.map((l) => {
          const d = delta(l);
          return (
            <article key={l.id} className="rounded-2xl border border-snow/[0.07] bg-surface px-4 py-3 shadow-[0_2px_10px_var(--shadow-color)]">
              <div className="flex flex-wrap items-start gap-x-3 gap-y-1.5">
                <div className="min-w-0 flex-1 basis-56">
                  <p className="flex items-center gap-1.5 text-[14.5px] font-medium">
                    {l.name}
                    {l.maps_url && (
                      <a href={l.maps_url} target="_blank" rel="noreferrer" className="text-snow/45 hover:text-snow" aria-label={`${l.name} bei Google Maps öffnen`}>
                        <ExternalLink className="h-3.5 w-3.5" />
                      </a>
                    )}
                  </p>
                  {(l.brand || l.address) && <p className="text-[12.5px] text-snow/50">{[l.brand, l.address].filter(Boolean).join(" · ")}</p>}
                </div>
                <div className="flex shrink-0 flex-wrap items-center gap-2">
                  <Stars rating={l.rating} reviews={l.reviews} />
                  {d != null && d !== 0 && <span className={cn("text-[12px] tabular-nums", d > 0 ? "text-success" : "text-error")}>{`${d > 0 ? "+" : ""}${d}`}</span>}
                  <StatusBadge status={l.status} />
                </div>
              </div>
              {(l.note || openBy.get(l.id)) && (
                <p className="mt-1.5 text-[13px] leading-relaxed text-snow/65">
                  {l.note}
                  {openBy.get(l.id) ? <span className="text-snow/45">{l.note ? " · " : ""}{openBy.get(l.id)} offene Punkte</span> : null}
                </p>
              )}
            </article>
          );
        })}
        {!shown.length && <Note text="Kein Standort passt zur Auswahl." />}
      </div>
    </section>
  );
}

function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn("h-8 rounded-full border px-3 text-[12.5px] tabular-nums transition-colors", active ? "border-snow/40 bg-snow/[0.1] font-medium text-snow" : "border-snow/12 text-snow/65 hover:text-snow")}
    >
      {children}
    </button>
  );
}


