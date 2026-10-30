"use client";

import { useState } from "react";
import { api } from "@/lib/api";
import { FINANCE_MAILBOX } from "@/lib/config";
import { mutate, useResource } from "@/lib/data";
import type { BillingSettings } from "@/lib/billing";
import { DEFAULT_CONTRACT, contractFromText, contractToText, type ContractTemplate } from "@/lib/contract";
import type { Settings } from "@/lib/sales/types";
import { Button, Field, Input, Spinner, Textarea, useToast } from "@/components/ui";
import { PageBar } from "@/components/sales/shell";

/** Einstellungen für Finance: DATEV-Upload-Adresse (Belegtransfer per Mail),
 * Firmendaten und Texte der Ausgangsrechnungen. */
export function FinanceSettings() {
  const { data } = useResource<Settings>("/api/sales/settings");
  return (
    <div className="flex h-full flex-col">
      <PageBar title="Einstellungen" />
      <div className="overflow-y-auto p-5">
        {data ? (
          <div className="flex flex-col gap-5">
            <DatevForm key={data.datev.upload_address} initial={data.datev.upload_address} />
            <BillingForm initial={data.billing} />
            <ContractForm initial={data.contract} signature={data.grid_signature} />
          </div>
        ) : (
          <Spinner />
        )}
      </div>
    </div>
  );
}

function DatevForm({ initial }: { initial: string }) {
  const toast = useToast();
  const [address, setAddress] = useState(initial);
  const [busy, setBusy] = useState(false);

  async function save(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    try {
      const result = await api<Settings>("/api/sales/settings", {
        method: "PUT",
        body: JSON.stringify({ datev: { upload_address: address } }),
      });
      mutate<Settings>("/api/sales/settings", () => result);
      toast("Gespeichert");
    } catch (error) {
      toast(error instanceof Error ? error.message : "Speichern fehlgeschlagen", "error");
    }
    setBusy(false);
  }

  return (
    <form onSubmit={save} className="max-w-lg rounded-3xl border border-snow/10 bg-surface p-6">
      <h2 className="mb-1 text-lg font-medium">DATEV Upload-Mail</h2>
      <p className="mb-5 text-sm text-snow/60">
        Freigegebene Eingangsrechnungen gehen mit ihren Belegen von {FINANCE_MAILBOX} an diese Adresse. Sie steht in DATEV
        Unternehmen online unter „Belegtransfer per E-Mail“.
      </p>
      <Field label="Upload-Adresse">
        {(id) => (
          <Input
            id={id}
            type="email"
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            placeholder="…@uploadmail.datev.de"
          />
        )}
      </Field>
      <Button type="submit" variant="primary" className="mt-5" loading={busy} loadingText="Wird gespeichert …" disabled={address.trim() === initial}>
        Speichern
      </Button>
    </form>
  );
}

const COMPANY_FIELDS: [keyof BillingSettings["company"], string][] = [
  ["name", "Firma"],
  ["street", "Straße"],
  ["zip", "PLZ"],
  ["city", "Ort"],
  ["email", "E-Mail"],
  ["phone", "Telefon"],
  ["website", "Website"],
  ["tax_number", "Steuernummer"],
  ["vat_id", "USt-IdNr."],
  ["bank", "Bank"],
  ["iban", "IBAN"],
  ["bic", "BIC"],
  ["managing_director", "Geschäftsführung"],
  ["register", "Registergericht und Nummer"],
  ["creditor_id", "SEPA-Gläubiger-ID"],
];

