"use client";

import { useEffect, useMemo, useState } from "react";
import { Check, Pencil, Plus, Search, Trash2 } from "lucide-react";
import { api } from "@/lib/api";
import { cn } from "@/lib/cn";
import { accentText } from "@/lib/theme";
import { createRow, deleteRow, mutate, updateRow, useResource, useRows } from "@/lib/data";
import { euro, formatDate, isoDate, num, percent } from "@/lib/format";
import type { Article, Customer, Retainer, Settings } from "@/lib/sales/types";
import { Badge, Button, Dialog, Empty, Field, IconButton, Input, Select, Spinner, Textarea, useToast } from "@/components/ui";
import { PageBar } from "./shell";
import { ChartCard } from "./charts/chart-card";
import { ColumnChart, LineChart } from "./charts/charts";
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

function Kpi({ label, value, note, children }: { label: string; value: React.ReactNode; note?: React.ReactNode; children?: React.ReactNode }) {
  return (
    <div className="min-w-0 rounded-2xl border border-snow/[0.06] bg-surface px-4 py-3">
      <p className="text-[12px] text-snow/55">{label}</p>
      <p className="mt-1 truncate text-[22px] font-semibold tracking-tight">{value}</p>
      {note && <p className="mt-0.5 truncate text-[12px] text-snow/45">{note}</p>}
      {children}
    </div>
  );
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

export function OrderBook() {
  const { data: retainers, loading, error } = useRows<Retainer>("retainers");
  const { data: customers } = useRows<Customer>("customers");
  const { data: articles } = useRows<Article>("articles");
  const { data: settings } = useResource<Settings>("/api/sales/settings");
  const toast = useToast();
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("");
  const [editing, setEditing] = useState<Retainer | null | "new">(null);
  const [removing, setRemoving] = useState<Retainer | null>(null);
  const [busy, setBusy] = useState(false);

  const customerName = useMemo(() => new Map((customers ?? []).map((c) => [c.id, c.name])), [customers]);
  const articleName = useMemo(() => new Map((articles ?? []).map((a) => [a.id, a.name])), [articles]);
  const capacity = settings?.capacity.team_hours_per_month ?? 0;

  const all = useMemo(() => retainers ?? [], [retainers]);
  const current = monthTotals(all);
  const rate = current.hours > 0 ? current.mrr / current.hours : 0;
  const utilisation = capacity > 0 ? current.hours / capacity : 0;

  // 12 Monate: 2 zurück, aktueller, 9 voraus
  const months = useMemo(
    () =>
      Array.from({ length: 12 }, (_, i) => {
        const offset = i - 2;
        const totals = monthTotals(all, offset);
        return { offset, short: monthLabel(offset), long: monthLabel(offset, "long"), ...totals };
      }),
    [all]
  );

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

  const { start, end } = monthRange(0);

  return (
    <div className="flex h-full flex-col">
      <PageBar title="Auftragsbuch" meta={retainers && `${current.active.length} aktive Retainer`}>
        <div className="relative">
          <Search className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-snow/40" />
          <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Suchen" aria-label="Retainer durchsuchen" className="h-9 w-32 pl-9 sm:w-40 lg:w-56" />
        </div>
        <Select value={status} onChange={(e) => setStatus(e.target.value)} className="h-9 w-auto" aria-label="Status">
          <option value="">Alle Status</option>
          {RETAINER_STATUS.map((s) => (
            <option key={s.id} value={s.id}>
              {s.label}
            </option>
          ))}
        </Select>
        <Button variant="primary" size="sm" className="h-9" icon={<Plus className="h-4 w-4" />} onClick={() => setEditing("new")}>
          <span className="sr-only sm:not-sr-only">Neuer Retainer</span>
        </Button>
      </PageBar>

      {error ? (
        <Empty title="Auftragsbuch konnte nicht geladen werden" text={error.message} />
      ) : loading ? (
        <div className="grid flex-1 place-items-center">
          <Spinner />
        </div>
      ) : (
        <div className="min-h-0 flex-1 overflow-y-auto p-3 md:p-4">
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
            <Kpi label="MRR" value={euro(current.mrr)} note={monthLabel(0, "long")} />
            <Kpi label="ARR" value={euro(current.mrr * 12)} note="MRR × 12" />
            <Kpi label="Aktive Retainer" value={current.active.length} note={`${new Set(current.active.map((r) => r.customer_id)).size} Kund*innen`} />
            <Kpi label="Ø € pro Stunde" value={rate ? euro(rate) : "–"} note={`${num(current.hours)} Std. gebucht`} />
            <Kpi
              label="Auslastung"
              value={
                <span className={cn(utilisation > 1 && "text-error")}>{capacity ? percent(utilisation) : "–"}</span>
              }
            >
              <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-snow/10" aria-hidden>
                <div
                  className={cn("h-full rounded-full", utilisation > 1 ? "bg-error" : "bg-success")}
                  style={{
                    width: `${Math.min(100, utilisation * 100)}%`,
                    ...(utilisation > 0.85 && utilisation <= 1 && { background: accentText("#fab219") }),
                  }}
                />
              </div>
              <CapacityEditor hours={capacity} />
            </Kpi>
          </div>

          <div className="mt-3 grid gap-3 xl:grid-cols-2">
            <ChartCard
              title="Gebuchte Stunden pro Monat"
              subtitle={`Linie = Teamkapazität (${num(capacity)} Std.)`}
              table={{
                head: ["Monat", "Gebucht", "Kapazität", "Auslastung"],
                rows: months.map((m) => [m.long, `${num(m.hours)} Std.`, `${num(capacity)} Std.`, capacity ? percent(m.hours / capacity) : "–"]),
              }}
            >
              <ColumnChart
                ariaLabel="Gebuchte Stunden pro Monat im Vergleich zur Teamkapazität"
                labels={months.map((m) => m.short)}
                tooltipLabels={months.map((m) => m.long)}
                series={[{ key: "hours", label: "Std. gebucht", color: SERIES_1 }]}
                data={months.map((m) => ({ hours: m.hours }))}
                format={(v) => `${num(v)} Std.`}
                reference={capacity ? { value: capacity, label: "Kapazität" } : undefined}
              />
            </ChartCard>
            <ChartCard
              title="MRR pro Monat"
              subtitle="Laufende Retainer, inkl. bekannter Starts und Enden"
              table={{ head: ["Monat", "MRR"], rows: months.map((m) => [m.long, euro(m.mrr)]) }}
            >
              <LineChart
                ariaLabel="Monatlich wiederkehrender Umsatz der nächsten Monate"
                labels={months.map((m) => m.short)}
                tooltipLabels={months.map((m) => m.long)}
                values={months.map((m) => m.mrr)}
                color={SERIES_1}
                label="MRR"
                format={euro}
              />
            </ChartCard>
          </div>

          <section className="mt-3 overflow-hidden rounded-2xl border border-snow/[0.06] bg-surface">
            {rows.length === 0 ? (
              <Empty
                title={all.length ? "Keine Treffer" : "Noch keine Retainer"}
                text={all.length ? undefined : "Lege Retainer an, um MRR und Auslastung zu sehen."}
              />
            ) : (
              <>
                {/* Desktop-Tabelle */}
                <table className="hidden w-full text-[13px] md:table">
                  <thead>
                    <tr className="border-b border-snow/[0.08] text-left text-[12px] text-snow/50">
                      <th className="px-4 py-2.5 font-medium">Kunde</th>
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
                          className={cn("cursor-pointer border-b border-snow/[0.05] last:border-0 hover:bg-snow/[0.04]", !running && "text-snow/50")}
                        >
                          <td className="px-4 py-2.5 font-medium">{customerName.get(r.customer_id) ?? "–"}</td>
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
                          <td className="px-3 py-2.5 tabular-nums">{r.end_date ? formatDate(r.end_date) : "unbefristet"}</td>
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
                <ul className="divide-y divide-snow/[0.06] md:hidden">
                  {rows.map((r) => (
                    <li key={r.id}>
                      <button type="button" onClick={() => setEditing(r)} className="flex w-full items-start gap-3 px-4 py-3 text-left">
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-[14px] font-medium">{customerName.get(r.customer_id) ?? "–"}</span>
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
