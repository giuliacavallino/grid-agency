"use client";

import { useEffect, useMemo, useState } from "react";
import { Check, Pencil, Plus, Trash2 } from "lucide-react";
import { api } from "@/lib/api";
import { cn } from "@/lib/cn";
import { accentText } from "@/lib/theme";
import { createRow, deleteRow, mutate, updateRow, useResource, useRows } from "@/lib/data";
import { euro, formatDate, isoDate, num, percent } from "@/lib/format";
import type { Article, Customer, Lead, Retainer, Settings } from "@/lib/sales/types";
import { Badge, Button, Dialog, Empty, Field, IconButton, Input, Select, Spinner, Textarea, useToast } from "@/components/ui";
import { EasybillSync } from "./easybill-sync";
import { PANEL_CLASS, SearchPill, Segmented, weightedValue } from "./pipeline";
import { ChartCard } from "./charts/chart-card";
import { ColumnChart } from "./charts/charts";
import { SERIES_1 } from "./charts/theme";

// ---------- Retainer-Rechnung (auch für Kunden und Analytics) ----------

export const RETAINER_STATUS = [
  { id: "aktiv", label: "Aktiv" },
  { id: "pausiert", label: "Pausiert" },
  { id: "gekuendigt", label: "Gekündigt" },
] as const;

export const retainerStatusLabel = (status: Retainer["status"]) =>
  RETAINER_STATUS.find((s) => s.id === status)?.label ?? status;

const parseDay = (value: string) => new Date(`${value.slice(0, 10)}T00:00:00`);

export function monthRange(offset = 0, from = new Date()) {
  const start = new Date(from.getFullYear(), from.getMonth() + offset, 1);
  const end = new Date(from.getFullYear(), from.getMonth() + offset + 1, 0, 23, 59, 59);
  return { start, end };
}

/** Zählt ein Retainer in diesem Monat? Pausierte zählen nie, gekündigte nur
 * bis zu ihrem Enddatum. */
export function countsInMonth(retainer: Retainer, start: Date, end: Date) {
  if (retainer.status === "pausiert") return false;
  if (retainer.status === "gekuendigt" && !retainer.end_date) return false;
  if (parseDay(retainer.start_date) > end) return false;
  return !retainer.end_date || parseDay(retainer.end_date) >= start;
}

export function monthTotals(retainers: Retainer[], offset = 0) {
  const { start, end } = monthRange(offset);
  const active = retainers.filter((r) => countsInMonth(r, start, end));
  return {
    active,
    mrr: active.reduce((sum, r) => sum + Number(r.monthly_fee), 0),
    hours: active.reduce((sum, r) => sum + Number(r.hours_per_month), 0),
  };
}

const monthLabel = (offset: number, format: "short" | "long" = "short") =>
  monthRange(offset).start.toLocaleDateString("de-DE", format === "short" ? { month: "short" } : { month: "long", year: "numeric" });

// ---------- Retainer anlegen / bearbeiten ----------

type RetainerForm = {
  customer_id: string;
  article_id: string;
  title: string;
  monthly_fee: string;
  hours_per_month: string;
  start_date: string;
  end_date: string;
  status: Retainer["status"];
  notes: string;
};

