"use client";

import { useState } from "react";
import { CalendarDays, Check, EyeOff, PenLine, Plus, Sparkles, X } from "lucide-react";
import { api } from "@/lib/api";
import { mutate, revalidate, useResource } from "@/lib/data";
import { cn as clsx } from "@/lib/cn";
import type { SocialAccount, SocialPost } from "@/lib/marketing";
import { DAY_KINDS, daysRangeUrl, daysUrl, isoDay, parseDay, type DayStatus, type MarketingDay } from "@/lib/marketing-days";
import { accentFill, accentText } from "@/lib/theme";
import { Badge, Button, Field, Input, Popover, Textarea, useToast } from "@/components/ui";
import { postsUrl } from "./post-editor";
import { addDays, moveTo, shortDate, startOfDay, weekday } from "./planner-parts";

// Social-Media-Tage in der Planung: Chips über den Tagen (Feiertage,
// Aktionstage, Branchen- und Kundentage), ein Popover je Tag mit Aktionen und
// der Knopf „Tage“ mit kommenden Tagen, KI-Vorschlägen und eigenem Tag.

const pill = "bg-surface shadow-[0_1px_2px_var(--shadow-color),0_2px_8px_var(--shadow-color)]";

/** Tage der Kundenwelt im Zeitraum (Kalendertage, inklusive) */
export function useDays(workspaceId: string | null, from: Date, to: Date) {
  return useResource<MarketingDay[]>(workspaceId ? daysRangeUrl(workspaceId, isoDay(from), isoDay(to)) : null);
}

/** Tage nach Kalendertag ("YYYY-MM-DD") */
export function daysByDate(days: MarketingDay[] | undefined) {
  const map = new Map<string, MarketingDay[]>();
  for (const day of days ?? []) map.set(day.date, [...(map.get(day.date) ?? []), day]);
  return map;
}

const longDate = (value: string) => parseDay(value).toLocaleDateString("de-DE", { weekday: "long", day: "numeric", month: "long", year: "numeric" });

/** Post-Idee aus der Notiz (KI-Vorschläge: „Post-Idee: …“) */
const ideaOf = (day: MarketingDay) => day.note.match(/Post-Idee:\s*([\s\S]+)/)?.[1]?.trim() ?? "";

/** Einstieg für den Posttext: „Heute ist der Tag des Croissants!“ */
export function dayHook(day: MarketingDay) {
  const named = /^(Tag|Welttag|Internationaler|\d+\.)\s/.test(day.title);
  const title = named ? day.title.replace(/^Internationaler /, "Internationale ") : day.title;
  const hook = day.kind === "kunde" ? `${day.title}!` : `Heute ist ${named ? "der " : ""}${title}!`;
  const idea = ideaOf(day);
  return idea ? `${hook}\n\n${idea}` : hook;
}

/** Status setzen; allgemeine Tage werden nur für diese Kundenwelt ausgeblendet */
async function setStatus(workspaceId: string, day: MarketingDay, status: DayStatus) {
  await api<MarketingDay>(`/api/marketing/days/${day.id}`, { method: "PATCH", body: JSON.stringify({ status, workspace_id: workspaceId }) });
  mutate<MarketingDay[]>(daysUrl(workspaceId), (list) => (status === "ausgeblendet" ? list.filter((d) => d.id !== day.id) : list.map((d) => (d.id === day.id ? { ...d, status } : d))));
}

/** Entwurf mit Einstiegstext am Tag (18 Uhr) anlegen. Erst ohne Termin, damit
 * er nicht sofort eingeplant wird, dann den Termin als Entwurf setzen. */
async function createPost(workspaceId: string, day: MarketingDay, accounts: SocialAccount[]) {
  const account_ids = accounts.filter((a) => a.status === "active").map((a) => a.id);
  const draft = await api<SocialPost>("/api/marketing/posts", { method: "POST", body: JSON.stringify({ workspace_id: workspaceId, caption: dayHook(day), media: [], account_ids }) });
  const at = moveTo(parseDay(day.date), null);
  const saved =
    at.getTime() > Date.now()
      ? await api<SocialPost>(`/api/marketing/posts/${draft.id}`, { method: "PATCH", body: JSON.stringify({ scheduled_at: at.toISOString(), status: "draft" }) })
      : draft;
  mutate<SocialPost[]>(postsUrl(workspaceId), (list) => [saved, ...list.filter((p) => p.id !== saved.id)]);
  return saved;
}