/** Firmendaten (Pflichtangaben auf jeder Rechnung) und Standardtexte */
function BillingForm({ initial }: { initial: BillingSettings }) {
  const toast = useToast();
  const [form, setForm] = useState(initial);
  const [busy, setBusy] = useState(false);
  const setCompany = (key: keyof BillingSettings["company"], value: string) => setForm((f) => ({ ...f, company: { ...f.company, [key]: value } }));

  async function save(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    try {
      const result = await api<Settings>("/api/sales/settings", { method: "PUT", body: JSON.stringify({ billing: form }) });
      mutate<Settings>("/api/sales/settings", () => result);
      setForm(result.billing);
      toast("Gespeichert");
    } catch (error) {
      toast(error instanceof Error ? error.message : "Speichern fehlgeschlagen", "error");
    }
    setBusy(false);
  }

  return (
    <form onSubmit={save} className="max-w-3xl rounded-3xl border border-snow/10 bg-surface p-6">
      <h2 className="mb-1 text-lg font-medium">Ausgangsrechnungen</h2>
      <p className="mb-5 text-sm text-snow/60">
        Diese Angaben stehen auf jeder Rechnung (Pflichtangaben nach § 14 UStG) und im GiroCode. Änderungen gelten für neu festgeschriebene Belege; bereits
        abgelegte PDFs bleiben unverändert.
      </p>
      <div className="grid gap-3 sm:grid-cols-2">
        {COMPANY_FIELDS.map(([key, label]) => (
          <Field key={key} label={label}>
            {(id) => <Input id={id} value={form.company[key]} onChange={(e) => setCompany(key, e.target.value)} required={key === "name" || key === "iban"} />}
          </Field>
        ))}
        <Field label="Zahlungsziel (Tage)" hint="Vorgabe für neue Rechnungen; je Kunde abweichend möglich">
          {(id) => (
            <Input id={id} inputMode="numeric" value={String(form.payment_terms_days)} onChange={(e) => setForm({ ...form, payment_terms_days: Number(e.target.value) || 0 })} />
          )}
        </Field>
        <Field label="Einleitung" className="sm:col-span-2">
          {(id) => <Textarea id={id} value={form.intro} onChange={(e) => setForm({ ...form, intro: e.target.value })} className="min-h-16" />}
        </Field>
        <Field label="Schlusstext" className="sm:col-span-2" hint="Platzhalter: {Fällig}, {Monat}, {Zeitraum}, {Firma}">
          {(id) => <Textarea id={id} value={form.closing} onChange={(e) => setForm({ ...form, closing: e.target.value })} className="min-h-16" />}
        </Field>
        <Field label="Betreff der Mail" className="sm:col-span-2" hint="Platzhalter: {Belegart}, {Nummer}, {Firma}">
          {(id) => <Input id={id} value={form.mail_subject} onChange={(e) => setForm({ ...form, mail_subject: e.target.value })} />}
        </Field>
        <Field label="Text der Mail" className="sm:col-span-2" hint="Platzhalter: {Belegart}, {Nummer}, {Betrag}, {Fällig}, {Firma}">
          {(id) => <Textarea id={id} value={form.mail_body} onChange={(e) => setForm({ ...form, mail_body: e.target.value })} className="min-h-32" />}
        </Field>
      </div>
      <Button type="submit" variant="primary" className="mt-5" loading={busy} loadingText="Wird gespeichert …">
        Speichern
      </Button>
    </form>
  );
}

/** Agenturvertrag der Unterschriftsmappe: ein Abschnitt je „## Überschrift“ */
function ContractForm({ initial, signature }: { initial: ContractTemplate; signature: Settings["grid_signature"] }) {
  const toast = useToast();
  const [title, setTitle] = useState(initial.title);
  const [text, setText] = useState(() => contractToText(initial));
  const [busy, setBusy] = useState<"vertrag" | "unterschrift" | null>(null);

  async function put(body: object, label: "vertrag" | "unterschrift", done: string) {
    setBusy(label);
    try {
      const result = await api<Settings>("/api/sales/settings", { method: "PUT", body: JSON.stringify(body) });
      mutate<Settings>("/api/sales/settings", () => result);
      toast(done);
    } catch (error) {
      toast(error instanceof Error ? error.message : "Speichern fehlgeschlagen", "error");
    }
    setBusy(null);
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        put({ contract: contractFromText(title, text) }, "vertrag", "Vertrag gespeichert");
      }}
      className="max-w-3xl rounded-3xl border border-snow/10 bg-surface p-6"
    >
      <h2 className="mb-1 text-lg font-medium">Agenturvertrag</h2>
      <p className="mb-5 text-sm text-snow/60">
        Geht mit jedem Angebot zur Unterschrift. Jeder Abschnitt beginnt mit „## Überschrift“. Platzhalter: {"{Zweck}"}, {"{Angebot}"}, {"{Angebotsdatum}"},{" "}
        {"{Vertragsbeginn}"}, {"{Mindestlaufzeit}"}, {"{Kündigungsfrist}"}. Bereits verschickte Mappen behalten ihre Fassung.
      </p>
      <div className="flex flex-col gap-3">
        <Field label="Titel">{(id) => <Input id={id} value={title} onChange={(e) => setTitle(e.target.value)} />}</Field>
        <Field label="Text">{(id) => <Textarea id={id} value={text} onChange={(e) => setText(e.target.value)} className="min-h-96 font-mono text-[12px]" />}</Field>
      </div>
      <div className="mt-5 flex flex-wrap gap-2">
        <Button type="submit" variant="primary" loading={busy === "vertrag"} loadingText="Wird gespeichert …">
          Speichern
        </Button>
        <Button
          variant="ghost"
          onClick={() => {
            setTitle(DEFAULT_CONTRACT.title);
            setText(contractToText(DEFAULT_CONTRACT));
          }}
        >
          Vorlage aus easybill wiederherstellen
        </Button>
      </div>
      {signature && (
        <div className="mt-6 flex items-center gap-4 border-t border-snow/10 pt-5 text-sm">
          <span className="text-snow/60">Gespeicherte Unterschrift für GRID: {signature.signer}</span>
          <Button size="sm" variant="ghost" loading={busy === "unterschrift"} loadingText="Wird entfernt …" onClick={() => put({ grid_signature: null }, "unterschrift", "Unterschrift entfernt")}>
            Entfernen
          </Button>
        </div>
      )}
    </form>
  );
}
