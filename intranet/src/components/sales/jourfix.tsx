"use client";

import { useId, useMemo, useState } from "react";
import { CalendarClock, Copy, Plus, Repeat, Video, X } from "lucide-react";
import { api, ApiError } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { cn } from "@/lib/cn";
import { DEMO, SHARED_MAILBOX } from "@/lib/config";
import { mutate, revalidate, useResource, useRows } from "@/lib/data";
import { addDemoSeries, endDemoSeries } from "@/lib/graph-demo";
import {
  berlinWall,
  DURATIONS,
  isEmail,
  MAX_OCCURRENCES,
  monthlyHint,
  parseLocal,
  RHYTHMS,
  TZ,
  type JourFix,
  type JourFixInput,
  type Rhythm,
} from "@/lib/jourfix";
import type { Customer } from "@/lib/sales/types";
import { Button, Dialog, Field, Input, Select, Spinner, useToast } from "@/components/ui";
import { useTeam } from "@/components/access";

// Jour fixe anlegen (Kalender „Neuer Termin“ mit „Wiederholen“ oder auf der
// Kundenseite), Liste je Kunde mit Link kopieren, Beitreten und Beenden.

const LIST = "/api/kalender/jourfix";

/** Datum als Berliner Ortszeit für datetime-local, "YYYY-MM-DDTHH:mm" */
const toBerlinInput = (date: Date) => new Date(berlinWall(date.getTime())).toISOString().slice(0, 16);

const defaultTitle = (customer: Customer | undefined) => (customer ? `Jour fixe GRID × ${customer.name}` : "Jour fixe GRID");

const nextFormat = new Intl.DateTimeFormat("de-DE", { timeZone: TZ, weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });

/** Kleiner Schalter (wie Artikel aktiv/inaktiv) */
export function Switch({ checked, onChange, label, className }: { checked: boolean; onChange: (value: boolean) => void; label: string; className?: string }) {
  return (
    <label className={cn("flex cursor-pointer items-center gap-2.5 text-sm", className)}>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={cn("relative h-5 w-9 shrink-0 rounded-full transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-snow", checked ? "bg-success" : "bg-snow/20")}
      >
        <span className={cn("absolute top-0.5 left-0.5 h-4 w-4 rounded-full bg-sky transition-transform", checked && "translate-x-4")} />
      </button>
      {label}
    </label>
  );
}

type Suggestion = { email: string; label: string };

