"use client";

import { useMemo, useState } from "react";
import { PenLine, Plus, Send, Trash2 } from "lucide-react";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { DEFAULT_PURPOSE } from "@/lib/contract";
import { mutate, revalidate, useResource, useRows } from "@/lib/data";
import { euro } from "@/lib/format";
import { todayBerlin } from "@/lib/billing";
import type { Article, Customer, Lead, Settings } from "@/lib/sales/types";
import { Button, Dialog, Field, Input, Select, Spinner, Textarea, useToast } from "@/components/ui";
import { SignaturePad } from "@/components/signature-pad";

// Nach dem Erstgespräch: Parameter eintragen, „Abschicken“ – Kunde wird
// angelegt, das Angebot festgeschrieben und mit Agenturvertrag und
// SEPA-Mandat als Mappe von hello@ zur Unterschrift verschickt.

const UNIT_LABEL: Record<string, string> = { monatlich: "Monat", einmalig: "Pauschal", stunde: "Std.", tag: "Tag" };

type Line = { key: string; article_id: string | null; description: string; quantity: string; unit: string; unit_price_net: string; vat_percent: number };

const num = (value: string) => Number(value.replace(",", ".")) || 0;
const newLine = (): Line => ({ key: crypto.randomUUID(), article_id: null, description: "", quantity: "1", unit: "Monat", unit_price_net: "", vat_percent: 19 });

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
  const [lines, setLines] = useState<Line[]>(() => [{ ...newLine(), unit_price_net: lead.value ? String(lead.value) : "" }]);
  const [title, setTitle] = useState("Social Media Betreuung");
  const [intro, setIntro] = useState("");
  const [validDays, setValidDays] = useState("14");
  const [start, setStart] = useState(firstOfNextMonth());
  const [minTerm, setMinTerm] = useState("3");
  const [notice, setNotice] = useState("1");
  const [purpose, setPurpose] = useState(DEFAULT_PURPOSE);
  const [sepa, setSepa] = useState(true);
  const [signerName, setSignerName] = useState(lead.name);
  const [signerEmail, setSignerEmail] = useState(lead.email ?? "");
  const [drawn, setDrawn] = useState<string | null>(null);
  const [redraw, setRedraw] = useState(false);
  const [busy, setBusy] = useState(false);

  const activeArticles = useMemo(() => (articles ?? []).filter((a) => a.active).sort((a, b) => a.name.localeCompare(b.name, "de")), [articles]);
  const saved = settings?.grid_signature ?? null;
  const useSaved = !!saved && !redraw;
  const signature = useSaved ? saved.image : drawn;
  const gridSigner = (useSaved ? saved.signer : account?.name) ?? "";
  const creditor = settings?.billing.company.creditor_id;
  const monthly = lines.filter((l) => /monat/i.test(l.unit)).reduce((s, l) => s + num(l.quantity) * num(l.unit_price_net), 0);
  const once = lines.filter((l) => !/monat/i.test(l.unit)).reduce((s, l) => s + num(l.quantity) * num(l.unit_price_net), 0);

  const setLine = (key: string, patch: Partial<Line>) => setLines((ls) => ls.map((l) => (l.key === key ? { ...l, ...patch } : l)));

  function chooseArticle(key: string, id: string) {
    const a = activeArticles.find((x) => x.id === id);
    if (!a) return setLine(key, { article_id: null });
    setLine(key, {
      article_id: a.id,
      description: [a.name, a.description].filter(Boolean).join("\n"),
      unit: UNIT_LABEL[a.unit] ?? "Pauschal",
      unit_price_net: String(a.price),
      vat_percent: a.vat_percent ?? 19,
    });
  }

  const ready =
    !!signature &&
    customer.name.trim() &&
    customer.street.trim() &&
    customer.zip.trim() &&
    customer.city.trim() &&
    signerName.trim() &&
    signerEmail.trim() &&
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
          title,
          intro,
          valid_days: Number(validDays) || 14,
          items: lines.map((l) => ({
            article_id: l.article_id,
            description: l.description,
            quantity: num(l.quantity),
            unit: l.unit,
            unit_price_net: num(l.unit_price_net),
            vat_percent: l.vat_percent,
          })),
          terms: { purpose, start_date: start, min_term_months: Number(minTerm), notice_months: Number(notice) },
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
      width="max-w-2xl"
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

          <section className="flex flex-col gap-3">
            <h3 className="text-[12px] font-medium text-snow/50">Leistungen</h3>
            <div className="grid gap-3 sm:grid-cols-[1fr_8rem]">
              <Field label="Titel">{(id) => <Input id={id} value={title} onChange={(e) => setTitle(e.target.value)} />}</Field>
              <Field label="Gültig (Tage)">{(id) => <Input id={id} inputMode="numeric" value={validDays} onChange={(e) => setValidDays(e.target.value)} />}</Field>
            </div>
            {lines.map((line) => (
              <div key={line.key} className="flex flex-col gap-2 rounded-2xl border border-snow/10 bg-ink/40 p-3">
                <div className="flex gap-2">
                  <Select value={line.article_id ?? ""} onChange={(e) => chooseArticle(line.key, e.target.value)} aria-label="Artikel übernehmen" className="h-9 min-w-0 flex-1 text-[13px]">
                    <option value="">Freie Position</option>
                    {activeArticles.map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.name} · {euro(a.price)}
                      </option>
                    ))}
                  </Select>
                  {lines.length > 1 && (
                    <Button variant="ghost" size="sm" aria-label="Position entfernen" icon={<Trash2 className="h-4 w-4" />} onClick={() => setLines((ls) => ls.filter((l) => l.key !== line.key))} />
                  )}
                </div>
                <Textarea value={line.description} onChange={(e) => setLine(line.key, { description: e.target.value })} placeholder="Leistung (erste Zeile = Titel)" aria-label="Leistung" className="min-h-16 text-[13px]" />
                <div className="grid grid-cols-3 gap-2">
                  <Input value={line.quantity} onChange={(e) => setLine(line.key, { quantity: e.target.value })} inputMode="decimal" aria-label="Menge" className="h-9" />
                  <Select value={line.unit} onChange={(e) => setLine(line.key, { unit: e.target.value })} aria-label="Einheit" className="h-9 text-[13px]">
                    {["Monat", "Pauschal", "Std.", "Tag", "Stück"].map((u) => (
                      <option key={u} value={u}>
                        {u}
                      </option>
                    ))}
                  </Select>
                  <Input
                    value={line.unit_price_net}
                    onChange={(e) => setLine(line.key, { unit_price_net: e.target.value })}
                    inputMode="decimal"
                    placeholder="Preis netto"
                    aria-label="Preis netto"
                    className="h-9"
                  />
                </div>
              </div>
            ))}
            <div className="flex flex-wrap items-center justify-between gap-2">
              <Button size="sm" variant="ghost" icon={<Plus className="h-4 w-4" />} onClick={() => setLines((ls) => [...ls, newLine()])}>
                Position
              </Button>
              <p className="text-[13px] text-snow/60 tabular-nums">
                {monthly > 0 && <span className="text-snow">{euro(monthly)} / Monat</span>}
                {monthly > 0 && once > 0 && " · "}
                {once > 0 && `${euro(once)} einmalig`} <span className="text-snow/40">netto</span>
              </p>
            </div>
            <Field label="Einleitung (optional)">
              {(id) => <Textarea id={id} value={intro} onChange={(e) => setIntro(e.target.value)} placeholder="Standard: „vielen Dank für das gute Gespräch …“" className="min-h-14" />}
            </Field>
          </section>

          <section className="grid gap-3 sm:grid-cols-3">
            <h3 className="text-[12px] font-medium text-snow/50 sm:col-span-3">Vertrag</h3>
            <Field label="Vertragsbeginn">{(id) => <Input id={id} type="date" value={start} onChange={(e) => setStart(e.target.value)} />}</Field>
            <Field label="Mindestlaufzeit (Monate)">{(id) => <Input id={id} inputMode="numeric" value={minTerm} onChange={(e) => setMinTerm(e.target.value)} />}</Field>
            <Field label="Kündigungsfrist (Monate)">{(id) => <Input id={id} inputMode="numeric" value={notice} onChange={(e) => setNotice(e.target.value)} />}</Field>
            <Field label="Ziel der Zusammenarbeit (Präambel)" className="sm:col-span-3">
              {(id) => <Textarea id={id} value={purpose} onChange={(e) => setPurpose(e.target.value)} className="min-h-16" />}
            </Field>
            <label className="flex items-start gap-3 text-[14px] sm:col-span-3">
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