export function RetainerDialog({
  open,
  onClose,
  retainer,
  customerId,
}: {
  open: boolean;
  onClose: () => void;
  retainer?: Retainer | null;
  customerId?: string;
}) {
  const { data: customers } = useRows<Customer>("customers");
  const { data: articles } = useRows<Article>("articles");
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState<RetainerForm | null>(null);

  useEffect(() => {
    if (!open) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- Formular beim Öffnen vorbelegen
    setForm({
      customer_id: retainer?.customer_id ?? customerId ?? "",
      article_id: retainer?.article_id ?? "",
      title: retainer?.title ?? "",
      monthly_fee: retainer ? String(retainer.monthly_fee) : "",
      hours_per_month: retainer ? String(retainer.hours_per_month) : "",
      start_date: retainer?.start_date ?? isoDate(monthRange(0).start),
      end_date: retainer?.end_date ?? "",
      status: retainer?.status ?? "aktiv",
      notes: retainer?.notes ?? "",
    });
  }, [open, retainer, customerId]);

  if (!form) return null;
  const set = (key: keyof RetainerForm) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setForm((f) => (f ? { ...f, [key]: e.target.value } : f));

  // Artikel wählen → Titel, Preis und Aufwand übernehmen
  function chooseArticle(id: string) {
    const article = articles?.find((a) => a.id === id);
    setForm((f) =>
      f && {
        ...f,
        article_id: id,
        ...(article && {
          title: f.title || article.name,
          monthly_fee: article.unit === "monatlich" ? String(article.price) : f.monthly_fee,
          hours_per_month: article.unit === "monatlich" ? String(article.hours) : f.hours_per_month,
        }),
      }
    );
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!form) return;
    if (!form.customer_id || !form.title.trim() || !form.start_date) {
      return toast("Kunde, Titel und Start sind Pflicht", "error");
    }
    if (form.end_date && form.end_date < form.start_date) return toast("Ende liegt vor dem Start", "error");
    setBusy(true);
    const values: Partial<Retainer> = {
      customer_id: form.customer_id,
      article_id: form.article_id || null,
      title: form.title.trim(),
      monthly_fee: Number(form.monthly_fee.replace(",", ".")) || 0,
      hours_per_month: Number(form.hours_per_month.replace(",", ".")) || 0,
      start_date: form.start_date,
      end_date: form.end_date || null,
      status: form.status,
      notes: form.notes.trim() || null,
    };
    try {
      if (retainer) await updateRow<Retainer>("retainers", retainer.id, values);
      else await createRow<Retainer>("retainers", values);
      toast(retainer ? "Retainer gespeichert" : "Retainer angelegt");
      onClose();
    } catch {
      toast("Speichern fehlgeschlagen", "error");
    }
    setBusy(false);
  }

  return (
    <Dialog open={open} onClose={onClose} title={retainer ? "Retainer bearbeiten" : "Neuer Retainer"}>
      <form onSubmit={submit} className="grid grid-cols-2 gap-3">
        <Field label="Kunde *" className="col-span-2 sm:col-span-1">
          {(id) => (
            <Select id={id} value={form.customer_id} onChange={set("customer_id")} disabled={!!customerId && !retainer}>
              <option value="">Bitte wählen</option>
              {[...(customers ?? [])]
                .sort((a, b) => a.name.localeCompare(b.name, "de"))
                .map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
            </Select>
          )}
        </Field>
        <Field label="Artikel" className="col-span-2 sm:col-span-1" hint="Übernimmt Preis und Aufwand">
          {(id) => (
            <Select id={id} value={form.article_id} onChange={(e) => chooseArticle(e.target.value)}>
              <option value="">Ohne Artikel</option>
              {articles
                ?.filter((a) => a.active || a.id === form.article_id)
                .map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name}
                  </option>
                ))}
            </Select>
          )}
        </Field>
        <Field label="Leistung *" className="col-span-2">
          {(id) => <Input id={id} value={form.title} onChange={set("title")} placeholder="z. B. Social Media Betreuung M" />}
        </Field>
        <Field label="€ pro Monat">{(id) => <Input id={id} inputMode="decimal" value={form.monthly_fee} onChange={set("monthly_fee")} />}</Field>
        <Field label="Stunden pro Monat">{(id) => <Input id={id} inputMode="decimal" value={form.hours_per_month} onChange={set("hours_per_month")} />}</Field>
        <Field label="Start *">{(id) => <Input id={id} type="date" value={form.start_date} onChange={set("start_date")} />}</Field>
        <Field label="Ende" hint="Leer = unbefristet">
          {(id) => <Input id={id} type="date" value={form.end_date} onChange={set("end_date")} />}
        </Field>
        <Field label="Status">
          {(id) => (
            <Select id={id} value={form.status} onChange={set("status")}>
              {RETAINER_STATUS.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.label}
                </option>
              ))}
            </Select>
          )}
        </Field>
        <Field label="Notizen" className="col-span-2">
          {(id) => <Textarea id={id} value={form.notes} onChange={set("notes")} className="min-h-16" />}
        </Field>
        <div className="col-span-2 flex justify-end gap-2 pt-2">
          <Button variant="ghost" onClick={onClose}>
            Abbrechen
          </Button>
          <Button type="submit" variant="primary" loading={busy} loadingText="Wird gespeichert …">
            {retainer ? "Speichern" : "Retainer anlegen"}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}

export function RetainerStatus({ status }: { status: Retainer["status"] }) {
  return (
    <Badge className={cn(status === "aktiv" && "bg-success/15 text-success", status === "gekuendigt" && "bg-error/12 text-error")}>
      {retainerStatusLabel(status)}
    </Badge>
  );
}

// ---------- Seite ----------

// Farben der Balken und Marker (Datenfarben, keine Flächen)
const BILLED = "var(--color-snow)";
const FIRM = "#8fd3a6";
const PIPELINE = "#f5b98e";
const ADJUSTED = "#3987e5";
const CONTRACT_END = "#d9534a";
const MRR_ACCENT = "#a5483a";
const PIPELINE_ACCENT = "#d68a00";
const HATCH = `repeating-linear-gradient(135deg, ${FIRM} 0 3px, color-mix(in srgb, ${FIRM} 30%, transparent) 3px 7px)`;

type Range = "12" | "year" | "next";
type Mode = "mit" | "fest";

type Month = { offset: number; start: Date; end: Date; label: string; long: string; current: boolean; past: boolean };

const shortMonth = (d: Date) =>
  `${d.toLocaleDateString("de-DE", { month: "short" }).replace(".", "")} ${String(d.getFullYear()).slice(2)}`;