// ---------- Chip ----------

function chipStyle(day: MarketingDay): React.CSSProperties {
  const color = DAY_KINDS[day.kind].color;
  return day.status === "vorschlag"
    ? { color: accentText(color), borderColor: accentFill(color, 60), background: accentFill(color, 6) }
    : { color: accentText(color), borderColor: "transparent", background: accentFill(color, 15) };
}

export function DayChip({
  day,
  workspaceId,
  accounts,
  onOpenPost,
  compact = false,
  align = "left",
}: {
  day: MarketingDay;
  workspaceId: string;
  accounts: SocialAccount[];
  onOpenPost: (post: SocialPost) => void;
  compact?: boolean;
  align?: "left" | "right";
}) {
  const suggestion = day.status === "vorschlag";
  return (
    // Hülle begrenzt die Breite, damit lange Titel in der Spalte abgeschnitten werden
    <div className="max-w-full min-w-0">
      <Popover
        align={align}
        className="w-72 p-3"
        trigger={({ open, toggle }) => (
          <button
            type="button"
            onClick={toggle}
            aria-expanded={open}
            aria-haspopup="dialog"
            title={`${day.title}${suggestion ? " (Vorschlag)" : ""} · ${DAY_KINDS[day.kind].label}`}
            className={clsx(
              "flex max-w-full min-w-0 items-center gap-0.5 rounded-full border font-medium transition-[filter,box-shadow] hover:brightness-110 focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-snow",
              compact ? "h-[18px] px-1.5 text-[10.5px] leading-4" : "h-[22px] px-2 text-[11.5px] leading-5",
              suggestion && "border-dashed",
              open && "ring-2 ring-snow/20"
            )}
            style={chipStyle(day)}
          >
            <span className="truncate">{day.title}</span>
            {suggestion && <span aria-label="Vorschlag" className="shrink-0 font-semibold">?</span>}
          </button>
        )}
      >
        {(close) => <DayDetails day={day} workspaceId={workspaceId} accounts={accounts} onOpenPost={onOpenPost} close={close} />}
      </Popover>
    </div>
  );
}

