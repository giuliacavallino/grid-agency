"use client";

import { useMemo, useState } from "react";
import { ArrowDown, ArrowUp, Plus, Trash2, Type } from "lucide-react";
import { api } from "@/lib/api";
import { revalidate, useResource, useRows } from "@/lib/data";
import {
  DEFAULT_BILLING_SETTINGS,
  OFFER_TEXTS,
  computeTotals,
  lineNet,
  money,
  monthlyUnitFor,
  plain,
  todayBerlin,
  UNIT_LABEL,
  type BillingDetail,
  type DraftInput,
  type ItemInput,
} from "@/lib/billing";
import type { Article, Customer, Settings } from "@/lib/sales/types";
import { Button, Field, IconButton, Input, Select, Sheet, Spinner, Textarea, useToast } from "@/components/ui";

export const BILLING_URL = "/api/finance/ausgang";

type Kind = DraftInput["kind"];
export type EditorKind = Kind;

type Line = ItemInput & { key: string };

type Form = {
  customer_id: string;
  address: Record<"company_name" | "contact" | "street" | "zip_code" | "city" | "country", string>;
  recipient_email: string;
  document_date: string;
  payment_terms_days: string;
  service_from: string;
  service_to: string;
  title: string;
  intro: string;
  closing: string;
  lines: Line[];
  frequency: "MONTHLY" | "YEARLY" | "WEEKLY";
  interval: string;
  next_date: string;
  end_date: string;
  series_status: "RUNNING" | "PAUSE" | "STOP";
};

const RHYTHMS = [
  { id: "MONTHLY:1", label: "monatlich" },
  { id: "MONTHLY:3", label: "vierteljährlich" },
  { id: "MONTHLY:6", label: "halbjährlich" },
  { id: "YEARLY:1", label: "jährlich" },
  { id: "WEEKLY:1", label: "wöchentlich" },
];


let keySeq = 0;
const nextKey = () => `l${++keySeq}`;

const emptyLine = (kind: Line["kind"] = "position"): Line => ({
  key: nextKey(),
  kind,
  article_id: null,
  number: null,
  description: "",
  quantity: 1,
  unit: kind === "position" ? "Pauschal" : null,
  unit_price_net: 0,
  vat_percent: 19,
  discount: null,
  discount_type: null,
});

const num = (value: string) => {
  const parsed = Number(value.replace(/\./g, "").replace(",", "."));
  return Number.isFinite(parsed) ? parsed : 0;
};
const numText = (value: number | null | undefined) => (value === null || value === undefined ? "" : String(value).replace(".", ","));

function firstOfNextMonth() {
  const [y, m] = todayBerlin().split("-").map(Number);
  return new Date(Date.UTC(y, m, 1)).toISOString().slice(0, 10);
}

/** Gutschriften stehen mit negativen Preisen in der Datenbank, im Editor positiv */
function toForm(kind: Kind, doc: BillingDetail | null, settings: Settings["billing"]): Form {
  const sign = kind === "gutschrift" ? -1 : 1;
  const a = doc?.address ?? {};
  const r = doc?.recurring;
  return {
    customer_id: doc?.customer_id ?? "",
    address: {
      company_name: a.company_name ?? "",
      contact: [a.first_name, a.last_name].filter(Boolean).join(" ") || a.suffix_1 || "",
      street: a.street ?? "",
      zip_code: a.zip_code ?? "",
      city: a.city ?? "",
      country: a.country ?? "DE",
    },
    recipient_email: doc?.recipient_email ?? "",
    document_date: doc?.document_date ?? "",
    payment_terms_days: String(doc?.payment_terms_days ?? (kind === "angebot" ? 14 : settings.payment_terms_days)),
    service_from: doc?.service_from ?? "",
    service_to: doc?.service_to ?? "",
    title: doc?.title ?? "",
    intro: plain(doc?.intro ?? (kind === "angebot" ? OFFER_TEXTS.intro : settings.intro)),
    closing: plain(doc?.closing ?? (kind === "angebot" ? OFFER_TEXTS.closing : settings.closing)),
    lines: doc?.items.length
      ? doc.items.map((item) => ({ ...item, key: nextKey(), description: plain(item.description), unit_price_net: sign * item.unit_price_net }))
      : [emptyLine()],
    frequency: (r?.frequency as Form["frequency"]) ?? "MONTHLY",
    interval: String(r?.interval ?? 1),
    next_date: r?.next_date ?? firstOfNextMonth(),
    end_date: r?.end_date ?? "",
    series_status: r?.status === "PAUSE" || r?.status === "STOP" ? r.status : "RUNNING",
  };
}