/** 15.300 → „15,3k“ */
const kilo = (value: number) =>
  value >= 1000 ? `${(Math.round(value / 100) / 10).toLocaleString("de-DE")}k` : Math.round(value).toLocaleString("de-DE");
const plain = (value: number) => Math.round(value).toLocaleString("de-DE");

function monthsFor(range: Range, now = new Date()): Month[] {
  const offsets =
    range === "12"
      ? Array.from({ length: 12 }, (_, i) => i - 2)
      : Array.from({ length: 12 }, (_, m) => (range === "next" ? 12 : 0) + m - now.getMonth());
  return offsets.map((offset) => {
    const { start, end } = monthRange(offset, now);
    return {
      offset,
      start,
      end,
      label: shortMonth(start),
      long: start.toLocaleDateString("de-DE", { month: "long", year: "numeric" }),
      current: offset === 0,
      past: offset < 0,
    };
  });
}

/** Wert eines Retainers in einem Monat: fest (läuft laut Vertrag) oder
 * Verlängerung (aktiv, Laufzeit endete vorher, wird verlängert angenommen). */
function retainerValue(r: Retainer, month: Month) {
  if (countsInMonth(r, month.start, month.end)) return { firm: Number(r.monthly_fee), renewal: 0 };
  const renews = r.status === "aktiv" && !!r.end_date && parseDay(r.end_date) < month.start && parseDay(r.start_date) <= month.end;
  return { firm: 0, renewal: renews ? Number(r.monthly_fee) : 0 };
}

type Cell = { firm: number; renewal: number; ends: boolean };
type CustomerRow = { id: string; name: string; status: { text: string; warn: boolean }; cells: Cell[] };

function KpiBlock({ label, value, note, color }: { label: string; value: React.ReactNode; note?: React.ReactNode; color?: string }) {
  return (
    <div className="min-w-0">
      <p className="text-[12.5px] text-snow/55">{label}</p>
      <p className="mt-1 truncate text-[28px] leading-tight font-semibold tracking-tight tabular-nums" style={color ? { color: accentText(color) } : undefined}>
        {value}
      </p>
      {note && <p className="mt-0.5 truncate text-[12px] text-snow/45">{note}</p>}
    </div>
  );
}

function StatChip({ label, value, children }: { label: string; value: React.ReactNode; children?: React.ReactNode }) {
  return (
    <div className="min-w-0 rounded-2xl bg-snow/[0.035] px-4 py-2.5">
      <p className="text-[11.5px] text-snow/50">{label}</p>
      <p className="truncate text-[16px] font-semibold tabular-nums">{value}</p>
      {children}
    </div>
  );
}

function LegendSwatch({ style, className }: { style?: React.CSSProperties; className?: string }) {
  return <span className={cn("inline-block h-3 w-3 shrink-0 rounded-[3px]", className)} style={style} aria-hidden />;
}

function CapacityEditor({ hours }: { hours: number }) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(String(hours));
  const [busy, setBusy] = useState(false);
  const toast = useToast();

  async function save() {
    const next = Number(value.replace(",", "."));
    if (!Number.isFinite(next) || next < 0) return toast("Bitte eine Stundenzahl eingeben", "error");
    setBusy(true);
    try {
      const result = await api<Settings>("/api/sales/settings", {
        method: "PUT",
        body: JSON.stringify({ capacity: { team_hours_per_month: next } }),
      });
      mutate<Settings>("/api/sales/settings", () => result);
      setEditing(false);
    } catch {
      toast("Kapazität konnte nicht gespeichert werden", "error");
    }
    setBusy(false);
  }

  if (!editing) {
    return (
      <button
        type="button"
        onClick={() => {
          setValue(String(hours));
          setEditing(true);
        }}
        className="mt-0.5 inline-flex items-center gap-1 text-[12px] text-snow/45 hover:text-snow"
      >
        von {num(hours)} Std. Kapazität <Pencil className="h-3 w-3" />
      </button>
    );
  }
  return (
    <form
      className="mt-1 flex items-center gap-1.5"
      onSubmit={(e) => {
        e.preventDefault();
        save();
      }}
    >
      <Input
        autoFocus
        inputMode="numeric"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        aria-label="Teamkapazität in Stunden pro Monat"
        className="h-7 w-20 rounded-lg px-2 text-[12px]"
      />
      <span className="text-[12px] text-snow/45">Std.</span>
      <Button type="submit" size="sm" className="h-7 px-2" loading={busy} icon={<Check className="h-3.5 w-3.5" />} aria-label="Kapazität speichern" />
    </form>
  );
}

const GRID = "grid grid-cols-[200px_repeat(12,minmax(0,1fr))_96px]";

