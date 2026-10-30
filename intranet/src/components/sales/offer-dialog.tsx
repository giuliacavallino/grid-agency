"use client";

import { useMemo, useState } from "react";
import { Check, ChevronDown, PenLine, Plus, Send, Trash2 } from "lucide-react";
import { api } from "@/lib/api";
import { cn } from "@/lib/cn";
import { useAuth } from "@/lib/auth";
import { billingNote, DEFAULT_PURPOSE } from "@/lib/contract";
import { mutate, revalidate, useResource, useRows } from "@/lib/data";
import { euro } from "@/lib/format";
import { isMonthlyUnit, monthlyUnitFor, todayBerlin, UNIT_LABEL } from "@/lib/billing";
import type { Article, Customer, Lead, Settings } from "@/lib/sales/types";
import { Button, Dialog, Field, Input, Select, Spinner, Textarea, useToast } from "@/components/ui";
import { SignaturePad } from "@/components/signature-pad";

// Nach dem Erstgespräch: Parameter eintragen, „Abschicken“ – Kunde wird
// angelegt, das Angebot festgeschrieben und mit Agenturvertrag und
// SEPA-Mandat als Mappe von hello@ zur Unterschrift verschickt.

// Positionen: Setup und Strategie einmalig, Betreuung monatlich. Die
// Strategie rechnet sich je Monat der Mindestlaufzeit; zählbare Leistungen
// (z. B. Google-Accounts) bekommen eine Anzahl.
const GROUPS = ["Setup", "Strategie", "Betreuung", "Weitere"] as const;
const groupOf = (a: Article) => (GROUPS as readonly string[]).includes(a.category ?? "") ? (a.category as (typeof GROUPS)[number]) : "Weitere";

type Line = {
  key: string;
  article_id: string | null;
  description: string;
  quantity: string;
  unit: string;
  unit_price_net: string;
  vat_percent: number;
  /** Menge = Mindestlaufzeit (Strategie) */
  term: boolean;
  count_label: string | null;
  open: boolean;
};

const num = (value: string) => Number(value.replace(",", ".")) || 0;
const titleOf = (line: Line) => line.description.split("\n")[0].trim();
const newLine = (): Line => ({
  key: crypto.randomUUID(),
  article_id: null,
  description: "",
  quantity: "1",
  unit: "Monat",
  unit_price_net: "",
  vat_percent: 19,
  term: false,
  count_label: null,
  open: true,
});

function lineFor(a: Article): Line {
  return {
    ...newLine(),
    article_id: a.id,
    description: [a.name, a.description].filter(Boolean).join("\n"),
    unit: a.unit === "monatlich" ? monthlyUnitFor(a.count_label) : (UNIT_LABEL[a.unit] ?? "Pauschal"),
    unit_price_net: String(a.price),
    vat_percent: a.vat_percent ?? 19,
    term: a.unit === "laufzeit",
    count_label: a.count_label ?? null,
    open: false,
  };
}

function firstOfNextMonth() {
  const [y, m] = todayBerlin().split("-").map(Number);
  return new Date(Date.UTC(y, m, 1)).toISOString().slice(0, 10);
}