const TITLES: Record<Kind, [string, string]> = {
  rechnung: ["Neue Rechnung", "Rechnung bearbeiten"],
  gutschrift: ["Neue Gutschrift", "Gutschrift bearbeiten"],
  serie: ["Neue Serienrechnung", "Serie bearbeiten"],
  angebot: ["Neues Angebot", "Angebot bearbeiten"],
};

/** Editor für Entwürfe (Rechnung, Gutschrift) und Serien. doc = null legt neu an. */
export function BillingEditor({
  open,
  kind,
  doc,
  onClose,
  onSaved,
}: {
  open: boolean;
  kind: Kind;
  doc: BillingDetail | null;
  onClose: () => void;
  onSaved: (doc: BillingDetail) => void;
}) {
  const { data: settings } = useResource<Settings>("/api/sales/settings");
  return (
    <Sheet open={open} onClose={onClose} width="max-w-3xl" title={TITLES[kind][doc ? 1 : 0]} subtitle={doc?.customer_name ?? undefined}>
      {open &&
        (settings ? (
          <EditorForm key={doc?.id ?? `neu-${kind}`} kind={kind} doc={doc} settings={settings.billing ?? DEFAULT_BILLING_SETTINGS} onClose={onClose} onSaved={onSaved} />
        ) : (
          <div className="grid h-40 place-items-center">
            <Spinner />
          </div>
        ))}
    </Sheet>
  );
}