export function OrderBook() {
  const { data: retainers, loading, error } = useRows<Retainer>("retainers");
  const { data: customers } = useRows<Customer>("customers");
  const { data: articles } = useRows<Article>("articles");
  const { data: leads } = useRows<Lead>("leads", "status=offen");
  const { data: settings } = useResource<Settings>("/api/sales/settings");
  const toast = useToast();
  const [range, setRange] = useState<Range>("12");
  const [mode, setMode] = useState<Mode>("mit");
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("");
  const [editing, setEditing] = useState<Retainer | null | "new">(null);
  const [removing, setRemoving] = useState<Retainer | null>(null);
  const [busy, setBusy] = useState(false);
  const [hover, setHover] = useState<number | null>(null);
  const [year] = useState(() => new Date().getFullYear());

  const customerName = useMemo(() => new Map((customers ?? []).map((c) => [c.id, c.name])), [customers]);
  const articleName = useMemo(() => new Map((articles ?? []).map((a) => [a.id, a.name])), [articles]);
  const capacity = settings?.capacity.team_hours_per_month ?? 0;

  const all = useMemo(() => retainers ?? [], [retainers]);
  const current = monthTotals(all);
  const rate = current.hours > 0 ? current.mrr / current.hours : 0;
  const utilisation = capacity > 0 ? current.hours / capacity : 0;

  const months = useMemo(() => monthsFor(range), [range]);
  const withRenewal = mode === "mit";

  // Gewichtete Pipeline ab dem nächsten Monat (Start frühestens dann)
  const pipelineMonthly = useMemo(() => weightedValue(leads ?? []), [leads]);
  const pipeline = months.map((m) => (m.offset > 0 ? pipelineMonthly : 0));

  // Zeilen je Kunde
  const rowsByCustomer = useMemo<CustomerRow[]>(() => {
    const groups = new Map<string, Retainer[]>();
    for (const r of all) groups.set(r.customer_id, [...(groups.get(r.customer_id) ?? []), r]);
    return [...groups.entries()]
      .map(([id, list]) => {
        const cells = months.map((m) => {
          const cell: Cell = { firm: 0, renewal: 0, ends: false };
          for (const r of list) {
            const v = retainerValue(r, m);
            cell.firm += v.firm;
            cell.renewal += v.renewal;
            if (r.end_date && r.status !== "pausiert") {
              const endDay = parseDay(r.end_date);
              if (endDay >= m.start && endDay <= m.end) cell.ends = true;
            }
          }
          return cell;
        });
        const running = list.filter((r) => r.status !== "pausiert");
        const open = running.some((r) => !r.end_date);
        const cancelled = running.filter((r) => r.status === "gekuendigt" && r.end_date);
        const lastEnd = running.map((r) => r.end_date).filter(Boolean).sort().at(-1);
        const statusLine = open
          ? { text: "Laufzeit fehlt", warn: true }
          : cancelled.length === running.length && lastEnd
            ? { text: `gekündigt zum ${formatDate(lastEnd)}`, warn: false }
            : lastEnd
              ? { text: `Laufzeit bis ${formatDate(lastEnd)}`, warn: false }
              : { text: "pausiert", warn: false };
        return { id, name: customerName.get(id) ?? "Unbekannt", status: statusLine, cells };
      })
      .filter((row) => row.cells.some((c) => c.firm || (withRenewal && c.renewal)))
      .sort((a, b) => a.name.localeCompare(b.name, "de"));
  }, [all, months, customerName, withRenewal]);

  // Summen je Monat
  const totals = months.map((m, i) => {
    const firm = rowsByCustomer.reduce((s, r) => s + r.cells[i].firm, 0);
    const renewal = rowsByCustomer.reduce((s, r) => s + r.cells[i].renewal, 0);
    return { firm, renewal, billed: m.past ? firm : 0, open: m.past ? 0 : firm, pipeline: pipeline[i] };
  });
  const shown = (t: (typeof totals)[number]) => t.firm + (withRenewal ? t.renewal : 0) + t.pipeline;
  const max = Math.max(1, ...totals.map(shown));
  const sumFirm = totals.reduce((s, t) => s + t.firm, 0);
  const sumRenewal = totals.reduce((s, t) => s + t.renewal, 0);
  const sumPipeline = totals.reduce((s, t) => s + t.pipeline, 0);
  const rangeLabel = range === "12" ? "12 Monate" : String(range === "year" ? year : year + 1);

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    return all
      .filter((r) => !status || r.status === status)
      .filter((r) => !q || [r.title, customerName.get(r.customer_id)].some((v) => v?.toLowerCase().includes(q)))
      .sort((a, b) => (customerName.get(a.customer_id) ?? "").localeCompare(customerName.get(b.customer_id) ?? "", "de"));
  }, [all, query, status, customerName]);

  async function remove() {
    if (!removing) return;
    setBusy(true);
    try {
      await deleteRow("retainers", removing.id);
      toast("Retainer gelöscht");
      setRemoving(null);
    } catch {
      toast("Löschen fehlgeschlagen", "error");
    }
    setBusy(false);
  }

  /** Kundenzeile anklicken: Verträge darunter auf den Kunden filtern */
  function showCustomer(name: string) {
    setQuery(name);
    setStatus("");
    document.getElementById("vertraege")?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  const { start, end } = monthRange(0);
  const hovered = hover !== null ? totals[hover] : null;

  return (
    <div className="flex h-full flex-col bg-sky">
      <h1 className="sr-only">Auftragsbuch</h1>
      <div className="flex shrink-0 flex-wrap items-center gap-2 px-4 pt-1 pb-4 md:px-6">
        <Segmented
          label="Zeitraum"
          value={range}
          onChange={setRange}
          options={[
            { id: "12", label: "12 Monate" },
            { id: "year", label: String(year) },
            { id: "next", label: String(year + 1) },
          ]}
        />
        <span className="flex-1" />
        <Segmented
          label="Verlängerungen"
          value={mode}
          onChange={setMode}
          options={[
            { id: "mit", label: "Mit Verlängerung" },
            { id: "fest", label: "Nur fest" },
          ]}
        />
        <EasybillSync />
        <Button
          variant="primary"
          className="h-10 w-10 px-0 shadow-[0_4px_14px_var(--shadow-color)] sm:w-auto sm:px-4"
          icon={<Plus className="h-4 w-4" />}
          onClick={() => setEditing("new")}
          aria-label="Neuer Retainer"
        >
          <span className="hidden sm:inline">Neuer Retainer</span>
        </Button>
      </div>

      {error ? (
        <Empty title="Auftragsbuch konnte nicht geladen werden" text={error.message} />
      ) : loading ? (
        <div className="grid flex-1 place-items-center">
          <Spinner />
        </div>
      ) : (
        <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-6 md:px-6">
          <section className={cn(PANEL_CLASS, "p-5 md:p-6")}>
            <div className="grid grid-cols-2 gap-x-6 gap-y-5 lg:grid-cols-4">
              <KpiBlock label="MRR heute" value={euro(current.mrr)} note={`${monthLabel(0, "long")} · ${current.active.length} Retainer`} color={MRR_ACCENT} />
              <KpiBlock label="Fest gesichert" value={euro(sumFirm)} note={`${rangeLabel} · laut Laufzeit`} />
              <KpiBlock label="Mit Verlängerung" value={euro(sumFirm + sumRenewal)} note={sumRenewal ? `davon ${euro(sumRenewal)} Verlängerung` : "keine Verlängerungen offen"} />
              <KpiBlock
                label="+ Pipeline gewichtet"
                value={euro(sumPipeline)}
                note={`${euro(pipelineMonthly)} pro Monat ab ${monthLabel(1)}`}
                color={PIPELINE_ACCENT}
              />
            </div>

            <div className="-mx-5 mt-6 overflow-x-auto px-5 md:-mx-6 md:px-6">
              <div className="min-w-[1040px]">
                {/* Balken je Monat, spaltengleich mit der Tabelle darunter */}
                <div className={cn(GRID, "relative h-60 items-end border-b border-snow/[0.08]")} role="img" aria-label={`Umsatz je Monat, ${rangeLabel}`}>
                  <div className="self-stretch pr-4 text-[12px] text-snow/45">
                    <p className="font-medium text-snow/70">Umsatz je Monat</p>
                    <p className="mt-0.5">netto, € pro Monat</p>
                    {hovered && hover !== null && (
                      <div className="mt-4 rounded-2xl bg-snow/[0.04] p-3 text-[12px] text-snow/70" aria-live="polite">
                        <p className="mb-1.5 font-semibold text-snow">{months[hover].long}</p>
                        {hovered.billed > 0 && <TooltipLine swatch={{ background: BILLED }} label="Abgerechnet" value={hovered.billed} />}
                        {hovered.open > 0 && <TooltipLine swatch={{ background: FIRM }} label="Fest" value={hovered.open} />}
                        {withRenewal && hovered.renewal > 0 && <TooltipLine swatch={{ background: HATCH }} label="Verlängerung" value={hovered.renewal} />}
                        {hovered.pipeline > 0 && <TooltipLine swatch={{ background: PIPELINE }} label="Pipeline gewichtet" value={hovered.pipeline} />}
                        {!shown(hovered) && <p>Keine Umsätze</p>}
                      </div>
                    )}
                  </div>
                  {totals.map((t, i) => {
                    const total = shown(t);
                    const h = (v: number) => `${(v / max) * 100}%`;
                    return (
                      <div
                        key={months[i].offset}
                        className="group flex h-full cursor-default flex-col items-center justify-end px-1.5 pt-6"
                        onMouseEnter={() => setHover(i)}
                        onMouseLeave={() => setHover(null)}
                      >
                        <span className={cn("mb-1.5 text-[11.5px] tabular-nums", months[i].current ? "font-semibold text-snow" : "text-snow/55")}>
                          {total ? kilo(total) : "–"}
                        </span>
                        <div className={cn("flex h-[calc(100%-28px)] w-full max-w-11 flex-col justify-end gap-[2px] transition-opacity", hover !== null && hover !== i && "opacity-55")}>
                          {t.pipeline > 0 && <div className="rounded-[4px]" style={{ height: h(t.pipeline), background: PIPELINE }} />}
                          {withRenewal && t.renewal > 0 && <div className="rounded-[4px]" style={{ height: h(t.renewal), background: HATCH }} />}
                          {t.open > 0 && <div className="rounded-[4px]" style={{ height: h(t.open), background: FIRM }} />}
                          {t.billed > 0 && <div className="rounded-[4px] opacity-85" style={{ height: h(t.billed), background: BILLED }} />}
                        </div>
                      </div>
                    );
                  })}
                  <div />
                </div>

                {/* Kunden × Monate */}
                <table className="w-full table-fixed text-[13px]">
                  <colgroup>
                    <col className="w-[200px]" />
                    {months.map((m) => (
                      <col key={m.offset} />
                    ))}
                    <col className="w-24" />
                  </colgroup>
                  <thead>
                    <tr className="border-b border-snow/[0.08] text-[12px]">
                      <th className="py-2.5 text-left font-medium text-snow/50">Kunde</th>
                      {months.map((m) => (
                        <th key={m.offset} className={cn("px-1 py-2.5 text-center font-medium tabular-nums", m.current ? "font-semibold text-snow" : "text-snow/50")}>
                          {m.label}
                        </th>
                      ))}
                      <th className="py-2.5 pl-2 text-right font-medium text-snow/50">Summe</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rowsByCustomer.length === 0 && (
                      <tr>
                        <td colSpan={14} className="py-10 text-center text-snow/45">
                          Keine Retainer im Zeitraum
                        </td>
                      </tr>
                    )}
                    {rowsByCustomer.map((row) => {
                      const values = row.cells.map((c) => c.firm + (withRenewal ? c.renewal : 0));
                      return (
                        <tr
                          key={row.id}
                          onClick={() => showCustomer(row.name)}
                          title="Verträge dieses Kunden anzeigen"
                          className="cursor-pointer border-b border-snow/[0.05] hover:bg-snow/[0.03]"
                        >
                          <td className="py-2.5 pr-3">
                            <span className="block truncate font-semibold">{row.name}</span>
                            <span
                              className={cn("block truncate text-[11.5px]", !row.status.warn && "text-snow/45")}
                              style={row.status.warn ? { color: accentText(PIPELINE_ACCENT) } : undefined}
                            >
                              {row.status.text}
                            </span>
                          </td>
                          {row.cells.map((cell, i) => {
                            const value = values[i];
                            const renewalOnly = value > 0 && cell.firm === 0;
                            const adjusted = i > 0 && values[i - 1] > 0 && value > 0 && value !== values[i - 1];
                            return (
                              <td
                                key={months[i].offset}
                                className={cn(
                                  "relative px-1 py-2.5 text-center tabular-nums",
                                  months[i].current && "bg-snow/[0.025]",
                                  !value ? "text-snow/30" : months[i].past ? "text-snow/55" : "text-snow/85",
                                  renewalOnly && "italic"
                                )}
                              >
                                {adjusted && (
                                  <span className="mr-1 inline-block h-1.5 w-1.5 -translate-y-px rounded-full align-middle" style={{ background: ADJUSTED }} title="Betrag angepasst" />
                                )}
                                {value ? plain(value) : "–"}
                                {cell.ends && (
                                  <span className="absolute top-1.5 right-0 bottom-1.5 w-[2px] rounded-full" style={{ background: CONTRACT_END }} title="Laufzeitende" />
                                )}
                              </td>
                            );
                          })}
                          <td className="py-2.5 pl-2 text-right font-medium tabular-nums">{plain(values.reduce((s, v) => s + v, 0))}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                  <tfoot>
                    <tr className="border-t border-snow/[0.12] font-semibold">
                      <td className="py-3">Summe</td>
                      {totals.map((t, i) => {
                        const value = t.firm + (withRenewal ? t.renewal : 0);
                        return (
                          <td key={months[i].offset} className={cn("px-1 py-3 text-center tabular-nums", months[i].current && "bg-snow/[0.025]")}>
                            {value ? plain(value) : "–"}
                          </td>
                        );
                      })}
                      <td className="py-3 pl-2 text-right tabular-nums">{plain(sumFirm + (withRenewal ? sumRenewal : 0))}</td>
                    </tr>
                    <tr className="text-[12.5px] text-snow/55">
                      <td className="py-2">+ Pipeline gewichtet</td>
                      {totals.map((t, i) => (
                        <td key={months[i].offset} className={cn("px-1 py-2 text-center italic tabular-nums", months[i].current && "bg-snow/[0.025]")}>
                          {t.pipeline ? plain(t.pipeline) : "–"}
                        </td>
                      ))}
                      <td className="py-2 pl-2 text-right italic tabular-nums">{plain(sumPipeline)}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>

            <ul className="mt-5 flex flex-wrap items-center gap-x-5 gap-y-2 border-t border-snow/[0.06] pt-4 text-[12px] text-snow/60">
              <li className="flex items-center gap-2">
                <LegendSwatch style={{ background: BILLED }} className="opacity-85" /> Abgerechnet
              </li>
              <li className="flex items-center gap-2">
                <LegendSwatch style={{ background: FIRM }} /> Fest
              </li>
              <li className="flex items-center gap-2">
                <LegendSwatch style={{ background: HATCH }} /> Verlängerung <span className="text-snow/40 italic">(kursiv)</span>
              </li>
              <li className="flex items-center gap-2">
                <LegendSwatch style={{ background: PIPELINE }} /> Pipeline gewichtet
              </li>
              <li className="flex items-center gap-2">
                <span className="h-1.5 w-1.5 rounded-full" style={{ background: ADJUSTED }} aria-hidden /> Angepasst
              </li>
              <li className="flex items-center gap-2">
                <span className="h-3.5 w-[2px] rounded-full" style={{ background: CONTRACT_END }} aria-hidden /> Laufzeitende
              </li>
              <li className="ml-auto text-snow/40">Pipeline: Neuer Lead 10 %, Erstgespräch 30 %, Angebot 60 % des Monatswerts</li>
            </ul>
          </section>

          {/* Verträge (Retainer) mit Kennzahlen und Bearbeitung */}
          <section id="vertraege" className={cn(PANEL_CLASS, "mt-4 scroll-mt-4")}>
            <header className="flex flex-wrap items-center gap-3 px-5 pt-5 pb-4">
              <h2 className="mr-auto text-[16px] font-semibold">Verträge</h2>
              <SearchPill value={query} onChange={setQuery} label="Retainer durchsuchen" className="w-52 lg:w-64" />
              <Select value={status} onChange={(e) => setStatus(e.target.value)} className="h-10 w-auto rounded-full" aria-label="Status">
                <option value="">Alle Status</option>
                {RETAINER_STATUS.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.label}
                  </option>
                ))}
              </Select>
            </header>
            <div className="grid grid-cols-2 gap-2 px-5 pb-4 lg:grid-cols-4">
              <StatChip label="ARR" value={euro(current.mrr * 12)} />
              <StatChip label="Aktive Retainer" value={`${current.active.length} · ${new Set(current.active.map((r) => r.customer_id)).size} Kund*innen`} />
              <StatChip label="Ø € pro Stunde" value={rate ? `${euro(rate)} · ${num(current.hours)} Std.` : "–"} />
              <StatChip label="Auslastung" value={<span className={cn(utilisation > 1 && "text-error")}>{capacity ? percent(utilisation) : "–"}</span>}>
                <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-snow/10" aria-hidden>
                  <div
                    className={cn("h-full rounded-full", utilisation > 1 ? "bg-error" : "bg-success")}
                    style={{
                      width: `${Math.min(100, utilisation * 100)}%`,
                      ...(utilisation > 0.85 && utilisation <= 1 && { background: accentText("#fab219") }),
                    }}
                  />
                </div>
                <CapacityEditor hours={capacity} />
              </StatChip>
            </div>
            {rows.length === 0 ? (
              <Empty
                title={all.length ? "Keine Treffer" : "Noch keine Retainer"}
                text={all.length ? undefined : "Lege Retainer an, um MRR und Auslastung zu sehen."}
              />
            ) : (
              <>
                {/* Desktop-Tabelle */}
                <table className="hidden w-full border-t border-snow/[0.06] text-[13px] md:table">
                  <thead>
                    <tr className="border-b border-snow/[0.08] text-left text-[12px] text-snow/50">
                      <th className="px-5 py-2.5 font-medium">Kunde</th>
                      <th className="px-3 py-2.5 font-medium">Leistung</th>
                      <th className="px-3 py-2.5 text-right font-medium">€/Monat</th>
                      <th className="px-3 py-2.5 text-right font-medium">Std./Monat</th>
                      <th className="px-3 py-2.5 text-right font-medium">€/Std.</th>
                      <th className="px-3 py-2.5 font-medium">Start</th>
                      <th className="px-3 py-2.5 font-medium">Ende</th>
                      <th className="px-3 py-2.5 font-medium">Status</th>
                      <th className="w-20 px-3 py-2.5" />
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((r) => {
                      const running = countsInMonth(r, start, end);
                      return (
                        <tr
                          key={r.id}
                          onClick={() => setEditing(r)}
                          className={cn("cursor-pointer border-b border-snow/[0.05] last:border-0 hover:bg-snow/[0.03]", !running && "text-snow/50")}
                        >
                          <td className="px-5 py-2.5 font-semibold">{customerName.get(r.customer_id) ?? "–"}</td>
                          <td className="px-3 py-2.5">
                            {r.title}
                            {r.article_id && articleName.get(r.article_id) !== r.title && (
                              <span className="block text-[12px] text-snow/45">{articleName.get(r.article_id)}</span>
                            )}
                          </td>
                          <td className="px-3 py-2.5 text-right tabular-nums">{euro(r.monthly_fee)}</td>
                          <td className="px-3 py-2.5 text-right tabular-nums">{num(r.hours_per_month)}</td>
                          <td className="px-3 py-2.5 text-right tabular-nums">{r.hours_per_month > 0 ? euro(r.monthly_fee / r.hours_per_month) : "–"}</td>
                          <td className="px-3 py-2.5 tabular-nums">{formatDate(r.start_date)}</td>
                          <td className="px-3 py-2.5 tabular-nums">
                            {r.end_date ? formatDate(r.end_date) : <span style={{ color: accentText(PIPELINE_ACCENT) }}>unbefristet</span>}
                          </td>
                          <td className="px-3 py-2.5">
                            <RetainerStatus status={r.status} />
                          </td>
                          <td className="px-3 py-1.5" onClick={(e) => e.stopPropagation()}>
                            <div className="flex justify-end">
                              <IconButton label="Bearbeiten" onClick={() => setEditing(r)}>
                                <Pencil className="h-4 w-4" />
                              </IconButton>
                              <IconButton label="Löschen" onClick={() => setRemoving(r)}>
                                <Trash2 className="h-4 w-4" />
                              </IconButton>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
                {/* Mobil: Liste */}
                <ul className="divide-y divide-snow/[0.06] border-t border-snow/[0.06] md:hidden">
                  {rows.map((r) => (
                    <li key={r.id}>
                      <button type="button" onClick={() => setEditing(r)} className="flex w-full items-start gap-3 px-5 py-3 text-left">
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-[14px] font-semibold">{customerName.get(r.customer_id) ?? "–"}</span>
                          <span className="block truncate text-[12px] text-snow/55">{r.title}</span>
                          <span className="mt-1 block text-[12px] text-snow/45">
                            seit {formatDate(r.start_date)}
                            {r.end_date && ` · bis ${formatDate(r.end_date)}`}
                          </span>
                        </span>
                        <span className="shrink-0 text-right">
                          <span className="block text-[14px] font-medium tabular-nums">{euro(r.monthly_fee)}</span>
                          <span className="block text-[12px] text-snow/45">{num(r.hours_per_month)} Std.</span>
                          <span className="mt-1 block">
                            <RetainerStatus status={r.status} />
                          </span>
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              </>
            )}
          </section>

          <ChartCard
            className="mt-4 rounded-3xl border-snow/[0.07] p-5 shadow-[0_4px_18px_var(--shadow-color)]"
            title="Gebuchte Stunden pro Monat"
            subtitle={`Linie = Teamkapazität (${num(capacity)} Std.)`}
            table={{
              head: ["Monat", "Gebucht", "Kapazität", "Auslastung"],
              rows: months.map((m) => {
                const hours = monthTotals(all, m.offset).hours;
                return [m.long, `${num(hours)} Std.`, `${num(capacity)} Std.`, capacity ? percent(hours / capacity) : "–"];
              }),
            }}
          >
            <ColumnChart
              ariaLabel="Gebuchte Stunden pro Monat im Vergleich zur Teamkapazität"
              labels={months.map((m) => m.label)}
              tooltipLabels={months.map((m) => m.long)}
              series={[{ key: "hours", label: "Std. gebucht", color: SERIES_1 }]}
              data={months.map((m) => ({ hours: monthTotals(all, m.offset).hours }))}
              format={(v) => `${num(v)} Std.`}
              reference={capacity ? { value: capacity, label: "Kapazität" } : undefined}
            />
          </ChartCard>
        </div>
      )}

      <RetainerDialog open={editing !== null} onClose={() => setEditing(null)} retainer={editing === "new" ? null : editing} />
      <Dialog
        open={!!removing}
        onClose={() => setRemoving(null)}
        title="Retainer löschen?"
        footer={
          <>
            <Button variant="ghost" onClick={() => setRemoving(null)}>
              Abbrechen
            </Button>
            <Button variant="danger" onClick={remove} loading={busy} loadingText="Wird gelöscht …">
              Löschen
            </Button>
          </>
        }
      >
        <p className="text-sm text-snow/60">
          {removing?.title} für {removing && customerName.get(removing.customer_id)} wird entfernt. Für beendete Verträge besser ein Enddatum setzen, dann bleibt der MRR-Verlauf richtig.
        </p>
      </Dialog>
    </div>
  );
}

function TooltipLine({ swatch, label, value }: { swatch: React.CSSProperties; label: string; value: number }) {
  return (
    <p className="flex items-center gap-2 py-0.5">
      <LegendSwatch style={swatch} />
      <span className="flex-1">{label}</span>
      <span className="font-medium text-snow tabular-nums">{euro(value)}</span>
    </p>
  );
}