function DayDetails({
  day,
  workspaceId,
  accounts,
  onOpenPost,
  close,
}: {
  day: MarketingDay;
  workspaceId: string;
  accounts: SocialAccount[];
  onOpenPost: (post: SocialPost) => void;
  close: () => void;
}) {
  const toast = useToast();
  const [busy, setBusy] = useState<"post" | DayStatus | null>(null);
  const past = parseDay(day.date).getTime() < startOfDay(new Date()).getTime();
  const kind = DAY_KINDS[day.kind];

  async function run(action: "post" | DayStatus) {
    setBusy(action);
    try {
      if (action === "post") {
        const post = await createPost(workspaceId, day, accounts);
        close();
        onOpenPost(post);
        return;
      }
      await setStatus(workspaceId, day, action);
      toast(action === "ausgeblendet" ? `„${day.title}“ ausgeblendet` : `„${day.title}“ übernommen`);
      close();
    } catch (error) {
      toast(error instanceof Error ? error.message : "Fehlgeschlagen", "error");
      setBusy(null);
    }
  }

  return (
    <div role="dialog" aria-label={day.title} className="flex flex-col gap-2.5">
      <div className="flex flex-col gap-1">
        <p className="text-[14px] leading-snug font-semibold break-words">{day.title}</p>
        <p className="text-[12.5px] text-snow/55">{longDate(day.date)}</p>
        <div className="flex flex-wrap items-center gap-1 pt-0.5">
          <Badge color={kind.color}>{kind.label}</Badge>
          {day.region && <Badge>{day.region}</Badge>}
          {day.status === "vorschlag" && <Badge>{day.source === "ki" ? "KI-Vorschlag" : "Vorschlag"}</Badge>}
          {day.workspace_id === null && <Badge>Für alle Kunden</Badge>}
        </div>
      </div>
      {day.note && <p className="max-h-40 overflow-y-auto text-[12.5px] leading-relaxed whitespace-pre-line text-snow/75">{day.note}</p>}
      <div className="flex flex-col gap-1.5 pt-0.5">
        <Button
          variant="primary"
          size="sm"
          icon={<PenLine className="h-4 w-4" />}
          loading={busy === "post"}
          loadingText="Wird erstellt …"
          disabled={!!busy && busy !== "post"}
          onClick={() => run("post")}
          title={past ? "Der Tag liegt in der Vergangenheit: Entwurf ohne Termin" : "Entwurf mit Einstiegstext an diesem Tag anlegen"}
        >
          Post dazu erstellen
        </Button>
        <div className="flex gap-1.5">
          {day.status === "vorschlag" && (
            <Button size="sm" className="flex-1" icon={<Check className="h-4 w-4" />} loading={busy === "aktiv"} loadingText="Übernimmt …" disabled={!!busy && busy !== "aktiv"} onClick={() => run("aktiv")}>
              Übernehmen
            </Button>
          )}
          <Button
            variant="ghost"
            size="sm"
            className="flex-1"
            icon={<EyeOff className="h-4 w-4" />}
            loading={busy === "ausgeblendet"}
            loadingText="Blendet aus …"
            disabled={!!busy && busy !== "ausgeblendet"}
            onClick={() => run("ausgeblendet")}
            title={day.workspace_id === null ? "Nur für diesen Kunden ausblenden" : "Tag ausblenden"}
          >
            Ausblenden
          </Button>
        </div>
      </div>
    </div>
  );
}

/** Chips eines Tages; in der Monatsansicht höchstens zwei, Rest als „+N“ */
export function DayChips({
  days,
  compact = false,
  ...props
}: {
  days: MarketingDay[] | undefined;
  workspaceId: string;
  accounts: SocialAccount[];
  onOpenPost: (post: SocialPost) => void;
  compact?: boolean;
  align?: "left" | "right";
}) {
  if (!days?.length) return null;
  const max = compact ? 2 : 4;
  const shown = days.slice(0, max);
  const rest = days.slice(max);
  return (
    <div className={clsx("flex min-w-0 flex-wrap", compact ? "gap-0.5" : "gap-1 px-1")}>
      {shown.map((day) => (
        <DayChip key={day.id} day={day} compact={compact} {...props} />
      ))}
      {rest.length > 0 && (
        <span className={clsx("self-center text-snow/50 tabular-nums", compact ? "text-[10.5px]" : "text-[11.5px]")} title={rest.map((d) => d.title).join("\n")}>
          +{rest.length}
        </span>
      )}
    </div>
  );
}

// ---------- Knopf „Tage“ ----------

type Tab = "upcoming" | "suggestions";