function EditorForm({
  kind,
  doc,
  settings,
  onClose,
  onSaved,
}: {
  kind: Kind;
  doc: BillingDetail | null;
  settings: Settings["billing"];
  onClose: () => void;
  onSaved: (doc: BillingDetail) => void;
}) {
  const { data: customers } = useRows<Customer>("customers");
  const { data: articles } = useRows<Article>("articles");
  const toast = useToast();
  const [form, setForm] = useState<Form>(() => toForm(kind, doc, settings));
  const [saving, setSaving] = useState(false);
  const sign = kind === "gutschrift" ? -1 : 1;

  const set = <K extends keyof Form>(key: K, value: Form[K]) => setForm((f) => ({ ...f, [key]: value }));
  const setAddress = (key: keyof Form["address"], value: string) => setForm((f) => ({ ...f, address: { ...f.address, [key]: value } }));
  const setLine = (key: string, patch: Partial<Line>) => setForm((f) => ({ ...f, lines: f.lines.map((l) => (l.key === key ? { ...l, ...patch } : l)) }));
  const move = (index: number, by: number) =>
    setForm((f) => {
      const lines = [...f.lines];
      const [line] = lines.splice(index, 1);
      lines.splice(Math.max(0, Math.min(lines.length, index + by)), 0, line);
      return { ...f, lines };
    });

  const sortedCustomers = useMemo(() => [...(customers ?? [])].sort((a, b) => a.name.localeCompare(b.name, "de")), [customers]);
  const activeArticles = useMemo(() => (articles ?? []).filter((a) => a.active).sort((a, b) => a.name.localeCompare(b.name, "de")), [articles]);
  const totals = computeTotals(form.lines.map((l) => ({ ...l, unit_price_net: sign * l.unit_price_net })));

  function chooseCustomer(id: string) {
    const c = customers?.find((x) => x.id === id);
    setForm((f) => ({
      ...f,
      customer_id: id,
      address: c
        ? { company_name: c.name, contact: c.contact_name ?? "", street: c.street ?? "", zip_code: c.zip ?? "", city: c.city ?? "", country: c.country ?? "DE" }
        : f.address,
      recipient_email: c?.billing_email || c?.email || f.recipient_email,
      payment_terms_days: c?.payment_terms_days != null ? String(c.payment_terms_days) : f.payment_terms_days,
    }));
  }

  function chooseArticle(key: string, id: string) {
    const a = articles?.find((x) => x.id === id);
    if (!a) return;
    setLine(key, {
      article_id: a.id,
      number: a.number ?? null,
      description: [a.name, a.description].filter(Boolean).join("\n"),
      unit: a.unit === "monatlich" ? monthlyUnitFor(a.count_label) : (UNIT_LABEL[a.unit] ?? "Pauschal"),
      unit_price_net: Number(a.price),
      vat_percent: Number(a.vat_percent ?? 19),
    });
  }

  async function save(event: React.FormEvent) {
    event.preventDefault();
    if (!form.customer_id) return toast("Bitte einen Kunden wählen", "error");
    if (!form.lines.some((l) => l.kind === "position" && l.description?.trim())) return toast("Mindestens eine Position mit Beschreibung", "error");
    const [first, ...last] = form.address.contact.trim().split(/\s+/);
    const input: DraftInput = {
      kind,
      customer_id: form.customer_id,
      ref_document_id: doc?.ref_document_id ?? null,
      address: {
        company_name: form.address.company_name,
        first_name: first ?? "",
        last_name: last.join(" "),
        street: form.address.street,
        zip_code: form.address.zip_code,
        city: form.address.city,
        country: form.address.country || "DE",
      },
      recipient_email: form.recipient_email || null,
      document_date: form.document_date || null,
      payment_terms_days: Math.round(num(form.payment_terms_days)),
      service_from: form.service_from || null,
      service_to: form.service_to || null,
      title: form.title || null,
      intro: form.intro,
      closing: form.closing,
      items: form.lines
        .filter((l) => l.kind === "text" || l.description?.trim() || l.unit_price_net)
        .map(
          (l): ItemInput => ({
            kind: l.kind,
            article_id: l.article_id,
            number: l.number,
            description: l.description,
            quantity: l.quantity,
            unit: l.unit,
            unit_price_net: sign * Number(l.unit_price_net),
            vat_percent: l.vat_percent,
            discount: l.discount,
            discount_type: l.discount_type,
          })
        ),
      ...(kind === "serie"
        ? {
            recurring: {
              frequency: form.frequency,
              interval: Math.max(1, Math.round(num(form.interval))),
              next_date: form.next_date,
              end_date: form.end_date || null,
              status: form.series_status,
            },
          }
        : {}),
    };
    setSaving(true);
    try {
      const saved = doc
        ? await api<BillingDetail>(`${BILLING_URL}/${doc.id}`, { method: "PATCH", body: JSON.stringify(input) })
        : await api<BillingDetail>(BILLING_URL, { method: "POST", body: JSON.stringify(input) });
      revalidate(BILLING_URL);
      toast(doc ? "Gespeichert" : kind === "serie" ? "Serie angelegt" : "Entwurf angelegt");
      onSaved(saved);
    } catch (error) {
      toast(error instanceof Error ? error.message : "Speichern fehlgeschlagen", "error");
    }
    setSaving(false);
  }

  return (
    <form onSubmit={save} className="flex min-h-full flex-col">
      <div className="flex flex-1 flex-col gap-6 px-5 py-5">
        {/* Kunde und Anschrift */}
        <section className="grid gap-3 sm:grid-cols-2">
          <Field label="Kunde" className="sm:col-span-2">
            {(id) => (
              <Select id={id} value={form.customer_id} onChange={(e) => chooseCustomer(e.target.value)}>
                <option value="">Kunde wählen …</option>
                {sortedCustomers.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                    {c.customer_number ? ` (${c.customer_number})` : ""}
                  </option>
                ))}
              </Select>
            )}
          </Field>
          <Field label="Firma (Anschrift)">{(id) => <Input id={id} value={form.address.company_name} onChange={(e) => setAddress("company_name", e.target.value)} />}</Field>
          <Field label="z. Hd.">{(id) => <Input id={id} value={form.address.contact} onChange={(e) => setAddress("contact", e.target.value)} />}</Field>
          <Field label="Straße">{(id) => <Input id={id} value={form.address.street} onChange={(e) => setAddress("street", e.target.value)} />}</Field>
          <div className="grid grid-cols-[1fr_2fr_4rem] gap-2">
            <Field label="PLZ">{(id) => <Input id={id} value={form.address.zip_code} onChange={(e) => setAddress("zip_code", e.target.value)} />}</Field>
            <Field label="Ort">{(id) => <Input id={id} value={form.address.city} onChange={(e) => setAddress("city", e.target.value)} />}</Field>
            <Field label="Land">{(id) => <Input id={id} value={form.address.country} maxLength={2} onChange={(e) => setAddress("country", e.target.value.toUpperCase())} />}</Field>
          </div>
          <Field label="Versand an (E-Mail)" className="sm:col-span-2" hint={kind === "serie" ? "Jede Rechnung der Serie geht automatisch an diese Adresse." : undefined}>
            {(id) => <Input id={id} type="email" value={form.recipient_email} onChange={(e) => set("recipient_email", e.target.value)} placeholder="buchhaltung@kunde.de" />}
          </Field>
        </section>

        {/* Termine */}
        {kind === "serie" ? (
          <section className="grid gap-3 sm:grid-cols-4">
            <Field label="Rhythmus">
              {(id) => (
                <Select
                  id={id}
                  value={`${form.frequency}:${form.interval}`}
                  onChange={(e) => {
                    const [frequency, interval] = e.target.value.split(":");
                    setForm((f) => ({ ...f, frequency: frequency as Form["frequency"], interval }));
                  }}
                >
                  {RHYTHMS.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.label}
                    </option>
                  ))}
                </Select>
              )}
            </Field>
            <Field label="Nächste Rechnung">{(id) => <Input id={id} type="date" value={form.next_date} onChange={(e) => set("next_date", e.target.value)} required />}</Field>
            <Field label="Letzte Rechnung bis" hint="leer = unbefristet">{(id) => <Input id={id} type="date" value={form.end_date} onChange={(e) => set("end_date", e.target.value)} />}</Field>
            <Field label="Zahlungsziel (Tage)">{(id) => <Input id={id} inputMode="numeric" value={form.payment_terms_days} onChange={(e) => set("payment_terms_days", e.target.value)} />}</Field>
            <p className="text-xs text-snow/45 sm:col-span-4">
              Jede Rechnung wird am Termin festgeschrieben und verschickt. Der Leistungszeitraum ergibt sich aus dem Rhythmus; in Texten stehen {"{Monat}"} und {"{Zeitraum}"} für den jeweiligen Zeitraum.
            </p>
          </section>
        ) : (
          <section className="grid gap-3 sm:grid-cols-4">
            <Field label={kind === "rechnung" ? "Rechnungsdatum" : "Datum"} hint={kind === "angebot" ? "leer = beim Fertigstellen" : "leer = beim Festschreiben"}>
              {(id) => <Input id={id} type="date" value={form.document_date} onChange={(e) => set("document_date", e.target.value)} />}
            </Field>
            <Field label={kind === "angebot" ? "Gültig (Tage)" : "Zahlungsziel (Tage)"}>
              {(id) => <Input id={id} inputMode="numeric" value={form.payment_terms_days} onChange={(e) => set("payment_terms_days", e.target.value)} />}
            </Field>
            <Field label={kind === "angebot" ? "Leistungsbeginn" : "Leistung von"}>
              {(id) => <Input id={id} type="date" value={form.service_from} onChange={(e) => set("service_from", e.target.value)} />}
            </Field>
            {kind !== "angebot" && (
              <Field label="Leistung bis" hint="leer = Rechnungsdatum">
                {(id) => <Input id={id} type="date" value={form.service_to} onChange={(e) => set("service_to", e.target.value)} />}
              </Field>
            )}
          </section>
        )}

        <section className="flex flex-col gap-3">
          <Field label="Betreff (optional)">{(id) => <Input id={id} value={form.title} onChange={(e) => set("title", e.target.value)} placeholder="z. B. Social Media {Monat}" />}</Field>
          <Field label="Einleitung">{(id) => <Textarea id={id} value={form.intro} onChange={(e) => set("intro", e.target.value)} className="min-h-16" />}</Field>
        </section>

        {/* Positionen */}
        <section>
          <div className="mb-2 flex items-center justify-between">
            <h3 className="text-[12px] font-medium text-snow/50">Positionen{kind === "gutschrift" ? " (Beträge positiv eingeben, sie werden gutgeschrieben)" : ""}</h3>
          </div>
          <ul className="flex flex-col gap-2">
            {form.lines.map((line, index) => (
              <li key={line.key} className="rounded-2xl border border-snow/[0.1] bg-snow/[0.03] p-3">
                <div className="flex items-start gap-2">
                  <span className="mt-2.5 w-6 shrink-0 text-[11px] tracking-widest text-snow/40 tabular-nums">
                    {line.kind === "text" ? "T" : String(form.lines.slice(0, index + 1).filter((l) => l.kind === "position").length).padStart(2, "0")}
                  </span>
                  <div className="flex min-w-0 flex-1 flex-col gap-2">
                    {line.kind === "position" && activeArticles.length > 0 && (
                      <Select value={line.article_id ?? ""} onChange={(e) => chooseArticle(line.key, e.target.value)} aria-label="Artikel übernehmen" className="h-9 text-[13px]">
                        <option value="">Artikel übernehmen …</option>
                        {activeArticles.map((a) => (
                          <option key={a.id} value={a.id}>
                            {a.name} · {money(Number(a.price))}
                          </option>
                        ))}
                      </Select>
                    )}
                    <Textarea
                      value={line.description ?? ""}
                      onChange={(e) => setLine(line.key, { description: e.target.value })}
                      placeholder={line.kind === "text" ? "Hinweistext" : "Bezeichnung (erste Zeile fett), darunter Details"}
                      aria-label="Beschreibung"
                      className="min-h-16 text-[13px]"
                    />
                    {line.kind === "position" && (
                      <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
                        <Field label="Menge">{(id) => <Input id={id} inputMode="decimal" value={numText(line.quantity)} onChange={(e) => setLine(line.key, { quantity: num(e.target.value) })} className="h-9" />}</Field>
                        <Field label="Einheit">{(id) => <Input id={id} value={line.unit ?? ""} onChange={(e) => setLine(line.key, { unit: e.target.value })} className="h-9" />}</Field>
                        <Field label="Einzelpreis netto">
                          {(id) => <Input id={id} inputMode="decimal" value={numText(line.unit_price_net)} onChange={(e) => setLine(line.key, { unit_price_net: num(e.target.value) })} className="h-9" />}
                        </Field>
                        <Field label="Rabatt %">
                          {(id) => (
                            <Input
                              id={id}
                              inputMode="decimal"
                              value={numText(line.discount)}
                              onChange={(e) => setLine(line.key, { discount: e.target.value ? num(e.target.value) : null, discount_type: e.target.value ? "prozent" : null })}
                              className="h-9"
                            />
                          )}
                        </Field>
                        <Field label="USt %">
                          {(id) => (
                            <Select id={id} value={String(line.vat_percent)} onChange={(e) => setLine(line.key, { vat_percent: Number(e.target.value) })} className="h-9">
                              {[19, 7, 0].map((v) => (
                                <option key={v} value={v}>
                                  {v} %
                                </option>
                              ))}
                            </Select>
                          )}
                        </Field>
                      </div>
                    )}
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-1">
                    {line.kind === "position" && <span className="mt-2 text-[13px] font-medium tabular-nums">{money(lineNet(line))}</span>}
                    <div className="mt-1 flex">
                      <IconButton label="Nach oben" onClick={() => move(index, -1)} disabled={index === 0}>
                        <ArrowUp className="h-4 w-4" />
                      </IconButton>
                      <IconButton label="Nach unten" onClick={() => move(index, 1)} disabled={index === form.lines.length - 1}>
                        <ArrowDown className="h-4 w-4" />
                      </IconButton>
                      <IconButton label="Entfernen" onClick={() => set("lines", form.lines.filter((l) => l.key !== line.key))} disabled={form.lines.length === 1}>
                        <Trash2 className="h-4 w-4" />
                      </IconButton>
                    </div>
                  </div>
                </div>
              </li>
            ))}
          </ul>
          <div className="mt-2 flex gap-2">
            <Button size="sm" icon={<Plus className="h-4 w-4" />} onClick={() => set("lines", [...form.lines, emptyLine()])}>
              Position
            </Button>
            <Button size="sm" variant="ghost" icon={<Type className="h-4 w-4" />} onClick={() => set("lines", [...form.lines, emptyLine("text")])}>
              Textzeile
            </Button>
          </div>
        </section>

        <Field label="Schlusstext" hint="Platzhalter: {Fällig}, {Monat}, {Zeitraum}, {Firma}">
          {(id) => <Textarea id={id} value={form.closing} onChange={(e) => set("closing", e.target.value)} className="min-h-16" />}
        </Field>
      </div>

      {/* Summen und Speichern */}
      <footer className="sticky bottom-0 flex flex-wrap items-center gap-3 border-t border-snow/10 bg-panel/95 px-5 py-3 backdrop-blur">
        <dl className="flex min-w-0 flex-1 flex-wrap gap-x-5 gap-y-1 text-[13px]">
          <div className="hidden sm:block">
            <dt className="inline text-snow/50">Netto </dt>
            <dd className="inline tabular-nums">{money(sign * totals.net)}</dd>
          </div>
          <div className="hidden sm:block">
            <dt className="inline text-snow/50">USt </dt>
            <dd className="inline tabular-nums">{money(sign * totals.vat)}</dd>
          </div>
          <div>
            <dt className="inline text-snow/50">{kind === "gutschrift" ? "Gutschrift " : "Gesamt "}</dt>
            <dd className="inline font-medium tabular-nums">{money(sign * totals.gross)}</dd>
          </div>
        </dl>
        <Button variant="ghost" onClick={onClose}>
          Abbrechen
        </Button>
        <Button type="submit" variant="primary" loading={saving} loadingText="Wird gespeichert …">
          {doc ? "Speichern" : kind === "serie" ? "Serie anlegen" : "Entwurf anlegen"}
        </Button>
      </footer>
    </form>
  );
}