/** E-Mail-Adressen als Chips; Vorschläge aus Kunde und Team, frei ergänzbar */
function Attendees({ value, onChange, suggestions }: { value: string[]; onChange: (value: string[]) => void; suggestions: Suggestion[] }) {
  const id = useId();
  const [draft, setDraft] = useState("");
  const [invalid, setInvalid] = useState(false);
  const open = suggestions.filter((s) => !value.includes(s.email));

  function add(raw: string) {
    const emails = raw.split(/[\s,;]+/).map((e) => e.trim().toLowerCase()).filter(Boolean);
    if (!emails.length) return true;
    if (emails.some((e) => !isEmail(e))) {
      setInvalid(true);
      return false;
    }
    onChange([...new Set([...value, ...emails])]);
    setDraft("");
    setInvalid(false);
    return true;
  }

  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-xs font-medium text-snow/60">
        Teilnehmer*innen
      </label>
      <div className={cn("flex min-h-10 flex-wrap items-center gap-1.5 rounded-xl border border-snow/12 bg-ink/60 px-2 py-1.5", invalid && "border-error/60")}>
        {value.map((email) => (
          <span key={email} className="inline-flex max-w-full items-center gap-1 rounded-full bg-snow/[0.1] py-0.5 pr-1 pl-2.5 text-[13px]">
            <span className="truncate">{email}</span>
            <button type="button" aria-label={`${email} entfernen`} onClick={() => onChange(value.filter((e) => e !== email))} className="grid h-5 w-5 place-items-center rounded-full text-snow/55 hover:bg-snow/[0.12] hover:text-snow">
              <X className="h-3 w-3" />
            </button>
          </span>
        ))}
        <input
          id={id}
          value={draft}
          onChange={(e) => {
            setDraft(e.target.value);
            setInvalid(false);
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === "," || e.key === ";") {
              e.preventDefault();
              add(draft);
            } else if (e.key === "Backspace" && !draft && value.length) onChange(value.slice(0, -1));
          }}
          onBlur={() => add(draft)}
          placeholder={value.length ? "Weitere Adresse" : "name@firma.de"}
          type="email"
          className="h-7 min-w-36 flex-1 bg-transparent px-1 text-sm text-snow outline-none placeholder:text-snow/35"
        />
      </div>
      {invalid && <p className="text-xs text-error">Bitte eine gültige E-Mail-Adresse eintragen.</p>}
      {open.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {open.map((s) => (
            <button
              key={s.email}
              type="button"
              onClick={() => onChange([...value, s.email])}
              title={s.email}
              className="inline-flex h-7 items-center gap-1 rounded-full border border-dashed border-snow/20 px-2.5 text-[12px] text-snow/70 hover:border-snow/40 hover:text-snow"
            >
              <Plus className="h-3 w-3" /> {s.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/** Formular „Jour fixe“; im Kalender-Dialog und auf der Kundenseite */
export function JourFixForm({
  start,
  customerId: initialCustomer = null,
  onCancel,
  onCreated,
}: {
  start: Date;
  customerId?: string | null;
  onCancel: () => void;
  onCreated: (jourFix: JourFix) => void;
}) {
  const toast = useToast();
  const auth = useAuth();
  const team = useTeam();
  const { data: customers } = useRows<Customer>("customers");
  const own = auth.account?.email.toLowerCase() ?? "";

  const [customerId, setCustomerId] = useState(initialCustomer ?? "");
  const customer = customers?.find((c) => c.id === customerId);
  const [title, setTitle] = useState<string | null>(null);
  const [attendees, setAttendees] = useState<string[] | null>(null);
  const [from, setFrom] = useState(() => toBerlinInput(start));
  const [minutes, setMinutes] = useState(60);
  const [rhythm, setRhythm] = useState<Rhythm>("weekly");
  const [endType, setEndType] = useState<"noEnd" | "endDate" | "numbered">("noEnd");
  const [endDate, setEndDate] = useState("");
  const [count, setCount] = useState("10");
  const [video, setVideo] = useState(true);
  const [location, setLocation] = useState("");
  const [mailbox, setMailbox] = useState(own || SHARED_MAILBOX);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Ohne eigene Eingabe folgen Titel und Einladung dem gewählten Kunden
  const shownTitle = title ?? defaultTitle(customer);
  const customerEmail = customer?.email?.toLowerCase();
  const shownAttendees = attendees ?? (customerEmail && isEmail(customerEmail) ? [customerEmail] : []);

  const suggestions = useMemo(() => {
    const list: Suggestion[] = [];
    if (customer?.email) list.push({ email: customer.email.toLowerCase(), label: customer.contact_name || customer.email });
    if (customer?.billing_email) list.push({ email: customer.billing_email.toLowerCase(), label: `${customer.billing_email} (Rechnung)` });
    for (const m of team) if (m.email.toLowerCase() !== mailbox) list.push({ email: m.email.toLowerCase(), label: m.name || m.email });
    return list.filter((s, i) => isEmail(s.email) && list.findIndex((o) => o.email === s.email) === i);
  }, [customer, team, mailbox]);

  const startMs = parseLocal(from);
  const weekday = startMs !== null ? new Date(berlinWall(startMs)).toLocaleDateString("de-DE", { weekday: "long", timeZone: "UTC" }) : null;
  const rhythmText = (id: Rhythm, label: string) => {
    if (!weekday) return label;
    if (id === "monthly") return `${label} (${monthlyHint(startMs!)})`;
    return `${label} (${weekday.toLowerCase()}s)`;
  };

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    if (!shownTitle.trim()) return setError("Bitte einen Titel eintragen.");
    if (!shownAttendees.length) return setError("Bitte mindestens eine Person einladen.");
    if (startMs === null) return setError("Bitte Datum und Uhrzeit für den Beginn angeben.");
    if (endType === "endDate" && (!endDate || endDate <= from.slice(0, 10))) return setError("Das Ende-Datum muss nach dem Beginn liegen.");
    const n = Number(count);
    if (endType === "numbered" && !(Number.isInteger(n) && n >= 1 && n <= MAX_OCCURRENCES)) return setError(`Anzahl der Termine bitte zwischen 1 und ${MAX_OCCURRENCES}.`);
    if (!video && !location.trim()) return setError("Ohne Video-Call bitte einen Ort angeben.");

    const input: JourFixInput = {
      title: shownTitle.trim(),
      customer_id: customerId || null,
      attendees: shownAttendees,
      start: from,
      minutes,
      rhythm,
      end: endType === "endDate" ? { type: "endDate", date: endDate } : endType === "numbered" ? { type: "numbered", count: n } : { type: "noEnd" },
      video,
      location: location.trim(),
      mailbox,
    };
    setBusy(true);
    try {
      const created = await api<JourFix>(LIST, { method: "POST", body: JSON.stringify(input) });
      if (DEMO) addDemoSeries(mailbox, created);
      revalidate(LIST);
      toast(video ? "Jour fixe angelegt, Einladung ist raus" : "Jour fixe angelegt");
      onCreated(created);
    } catch (e) {
      setError(e instanceof ApiError && e.status < 500 ? e.message : "Anlegen fehlgeschlagen. Bitte nochmal versuchen.");
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="grid grid-cols-2 gap-3">
      <Field label="Titel" className="col-span-2">
        {(id) => <Input id={id} value={shownTitle} onChange={(e) => setTitle(e.target.value)} />}
      </Field>
      <Field label="Kunde" className="col-span-2 sm:col-span-1">
        {(id) => (
          <Select id={id} value={customerId} onChange={(e) => setCustomerId(e.target.value)}>
            <option value="">Ohne Kunde</option>
            {(customers ?? [])
              .filter((c) => c.status !== "ehemalig" || c.id === customerId)
              .map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
          </Select>
        )}
      </Field>
      <Field label="Organisator-Postfach" className="col-span-2 sm:col-span-1">
        {(id) => (
          <Select id={id} value={mailbox} onChange={(e) => setMailbox(e.target.value)}>
            {own && own !== SHARED_MAILBOX && <option value={own}>{own}</option>}
            <option value={SHARED_MAILBOX}>{SHARED_MAILBOX}</option>
          </Select>
        )}
      </Field>
      <div className="col-span-2">
        <Attendees value={shownAttendees} onChange={setAttendees} suggestions={suggestions} />
      </div>
      <Field label="Beginn">
        {(id) => <Input id={id} type="datetime-local" value={from} onChange={(e) => setFrom(e.target.value)} />}
      </Field>
      <Field label="Dauer">
        {(id) => (
          <Select id={id} value={String(minutes)} onChange={(e) => setMinutes(Number(e.target.value))}>
            {DURATIONS.map((d) => (
              <option key={d} value={String(d)}>
                {d} Min.
              </option>
            ))}
          </Select>
        )}
      </Field>
      <Field label="Rhythmus">
        {(id) => (
          <Select id={id} value={rhythm} onChange={(e) => setRhythm(e.target.value as Rhythm)}>
            {RHYTHMS.map((r) => (
              <option key={r.id} value={r.id}>
                {rhythmText(r.id, r.label)}
              </option>
            ))}
          </Select>
        )}
      </Field>
      <Field label="Ende">
        {(id) => (
          <Select id={id} value={endType} onChange={(e) => setEndType(e.target.value as typeof endType)}>
            <option value="noEnd">Ohne Ende</option>
            <option value="endDate">Bis Datum</option>
            <option value="numbered">Nach Anzahl Terminen</option>
          </Select>
        )}
      </Field>
      {endType === "endDate" && (
        <Field label="Letzter Tag" className="col-span-2 sm:col-start-2 sm:col-span-1">
          {(id) => <Input id={id} type="date" value={endDate} min={from.slice(0, 10)} onChange={(e) => setEndDate(e.target.value)} />}
        </Field>
      )}
      {endType === "numbered" && (
        <Field label="Anzahl Termine" className="col-span-2 sm:col-start-2 sm:col-span-1" hint={`1 bis ${MAX_OCCURRENCES}`}>
          {(id) => <Input id={id} type="number" min={1} max={MAX_OCCURRENCES} inputMode="numeric" value={count} onChange={(e) => setCount(e.target.value)} />}
        </Field>
      )}
      <div className="col-span-2 flex flex-col gap-2 rounded-2xl bg-ink/60 px-4 py-3">
        <Switch checked={video} onChange={setVideo} label="Video-Call über meet.grid-agency.de" />
        <p className="text-xs text-snow/50">
          {video ? "Ein fester Link für alle Termine der Serie. Steht in der Einladung und im Ort." : "Normaler Termin mit Ort, ohne Video-Call."}
        </p>
        {!video && (
          <Input value={location} onChange={(e) => setLocation(e.target.value)} placeholder="Ort, z. B. GRID Office" aria-label="Ort" />
        )}
      </div>
      {error && (
        <p role="alert" className="col-span-2 text-sm text-error">
          {error}
        </p>
      )}
      <div className="col-span-2 flex justify-end gap-2 pt-2">
        <Button variant="ghost" onClick={onCancel}>
          Abbrechen
        </Button>
        <Button type="submit" variant="primary" loading={busy} loadingText="Wird angelegt …" icon={<Repeat className="h-4 w-4" />}>
          Jour fixe anlegen
        </Button>
      </div>
    </form>
  );
}

/** Vorschlag für neue Jour fixe: nächster Werktag, 10 Uhr */
function suggestedStart() {
  const d = new Date();
  do d.setDate(d.getDate() + 1);
  while (d.getDay() === 0 || d.getDay() === 6);
  d.setHours(10, 0, 0, 0);
  return d;
}

/** Eigenes Popup „Jour fixe anlegen“ (Kundenseite) */
export function JourFixDialog({ open, onClose, customerId }: { open: boolean; onClose: () => void; customerId?: string | null }) {
  const [start] = useState(suggestedStart);
  return (
    <Dialog open={open} onClose={onClose} title="Jour fixe anlegen" width="max-w-xl">
      {open && <JourFixForm start={start} customerId={customerId} onCancel={onClose} onCreated={onClose} />}
    </Dialog>
  );
}

/** Kundenseite: laufende Jour fixe mit Link, Beitreten und Beenden */
export function JourFixSection({ customer }: { customer: Customer }) {
  const url = `${LIST}?customer_id=${encodeURIComponent(customer.id)}`;
  const { data, loading, error } = useResource<JourFix[]>(url);
  const toast = useToast();
  const [creating, setCreating] = useState(false);
  const [ending, setEnding] = useState<JourFix | null>(null);
  const [busy, setBusy] = useState(false);

  async function copy(link: string) {
    try {
      await navigator.clipboard.writeText(link);
      toast("Link kopiert");
    } catch {
      toast("Kopieren ging nicht, bitte den Link markieren", "error");
    }
  }

  async function end() {
    if (!ending) return;
    setBusy(true);
    try {
      await api(`${LIST}/${ending.id}`, { method: "DELETE" });
      if (DEMO) endDemoSeries(ending.title);
      mutate<JourFix[]>(LIST, (list) => list.filter((j) => j.id !== ending.id));
      toast("Jour fixe beendet");
      setEnding(null);
    } catch (e) {
      toast(e instanceof ApiError && e.status < 500 ? e.message : "Beenden fehlgeschlagen", "error");
    }
    setBusy(false);
  }

  const action = "inline-flex h-8 items-center gap-1.5 rounded-full px-3 text-[13px] font-medium transition-colors";

  return (
    <section>
      <div className="mb-2 flex items-center justify-between">
        <p className="text-xs font-medium text-snow/60">Jour fixe</p>
        <Button size="sm" icon={<Plus className="h-3.5 w-3.5" />} onClick={() => setCreating(true)}>
          Jour fixe anlegen
        </Button>
      </div>
      {error ? (
        <p className="rounded-2xl bg-ink/60 px-4 py-5 text-center text-sm text-snow/45">Jour fixe konnten nicht geladen werden.</p>
      ) : loading ? (
        <div className="grid h-16 place-items-center rounded-2xl bg-ink/60">
          <Spinner className="h-4 w-4" />
        </div>
      ) : !data?.length ? (
        <p className="rounded-2xl bg-ink/60 px-4 py-5 text-center text-sm text-snow/45">Noch kein Jour fixe. Ein fester Termin mit festem Link für alle Calls.</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {data.map((j) => (
            <li key={j.id} className="rounded-2xl bg-ink/60 px-4 py-3">
              <div className="flex items-start gap-3">
                <Repeat className="mt-0.5 h-4 w-4 shrink-0 text-snow/45" aria-hidden />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{j.title}</p>
                  <p className="text-[12px] text-snow/55">
                    {j.rhythm} · {j.minutes} Min. · {j.end}
                  </p>
                  {j.next && (
                    <p className="mt-1 inline-flex items-center gap-1.5 text-[12px] text-snow/70">
                      <CalendarClock className="h-3.5 w-3.5" /> Nächster Termin: {nextFormat.format(new Date(j.next))} Uhr
                    </p>
                  )}
                  {!j.url && j.location && <p className="text-[12px] text-snow/55">Ort: {j.location}</p>}
                </div>
              </div>
              <div className="mt-2.5 flex flex-wrap items-center gap-1.5 pl-7">
                {j.url && (
                  <>
                    <a href={j.url} target="_blank" rel="noopener" className={cn(action, "bg-snow text-sky hover:opacity-90")}>
                      <Video className="h-3.5 w-3.5" /> Beitreten
                    </a>
                    <button type="button" onClick={() => copy(j.url!)} className={cn(action, "border border-snow/15 bg-snow/[0.06] hover:bg-snow/[0.12]")}>
                      <Copy className="h-3.5 w-3.5" /> Link kopieren
                    </button>
                  </>
                )}
                <button type="button" onClick={() => setEnding(j)} className={cn(action, "ml-auto text-error/80 hover:bg-error/10 hover:text-error")}>
                  Beenden
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      <JourFixDialog open={creating} onClose={() => setCreating(false)} customerId={customer.id} />
      <Dialog
        open={!!ending}
        onClose={() => setEnding(null)}
        title="Jour fixe beenden?"
        footer={
          <>
            <Button variant="ghost" onClick={() => setEnding(null)}>
              Abbrechen
            </Button>
            <Button variant="danger" loading={busy} loadingText="Wird beendet …" onClick={end}>
              Serie beenden
            </Button>
          </>
        }
      >
        <p className="text-sm text-snow/60">
          „{ending?.title}“ endet heute. Alle künftigen Termine verschwinden aus Outlook und die Eingeladenen bekommen die Änderung. Vergangene Termine bleiben im Kalender.
          {ending?.url && " Der Link zum Video-Call funktioniert danach nicht mehr."}
        </p>
      </Dialog>
    </section>
  );
}