export function DaysButton({
  workspaceId,
  onJump,
}: {
  workspaceId: string;
  /** Planung auf diesen Tag springen lassen */
  onJump: (date: Date) => void;
}) {
  const toast = useToast();
  const today = startOfDay(new Date());
  // Ein Jahr voraus: „Nächste 60 Tage“ und alle offenen Vorschläge
  const year = useDays(workspaceId, today, addDays(today, 366));
  const [tab, setTab] = useState<Tab>("upcoming");
  const [suggesting, setSuggesting] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [form, setForm] = useState<{ date: string; title: string; note: string } | null>(null);
  const [saving, setSaving] = useState(false);

  const limit = isoDay(addDays(today, 60));
  const upcoming = (year.data ?? []).filter((d) => d.date <= limit);
  const suggestions = (year.data ?? []).filter((d) => d.status === "vorschlag");
  const list = tab === "upcoming" ? upcoming : suggestions;

  async function suggest() {
    setSuggesting(true);
    try {
      const found = await api<MarketingDay[]>("/api/marketing/days/suggest", { method: "POST", body: JSON.stringify({ workspace_id: workspaceId }) });
      revalidate(daysUrl(workspaceId));
      toast(found.length ? `${found.length} neue Tage vorgeschlagen` : "Keine neuen Tage gefunden");
      if (found.length) setTab("suggestions");
    } catch (error) {
      toast(error instanceof Error ? error.message : "Vorschläge fehlgeschlagen", "error");
    }
    setSuggesting(false);
  }

  async function quick(day: MarketingDay, status: DayStatus) {
    setBusy(`${day.id}:${status}`);
    try {
      await setStatus(workspaceId, day, status);
    } catch (error) {
      toast(error instanceof Error ? error.message : "Fehlgeschlagen", "error");
    }
    setBusy(null);
  }

  async function save(event: React.FormEvent) {
    event.preventDefault();
    if (!form) return;
    if (!form.date || !form.title.trim()) return toast("Datum und Titel angeben", "error");
    setSaving(true);
    try {
      const day = await api<MarketingDay>("/api/marketing/days", { method: "POST", body: JSON.stringify({ workspace_id: workspaceId, ...form, kind: "kunde" }) });
      revalidate(daysUrl(workspaceId));
      toast(`„${day.title}“ angelegt`);
      setForm(null);
      setTab("upcoming");
      onJump(parseDay(day.date));
    } catch (error) {
      toast(error instanceof Error ? error.message : "Speichern fehlgeschlagen", "error");
    }
    setSaving(false);
  }

  return (
    <Popover
      className="w-[min(24rem,calc(100vw-2rem))] p-3"
      trigger={({ open, toggle }) => (
        <button
          type="button"
          onClick={toggle}
          aria-expanded={open}
          title="Feiertage, Aktionstage und Termine des Kunden"
          className={clsx("flex h-9 items-center gap-2 rounded-full px-4 text-[13px] font-medium hover:text-snow", pill, open && "ring-2 ring-snow/15")}
        >
          <CalendarDays className="h-4 w-4" />
          Tage
          {suggestions.length > 0 && (
            <span className="rounded-full px-1.5 text-[11px] leading-[18px] font-semibold tabular-nums" style={{ background: accentFill(DAY_KINDS.branche.color, 18), color: accentText(DAY_KINDS.branche.color) }}>
              {suggestions.length}
            </span>
          )}
        </button>
      )}
    >
      {(close) => (
        <div className="flex flex-col gap-3">
          <div className="flex items-center justify-between gap-2">
            <p className="text-[14px] font-semibold">Social-Media-Tage</p>
            <div className="flex items-center rounded-full bg-snow/[0.06] p-0.5" role="group" aria-label="Liste">
              {(["upcoming", "suggestions"] as Tab[]).map((t) => (
                <button
                  key={t}
                  type="button"
                  aria-pressed={tab === t}
                  onClick={() => setTab(t)}
                  className={clsx("h-6 rounded-full px-2.5 text-[12px] font-medium transition-colors", tab === t ? "bg-snow text-sky" : "text-snow/60 hover:text-snow")}
                >
                  {t === "upcoming" ? "60 Tage" : `Vorschläge (${suggestions.length})`}
                </button>
              ))}
            </div>
          </div>

          <div className="-mx-1 flex max-h-72 flex-col overflow-y-auto">
            {year.loading ? (
              <p className="px-1 py-3 text-[12.5px] text-snow/50">Lädt …</p>
            ) : year.error ? (
              <p className="px-1 py-3 text-[12.5px] text-error">{year.error.message}</p>
            ) : !list.length ? (
              <p className="px-1 py-3 text-[12.5px] text-snow/50">{tab === "upcoming" ? "Keine Tage in den nächsten 60 Tagen." : "Keine offenen Vorschläge. Die KI sucht passende Tage für die nächsten 12 Monate."}</p>
            ) : (
              list.map((day) => {
                const date = parseDay(day.date);
                const color = DAY_KINDS[day.kind].color;
                return (
                  <div key={day.id} className="group flex items-center gap-1 rounded-xl hover:bg-snow/[0.06]">
                    <button
                      type="button"
                      onClick={() => {
                        onJump(date);
                        close();
                      }}
                      title={`${day.title} · ${DAY_KINDS[day.kind].label}${day.note ? `\n${day.note}` : ""}`}
                      className="flex min-w-0 flex-1 items-center gap-2.5 px-2 py-1.5 text-left"
                    >
                      <span className="w-[4.5rem] shrink-0 text-[12px] text-snow/50 tabular-nums">
                        {weekday(date)} {shortDate(date)}
                        {date.getFullYear() !== today.getFullYear() && String(date.getFullYear()).slice(2)}
                      </span>
                      <span
                        aria-hidden
                        className={clsx("h-2 w-2 shrink-0 rounded-full", day.status === "vorschlag" && "border border-dashed")}
                        style={day.status === "vorschlag" ? { borderColor: accentText(color) } : { background: accentText(color) }}
                      />
                      <span className={clsx("truncate text-[13px]", day.status === "vorschlag" && "italic text-snow/75")}>
                        {day.title}
                        {day.status === "vorschlag" && " ?"}
                      </span>
                    </button>
                    {day.status === "vorschlag" && (
                      <span className="flex shrink-0 items-center pr-1">
                        <button
                          type="button"
                          aria-label={`${day.title} übernehmen`}
                          title="Übernehmen"
                          disabled={!!busy}
                          aria-busy={busy === `${day.id}:aktiv` || undefined}
                          onClick={() => quick(day, "aktiv")}
                          className="grid h-7 w-7 place-items-center rounded-full text-snow/55 hover:bg-snow/[0.08] hover:text-snow disabled:opacity-50"
                        >
                          <Check className="h-3.5 w-3.5" />
                        </button>
                        <button
                          type="button"
                          aria-label={`${day.title} ausblenden`}
                          title="Ausblenden"
                          disabled={!!busy}
                          aria-busy={busy === `${day.id}:ausgeblendet` || undefined}
                          onClick={() => quick(day, "ausgeblendet")}
                          className="grid h-7 w-7 place-items-center rounded-full text-snow/55 hover:bg-snow/[0.08] hover:text-snow disabled:opacity-50"
                        >
                          <X className="h-3.5 w-3.5" />
                        </button>
                      </span>
                    )}
                  </div>
                );
              })
            )}
          </div>

          {form ? (
            <form onSubmit={save} className="flex flex-col gap-2.5 rounded-2xl border border-snow/[0.08] bg-snow/[0.03] p-3">
              <div className="grid grid-cols-[8.5rem_1fr] gap-2">
                <Field label="Datum">{(id) => <Input id={id} type="date" required value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} className="h-9 px-2.5" />}</Field>
                <Field label="Titel">
                  {(id) => <Input id={id} required maxLength={160} placeholder="z. B. Filialeröffnung" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} className="h-9" autoFocus />}
                </Field>
              </div>
              <Field label="Notiz">
                {(id) => <Textarea id={id} maxLength={2000} placeholder="Warum relevant, Post-Idee …" value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} className="min-h-16 text-[13px]" />}
              </Field>
              <div className="flex justify-end gap-1.5">
                <Button type="button" variant="ghost" size="sm" onClick={() => setForm(null)} disabled={saving}>
                  Abbrechen
                </Button>
                <Button type="submit" variant="primary" size="sm" loading={saving} loadingText="Wird gespeichert …">
                  Tag speichern
                </Button>
              </div>
            </form>
          ) : (
            <div className="flex gap-1.5">
              <Button size="sm" className="flex-1" icon={<Sparkles className="h-4 w-4" />} loading={suggesting} loadingText="Sucht Tage … (1–3 Min.)" onClick={suggest}>
                KI-Vorschläge holen
              </Button>
              <Button size="sm" icon={<Plus className="h-4 w-4" />} onClick={() => setForm({ date: isoDay(today), title: "", note: "" })} disabled={suggesting}>
                Eigener Tag
              </Button>
            </div>
          )}
        </div>
      )}
    </Popover>
  );
}