export function OfferDialog({ lead, onClose }: { lead: Lead; onClose: () => void }) {
  const toast = useToast();
  const { account } = useAuth();
  const { data: settings } = useResource<Settings>("/api/sales/settings");
  const { data: articles } = useRows<Article>("articles");
  const { data: customers } = useRows<Customer>("customers");
  const known = customers?.find((c) => c.id === lead.customer_id);
  const booked = lead.raw?.booking?.address;

  const [customer, setCustomer] = useState({
    name: known?.name ?? lead.company ?? lead.name,
    contact_name: known?.contact_name ?? lead.name,
    email: known?.billing_email ?? known?.email ?? lead.email ?? "",
    street: known?.street ?? [booked?.street, booked?.number].filter(Boolean).join(" "),
    zip: known?.zip ?? booked?.zip ?? "",
    city: known?.city ?? booked?.city ?? "",
  });
  const [lines, setLines] = useState<Line[]>([]);
  const [title, setTitle] = useState("Social Media Betreuung");
  const [intro, setIntro] = useState("");
  const [validDays, setValidDays] = useState("14");
  const [start, setStart] = useState(firstOfNextMonth());
  const [minTerm, setMinTerm] = useState("3");
  const [notice, setNotice] = useState("1");
  const [onceMode, setOnceMode] = useState<"unterschrift" | "vertragsbeginn" | "datum">("vertragsbeginn");
  const [onceDate, setOnceDate] = useState(todayBerlin());
  const [purpose, setPurpose] = useState(DEFAULT_PURPOSE);
  const [sepa, setSepa] = useState(true);
  const [signerName, setSignerName] = useState(lead.name);
  const [signerEmail, setSignerEmail] = useState(lead.email ?? "");
  const [drawn, setDrawn] = useState<string | null>(null);
  const [redraw, setRedraw] = useState(false);
  const [busy, setBusy] = useState(false);
  // Rückfragen statt Automatik: vorhandener Kunde? offenes Angebot ersetzen?
  const [customerChoice, setCustomerChoice] = useState<string | null>(null);
  const [replaceOpen, setReplaceOpen] = useState(false);
  // Ein Angebot ist (evtl.) noch unterwegs, egal in welcher Spalte der Lead steht
  const openOffer = !!lead.offer_id && lead.stage !== "gewonnen";

  // Passende Kunden (gleiche E-Mail oder gleicher Name), wenn der Lead noch keinen hat
  const matches = useMemo(() => {
    if (lead.customer_id) return [];
    const name = customer.name.trim().toLowerCase();
    const email = (customer.email || lead.email || "").trim().toLowerCase();
    return (customers ?? []).filter(
      (c) => (name && c.name.trim().toLowerCase() === name) || (email && [c.email, c.billing_email].some((e) => e?.trim().toLowerCase() === email))
    );
  }, [customers, customer.name, customer.email, lead.customer_id, lead.email]);
  const choice = customerChoice ?? matches[0]?.id ?? null;

  const groups = useMemo(() => {
    const active = (articles ?? []).filter((a) => a.active);
    return GROUPS.map((g) => ({ name: g, items: active.filter((a) => groupOf(a) === g).sort((a, b) => a.price - b.price) })).filter((g) => g.items.length);
  }, [articles]);
  const saved = settings?.grid_signature ?? null;
  const useSaved = !!saved && !redraw;
  const signature = useSaved ? saved.image : drawn;
  const gridSigner = (useSaved ? saved.signer : account?.name) ?? "";
  const creditor = settings?.billing.company.creditor_id;
  const term = Math.max(0, Math.round(num(minTerm)));
  const qty = (l: Line) => (l.term ? term : num(l.quantity));
  const sum = (l: Line) => qty(l) * num(l.unit_price_net);
  const monthly = lines.filter((l) => isMonthlyUnit(l.unit)).reduce((s, l) => s + sum(l), 0);
  const once = lines.filter((l) => !isMonthlyUnit(l.unit)).reduce((s, l) => s + sum(l), 0);

  const onceBilling = onceMode === "datum" ? onceDate : onceMode;
  const note = billingNote({ start_date: start, once_billing: onceBilling }, { monthly: monthly > 0, once: once > 0 });

  const setLine = (key: string, patch: Partial<Line>) => setLines((ls) => ls.map((l) => (l.key === key ? { ...l, ...patch } : l)));

  /** Artikel an- oder abwählen; Betreuung gibt es nur einmal (Paketwechsel) */
  function toggle(a: Article) {
    setLines((ls) => {
      if (ls.some((l) => l.article_id === a.id)) return ls.filter((l) => l.article_id !== a.id);
      const replaced = groupOf(a) === "Betreuung" ? ls.filter((l) => !groups.find((g) => g.name === "Betreuung")?.items.some((b) => b.id === l.article_id)) : ls;
      return [...replaced, lineFor(a)];
    });
  }

  const ready =
    !!signature &&
    (!openOffer || replaceOpen) &&
    customer.name.trim() &&
    customer.street.trim() &&
    customer.zip.trim() &&
    customer.city.trim() &&
    signerName.trim() &&
    signerEmail.trim() &&
    term > 0 &&
    lines.some((l) => l.description.trim() && num(l.unit_price_net) > 0);

  async function send() {
    if (!signature) return toast("Bitte für GRID unterschreiben", "error");
    setBusy(true);
    try {
      if (!useSaved && drawn) {
        const result = await api<Settings>("/api/sales/settings", { method: "PUT", body: JSON.stringify({ grid_signature: { signer: gridSigner, image: drawn } }) });
        mutate<Settings>("/api/sales/settings", () => result);
      }
      await api(`/api/sales/pipeline/${lead.id}/angebot`, {
        method: "POST",
        body: JSON.stringify({
          customer,
          ...(matches.length ? (choice === "neu" ? { new_customer: true } : { customer_id: choice }) : {}),
          replace_open: openOffer && replaceOpen,
          title,
          intro,
          valid_days: Number(validDays) || 14,
          items: lines.map((l) => ({
            article_id: l.article_id,
            description: l.description,
            quantity: qty(l),
            unit: l.unit,
            unit_price_net: num(l.unit_price_net),
            vat_percent: l.vat_percent,
          })),
          terms: { purpose, start_date: start, min_term_months: Number(minTerm), notice_months: Number(notice), once_billing: onceBilling },
          sepa_required: sepa && !!creditor,
          signer_name: signerName,
          signer_email: signerEmail,
          grid_signer: gridSigner,
          grid_signature: signature,
        }),
      });
      revalidate("/api/sales/leads");
      revalidate("/api/sales/customers");
      revalidate("/api/sales/lead_activities");
      toast(`Angebot an ${signerEmail} verschickt`);
      onClose();
    } catch (e) {
      toast(e instanceof Error ? e.message : "Angebot konnte nicht verschickt werden", "error");
    }
    setBusy(false);
  }

  return (
    <Dialog
      open
      onClose={onClose}
      title={`Angebot für ${lead.company || lead.name}`}
      width="max-w-3xl"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Abbrechen
          </Button>
          <Button variant="primary" icon={<Send className="h-4 w-4" />} loading={busy} loadingText="Wird verschickt …" disabled={!ready || busy} onClick={send}>
            Abschicken
          </Button>
        </>
      }
    >
      {!settings ? (
        <Spinner />
      ) : (
        <div className="flex flex-col gap-6">
          <p className="text-[13px] text-snow/60">
            Angebot, Agenturvertrag{sepa && creditor ? " und SEPA-Mandat" : ""} gehen als Mappe von hello@ an den Kunden. Nach der Unterschrift springt der Lead
            auf „Kunde gewonnen“.
          </p>

          {openOffer && (
            <label className="flex items-start gap-3 rounded-2xl border border-error/30 bg-error/[0.06] p-3 text-[13px] text-snow/85">
              <input type="checkbox" checked={replaceOpen} onChange={(e) => setReplaceOpen(e.target.checked)} className="mt-0.5 h-4 w-4 shrink-0" />
              <span>
                Für diesen Lead ist schon ein Angebot unterwegs. Beim Abschicken wird es zurückgezogen; der alte Link zeigt dann „nicht mehr aktuell“.
              </span>
            </label>
          )}

          {matches.length > 0 && (
            <section className="flex flex-col gap-2 rounded-2xl border border-snow/12 bg-snow/[0.04] p-3">
              <p className="text-[13px] text-snow/80">Diesen Kunden gibt es schon. Welchen verwenden?</p>
              {matches.map((c) => (
                <label key={c.id} className="flex items-center gap-2.5 text-[13px]">
                  <input type="radio" name="kunde" checked={choice === c.id} onChange={() => setCustomerChoice(c.id)} className="h-4 w-4" />
                  {c.name}
                  {c.customer_number && <span className="text-snow/50">Nr. {c.customer_number}</span>}
                  {c.city && <span className="text-snow/50">· {c.city}</span>}
                </label>
              ))}
              <label className="flex items-center gap-2.5 text-[13px]">
                <input type="radio" name="kunde" checked={choice === "neu"} onChange={() => setCustomerChoice("neu")} className="h-4 w-4" />
                Neuen Kunden anlegen
              </label>
            </section>
          )}

          <section className="grid gap-3 sm:grid-cols-2">
            <h3 className="text-[12px] font-medium text-snow/50 sm:col-span-2">Kunde</h3>
            <Field label="Firma">{(id) => <Input id={id} value={customer.name} onChange={(e) => setCustomer({ ...customer, name: e.target.value })} />}</Field>
            <Field label="Ansprechpartner*in">
              {(id) => <Input id={id} value={customer.contact_name} onChange={(e) => setCustomer({ ...customer, contact_name: e.target.value })} />}
            </Field>
            <Field label="Straße" className="sm:col-span-2">
              {(id) => <Input id={id} value={customer.street} onChange={(e) => setCustomer({ ...customer, street: e.target.value })} autoComplete="off" />}
            </Field>
            <Field label="PLZ">{(id) => <Input id={id} value={customer.zip} onChange={(e) => setCustomer({ ...customer, zip: e.target.value })} inputMode="numeric" />}</Field>
            <Field label="Ort">{(id) => <Input id={id} value={customer.city} onChange={(e) => setCustomer({ ...customer, city: e.target.value })} />}</Field>
            <Field label="Rechnungs-E-Mail" className="sm:col-span-2">
              {(id) => <Input id={id} type="email" value={customer.email} onChange={(e) => setCustomer({ ...customer, email: e.target.value })} />}
            </Field>
          </section>

          <section className="grid gap-3 sm:grid-cols-3">
            <h3 className="text-[12px] font-medium text-snow/50 sm:col-span-3">Laufzeit</h3>
            <Field label="Vertragsbeginn">{(id) => <Input id={id} type="date" value={start} onChange={(e) => setStart(e.target.value)} />}</Field>
            <Field label="Mindestlaufzeit (Monate)">{(id) => <Input id={id} inputMode="numeric" value={minTerm} onChange={(e) => setMinTerm(e.target.value)} />}</Field>
            <Field label="Kündigungsfrist (Monate)">{(id) => <Input id={id} inputMode="numeric" value={notice} onChange={(e) => setNotice(e.target.value)} />}</Field>
          </section>

          <section className="flex flex-col gap-3">
            <h3 className="text-[12px] font-medium text-snow/50">Leistungen</h3>
            <div className="flex flex-col gap-2.5 rounded-2xl border border-snow/10 bg-snow/[0.03] p-3">
              {groups.map((g) => (
                <div key={g.name} className="grid gap-1.5 sm:grid-cols-[6.5rem_1fr] sm:items-start">
                  <p className="pt-1.5 text-[12px] text-snow/50">{g.name}</p>
                  <div className="flex flex-wrap gap-1.5">
                    {g.items.map((a) => {
                      const on = lines.some((l) => l.article_id === a.id);
                      return (
                        <button
                          key={a.id}
                          type="button"
                          aria-pressed={on}
                          onClick={() => toggle(a)}
                          className={cn(
                            "inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[13px] transition-colors",
                            on ? "border-snow bg-snow text-sky" : "border-snow/15 text-snow/85 hover:bg-snow/[0.08]"
                          )}
                        >
                          {on ? <Check className="h-3.5 w-3.5" /> : <Plus className="h-3.5 w-3.5 opacity-60" />}
                          {a.name}
                          <span className={cn("tabular-nums", on ? "text-sky/70" : "text-snow/45")}>
                            {euro(a.price)}
                            {a.unit === "monatlich" ? (a.count_label ? ` / ${a.count_label} / Mon.` : " / Mon.") : a.unit === "laufzeit" ? " × Laufzeit" : ""}
                          </span>
                        </button>
                      );
                    })}
                    {g.name === GROUPS[GROUPS.length - 1] && (
                      <button
                        type="button"
                        onClick={() => setLines((ls) => [...ls, newLine()])}
                        className="inline-flex items-center gap-1.5 rounded-full border border-dashed border-snow/20 px-3 py-1.5 text-[13px] text-snow/70 hover:bg-snow/[0.08]"
                      >
                        <Plus className="h-3.5 w-3.5" /> Freie Position
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>

            {lines.length === 0 ? (
              <p className="rounded-2xl border border-dashed border-snow/15 p-4 text-center text-[13px] text-snow/50">Oben Leistungen auswählen</p>
            ) : (
              <ul className="flex flex-col divide-y divide-snow/[0.08] rounded-2xl border border-snow/10 bg-ink/40">
                {lines.map((line) => {
                  const perMonth = isMonthlyUnit(line.unit);
                  return (
                    <li key={line.key} className="flex flex-col gap-2 p-3">
                      <div className="flex flex-wrap items-center gap-2">
                        <button
                          type="button"
                          onClick={() => setLine(line.key, { open: !line.open })}
                          aria-expanded={line.open}
                          className="flex min-w-0 flex-1 items-center gap-1.5 text-left text-[14px] font-medium"
                        >
                          <ChevronDown className={cn("h-4 w-4 shrink-0 text-snow/50 transition-transform", line.open && "rotate-180")} />
                          <span className="truncate">{titleOf(line) || "Neue Position"}</span>
                          <span className="shrink-0 text-[12px] font-normal text-snow/45">
                            {line.term ? "einmalig" : perMonth ? "monatlich" : "einmalig"}
                          </span>
                        </button>
                        <div className="flex items-center gap-1.5 text-[13px] text-snow/60 tabular-nums">
                          {line.term ? (
                            <span className="px-1">{term} Monate ×</span>
                          ) : (
                            <>
                              <Input
                                value={line.quantity}
                                onChange={(e) => setLine(line.key, { quantity: e.target.value })}
                                inputMode="decimal"
                                aria-label={line.count_label ? `Anzahl ${line.count_label}s` : "Menge"}
                                className="h-8 w-14 text-right"
                              />
                              <span>{line.count_label ? `${line.count_label}s ×` : "×"}</span>
                            </>
                          )}
                          <Input
                            value={line.unit_price_net}
                            onChange={(e) => setLine(line.key, { unit_price_net: e.target.value })}
                            inputMode="decimal"
                            placeholder="Preis"
                            aria-label="Preis netto"
                            className="h-8 w-24 text-right"
                          />
                          <span className="w-28 text-right text-snow">
                            {euro(sum(line))}
                            {perMonth && <span className="text-snow/50"> / Mon.</span>}
                          </span>
                          <Button
                            variant="ghost"
                            size="sm"
                            aria-label="Position entfernen"
                            icon={<Trash2 className="h-4 w-4" />}
                            className="w-8 px-0"
                            onClick={() => setLines((ls) => ls.filter((l) => l.key !== line.key))}
                          />
                        </div>
                      </div>
                      {line.open && (
                        <div className="flex flex-col gap-2 pl-5.5">
                          <Textarea
                            value={line.description}
                            onChange={(e) => setLine(line.key, { description: e.target.value })}
                            placeholder="Leistung (erste Zeile = Titel)"
                            aria-label="Leistung"
                            className="min-h-24 text-[13px]"
                          />
                          {!line.article_id && (
                            <Select value={line.unit} onChange={(e) => setLine(line.key, { unit: e.target.value })} aria-label="Einheit" className="h-9 w-40 text-[13px]">
                              {["Monat", "Pauschal", "Std.", "Tag", "Stück"].map((u) => (
                                <option key={u} value={u}>
                                  {u === "Monat" ? "monatlich" : u}
                                </option>
                              ))}
                            </Select>
                          )}
                        </div>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}

            <div className="grid grid-cols-3 gap-2 rounded-2xl border border-snow/10 bg-snow/[0.04] p-3 tabular-nums">
              <div>
                <p className="text-[12px] text-snow/50">Monatlich</p>
                <p className="text-[17px] font-semibold">{euro(monthly)}</p>
              </div>
              <div>
                <p className="text-[12px] text-snow/50">Einmalig</p>
                <p className="text-[17px] font-semibold">{euro(once)}</p>
              </div>
              <div>
                <p className="text-[12px] text-snow/50">Gesamt ({term} Monate)</p>
                <p className="text-[17px] font-semibold">{euro(monthly * term + once)}</p>
              </div>
              <p className="col-span-3 text-[12px] text-snow/40">alle Beträge netto</p>
            </div>

            {once > 0 && (
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="mr-1 text-[13px] text-snow/60">Einmalkosten berechnen</span>
                {(
                  [
                    ["unterschrift", "Bei Unterschrift"],
                    ["vertragsbeginn", "Zum Vertragsbeginn"],
                    ["datum", "Am Datum"],
                  ] as const
                ).map(([id, label]) => (
                  <button
                    key={id}
                    type="button"
                    aria-pressed={onceMode === id}
                    onClick={() => setOnceMode(id)}
                    className={cn(
                      "rounded-full border px-3 py-1.5 text-[13px] transition-colors",
                      onceMode === id ? "border-snow bg-snow text-sky" : "border-snow/15 text-snow/85 hover:bg-snow/[0.08]"
                    )}
                  >
                    {label}
                  </button>
                ))}
                {onceMode === "datum" && (
                  <Input type="date" value={onceDate} min={todayBerlin()} onChange={(e) => setOnceDate(e.target.value)} aria-label="Datum der Einmalrechnung" className="h-9 w-40" />
                )}
              </div>
            )}
            {note && <p className="text-[12px] leading-relaxed text-snow/50">Im Angebot: {note.replace(/^Abrechnung: /, "")}</p>}

            <div className="grid gap-3 sm:grid-cols-[1fr_8rem]">
              <Field label="Titel">{(id) => <Input id={id} value={title} onChange={(e) => setTitle(e.target.value)} />}</Field>
              <Field label="Gültig (Tage)">{(id) => <Input id={id} inputMode="numeric" value={validDays} onChange={(e) => setValidDays(e.target.value)} />}</Field>
            </div>
            <Field label="Einleitung (optional)">
              {(id) => <Textarea id={id} value={intro} onChange={(e) => setIntro(e.target.value)} placeholder="Standard: „vielen Dank für das gute Gespräch …“" className="min-h-14" />}
            </Field>
          </section>

          <section className="grid gap-3">
            <h3 className="text-[12px] font-medium text-snow/50">Vertrag</h3>
            <Field label="Ziel der Zusammenarbeit (Präambel)">
              {(id) => <Textarea id={id} value={purpose} onChange={(e) => setPurpose(e.target.value)} className="min-h-16" />}
            </Field>
            <label className="flex items-start gap-3 text-[14px]">
              <input type="checkbox" checked={sepa && !!creditor} disabled={!creditor} onChange={(e) => setSepa(e.target.checked)} className="mt-1 h-4 w-4" />
              <span>
                Zahlung per SEPA-Lastschrift (Mandat in der Mappe)
                {!creditor && <span className="block text-[12px] text-snow/50">Erst die Gläubiger-ID in Finance → Einstellungen eintragen.</span>}
              </span>
            </label>
          </section>

          <section className="grid gap-3 sm:grid-cols-2">
            <h3 className="text-[12px] font-medium text-snow/50 sm:col-span-2">Unterschrift</h3>
            <Field label="Unterschreibt für den Kunden">{(id) => <Input id={id} value={signerName} onChange={(e) => setSignerName(e.target.value)} />}</Field>
            <Field label="E-Mail">{(id) => <Input id={id} type="email" value={signerEmail} onChange={(e) => setSignerEmail(e.target.value)} />}</Field>
            <div className="sm:col-span-2">
              {useSaved ? (
                <div className="flex items-center gap-4 rounded-2xl border border-snow/10 bg-white p-3">
                  {/* eslint-disable-next-line @next/next/no-img-element -- data-URL der gespeicherten Unterschrift */}
                  <img src={saved.image} alt={`Unterschrift ${saved.signer}`} className="h-14 max-w-[60%] object-contain" />
                  <div className="flex-1 text-[13px] text-[#2b2926]">
                    GRID: {saved.signer}
                    <button type="button" onClick={() => setRedraw(true)} className="ml-3 inline-flex items-center gap-1 text-[#676159] underline">
                      <PenLine className="h-3.5 w-3.5" />
                      neu
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex flex-col gap-2">
                  <p className="text-[13px] text-snow/60">Unterschrift für GRID ({gridSigner}) – wird für künftige Angebote gespeichert</p>
                  <SignaturePad onChange={setDrawn} name={gridSigner} />
                </div>
              )}
            </div>
          </section>
        </div>
      )}
    </Dialog>
  );
}
