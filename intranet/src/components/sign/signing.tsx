"use client";

import { useEffect, useMemo, useState } from "react";
import { Check, CircleCheck, Download, FileText, Lock, ShieldCheck } from "lucide-react";
import { cn } from "@/lib/cn";
import { formatIban, SEPA_TEXT, validIban } from "@/lib/contract";
import { money } from "@/lib/billing";
import { Logo } from "@/components/logo";
import { Button, Dialog, Field, Input, Spinner, Textarea } from "@/components/ui";
import { SignaturePad } from "@/components/signature-pad";

// Unterschriftsseite auf sign.grid-agency.de: Zustimmung → Angebot → Vertrag
// → SEPA-Mandat → Unterschrift → fertig. Ohne Anmeldung, Zugang über den Link.

type View = {
  status: "versendet" | "geoeffnet" | "unterschrieben" | "abgelehnt" | "widerrufen" | "abgelaufen";
  company: { name: string; city: string; email: string; creditor_id: string };
  signer_name: string;
  grid_signer: string;
  grid_signed_at: string;
  customer_signed_at: string | null;
  expires_at: string;
  sepa_required: boolean;
  customer: { name: string; street: string; zip: string; city: string };
  offer: {
    label: string;
    number: string | null;
    date: string | null;
    valid_until: string | null;
    intro: string;
    currency: string;
    amount_net: number;
    amount_vat: number;
    amount_gross: number;
    items: { kind: "position" | "text"; description: string; quantity: number; unit: string | null; unit_price_net: number; total_net: number }[];
  };
  contract: { title: string; sections: { heading: string; body: string }[] };
};

type Step = "start" | "angebot" | "vertrag" | "sepa" | "unterschrift";

const date = (value: string | null | undefined) => (value ? new Date(value.length === 10 ? `${value}T12:00:00` : value).toLocaleDateString("de-DE") : "");
const qty = (value: number) => new Intl.NumberFormat("de-DE", { maximumFractionDigits: 2 }).format(value);

async function call<T>(token: string, body?: unknown): Promise<T> {
  const response = await fetch(`/api/sign/${token}`, body ? { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) } : { cache: "no-store" });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error ?? "Da ist etwas schiefgelaufen.");
  return data as T;
}

export function Signing({ token }: { token: string }) {
  const [view, setView] = useState<View | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [step, setStep] = useState<Step>("start");
  const [consent, setConsent] = useState(false);
  const [readContract, setReadContract] = useState(false);
  const [sepa, setSepa] = useState({ holder: "", street: "", zip: "", city: "", iban: "", bic: "", bank: "" });
  const [signature, setSignature] = useState<string | null>(null);
  const [signing, setSigning] = useState(false);
  const [signError, setSignError] = useState<string | null>(null);
  const [declining, setDeclining] = useState(false);

  useEffect(() => {
    call<View>(token)
      .then((v) => {
        setView(v);
        setSepa((s) => ({ ...s, holder: v.customer.name, street: v.customer.street, zip: v.customer.zip, city: v.customer.city }));
      })
      .catch((e: Error) => setError(e.message));
  }, [token]);

  const steps = useMemo<{ id: Step; label: string }[]>(
    () => [
      { id: "start", label: "Start" },
      { id: "angebot", label: "Angebot" },
      { id: "vertrag", label: "Vertrag" },
      ...(view?.sepa_required ? [{ id: "sepa" as Step, label: "SEPA-Mandat" }] : []),
      { id: "unterschrift", label: "Unterschrift" },
    ],
    [view?.sepa_required]
  );
  const index = steps.findIndex((s) => s.id === step);
  const next = () => setStep(steps[Math.min(steps.length - 1, index + 1)].id);
  const back = () => setStep(steps[Math.max(0, index - 1)].id);
  const ibanOk = validIban(sepa.iban);

  async function sign() {
    setSigning(true);
    setSignError(null);
    try {
      const result = await call<{ signed_at: string }>(token, {
        action: "unterschreiben",
        consent,
        signature,
        sepa: view?.sepa_required ? sepa : null,
      });
      setView((v) => (v ? { ...v, status: "unterschrieben", customer_signed_at: result.signed_at } : v));
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (e) {
      setSignError(e instanceof Error ? e.message : "Unterschrift fehlgeschlagen");
    }
    setSigning(false);
  }

  const pdf = `/api/sign/${token}/pdf`;

  return (
    <div className="min-h-dvh bg-canvas">
      <header className="border-b border-snow/[0.08] bg-sky">
        <div className="mx-auto flex h-16 max-w-5xl items-center justify-between px-4 md:px-6">
          <div className="flex items-center gap-3">
            <Logo className="h-6" priority />
            <span className="rounded-full border border-snow/15 px-2.5 py-0.5 text-[11px] tracking-[0.2em] text-snow/60 uppercase">sign</span>
          </div>
          {view && view.status !== "widerrufen" && (
            <a href={pdf} target="_blank" rel="noopener" className="flex items-center gap-1.5 text-[13px] text-snow/70 hover:text-snow">
              <FileText className="h-4 w-4" />
              <span className="hidden sm:inline">Alle Unterlagen als PDF</span>
              <span className="sm:hidden">PDF</span>
            </a>
          )}
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 py-8 md:px-6 md:py-12">
        {error ? (
          <Message title="Dieser Link funktioniert nicht." text={`${error} Bitte wenden Sie sich an GRID AGENCY.`} />
        ) : !view ? (
          <div className="grid h-60 place-items-center">
            <Spinner />
          </div>
        ) : view.status === "unterschrieben" ? (
          <Done view={view} pdf={pdf} />
        ) : view.status === "abgelehnt" ? (
          <Message title="Sie haben die Unterlagen abgelehnt." text={`${view.grid_signer} von ${view.company.name} ist informiert und meldet sich bei Ihnen.`} />
        ) : view.status === "widerrufen" ? (
          <Message title="Diese Unterlagen sind nicht mehr aktuell." text={`${view.company.name} hat Ihnen eine neuere Fassung geschickt. Bitte nutzen Sie den Link aus der neuesten E-Mail.`} />
        ) : view.status === "abgelaufen" ? (
          <Message title="Der Link ist abgelaufen." text={`Bitte fordern Sie bei ${view.company.name} (${view.company.email}) einen neuen Link an.`} />
        ) : (
          <div className="grid gap-8 md:grid-cols-[200px_1fr]">
            {/* Schritte */}
            <nav aria-label="Schritte" className="md:sticky md:top-8 md:self-start">
              <ol className="flex gap-2 overflow-x-auto md:flex-col md:gap-1">
                {steps.map((s, i) => (
                  <li key={s.id} className="shrink-0">
                    <button
                      type="button"
                      disabled={i > index}
                      onClick={() => setStep(s.id)}
                      className={cn(
                        "flex h-9 items-center gap-2.5 rounded-full px-3 text-[13px] md:w-full",
                        s.id === step ? "bg-snow/[0.12] font-medium text-snow" : i < index ? "text-snow/70 hover:bg-snow/[0.06]" : "text-snow/35"
                      )}
                    >
                      <span
                        className={cn(
                          "grid h-5 w-5 place-items-center rounded-full text-[10px]",
                          i < index ? "bg-success/20 text-success" : s.id === step ? "bg-snow text-sky" : "border border-snow/20"
                        )}
                      >
                        {i < index ? <Check className="h-3 w-3" /> : i + 1}
                      </span>
                      {s.label}
                    </button>
                  </li>
                ))}
              </ol>
              <p className="mt-6 hidden items-start gap-2 text-[12px] leading-relaxed text-snow/45 md:flex">
                <Lock className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                Verschlüsselte Verbindung. Die fertigen Unterlagen werden versiegelt; jede spätere Änderung wäre erkennbar.
              </p>
            </nav>

            <section className="min-w-0">
              {step === "start" && (
                <div className="flex flex-col gap-6">
                  <div>
                    <p className="text-[11px] tracking-[0.25em] text-snow/50 uppercase">Unterlagen für</p>
                    <h1 className="mt-2 text-3xl font-medium tracking-tight md:text-4xl">
                      {view.customer.name.replace(/\.$/, "")}
                      <span className="text-dune">.</span>
                    </h1>
                    <p className="mt-3 max-w-xl text-[15px] leading-relaxed text-snow/70">
                      {view.grid_signer} von {view.company.name} hat Ihnen {view.offer.label}, den {view.contract.title}
                      {view.sepa_required ? " und ein SEPA-Lastschriftmandat" : ""} zur Unterschrift gesendet. {view.company.name} hat bereits unterschrieben.
                    </p>
                  </div>
                  <ul className="grid gap-2 sm:grid-cols-3">
                    {[view.offer.label, view.contract.title, ...(view.sepa_required ? ["SEPA-Lastschriftmandat"] : [])].map((label) => (
                      <li key={label} className="flex items-center gap-2 rounded-2xl border border-snow/10 bg-surface px-4 py-3 text-[14px]">
                        <FileText className="h-4 w-4 text-snow/50" />
                        {label}
                      </li>
                    ))}
                  </ul>
                  <label className="flex max-w-2xl cursor-pointer items-start gap-3 rounded-2xl border border-snow/10 bg-surface p-4 text-[14px] leading-relaxed">
                    <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} className="mt-1 h-4 w-4 accent-current" />
                    <span>
                      Ich bin einverstanden, diese Unterlagen elektronisch zu unterschreiben. Mir ist bekannt, dass ich sie jederzeit als PDF speichern kann und
                      nach der Unterschrift eine Kopie per E-Mail erhalte.
                    </span>
                  </label>
                  <div className="flex flex-wrap gap-2">
                    <Button variant="primary" disabled={!consent} onClick={next}>
                      Unterlagen prüfen
                    </Button>
                    <Button variant="ghost" onClick={() => setDeclining(true)}>
                      Ablehnen
                    </Button>
                  </div>
                  <p className="text-[12px] text-snow/45">Gültig bis {date(view.expires_at)}.</p>
                </div>
              )}

              {step === "angebot" && (
                <Panel eyebrow="Schritt 1" title={view.offer.label} onBack={back} onNext={next} nextLabel="Weiter zum Vertrag">
                  <p className="text-[13px] text-snow/55">
                    vom {date(view.offer.date)}
                    {view.offer.valid_until ? ` · gültig bis ${date(view.offer.valid_until)}` : ""}
                  </p>
                  {view.offer.intro && <p className="text-[14px] whitespace-pre-line text-snow/75">{view.offer.intro}</p>}
                  <ul className="divide-y divide-snow/[0.08] rounded-2xl border border-snow/10 bg-surface">
                    {view.offer.items.map((item, i) =>
                      item.kind === "text" ? (
                        <li key={i} className="px-4 py-3 text-[13px] whitespace-pre-line text-snow/60">
                          {item.description}
                        </li>
                      ) : (
                        <li key={i} className="flex gap-4 px-4 py-3">
                          <div className="min-w-0 flex-1">
                            <p className="text-[14px] font-medium">{item.description.split("\n")[0]}</p>
                            {item.description.includes("\n") && (
                              <p className="mt-1 text-[13px] whitespace-pre-line text-snow/60">{item.description.split("\n").slice(1).join("\n")}</p>
                            )}
                            <p className="mt-1 text-[12px] text-snow/45 tabular-nums">
                              {qty(item.quantity)} {item.unit ?? ""} × {money(item.unit_price_net, view.offer.currency)}
                            </p>
                          </div>
                          <p className="shrink-0 text-[14px] tabular-nums">{money(item.total_net, view.offer.currency)}</p>
                        </li>
                      )
                    )}
                  </ul>
                  <dl className="ml-auto w-full max-w-xs rounded-2xl bg-sky p-4 text-[13px] text-snow">
                    <div className="flex justify-between text-snow/60">
                      <dt>Netto</dt>
                      <dd className="tabular-nums">{money(view.offer.amount_net, view.offer.currency)}</dd>
                    </div>
                    <div className="mt-1 flex justify-between text-snow/60">
                      <dt>USt</dt>
                      <dd className="tabular-nums">{money(view.offer.amount_vat, view.offer.currency)}</dd>
                    </div>
                    <div className="mt-3 flex items-baseline justify-between">
                      <dt className="text-[11px] tracking-[0.2em] text-snow/50 uppercase">Gesamt</dt>
                      <dd className="text-xl font-medium tabular-nums">{money(view.offer.amount_gross, view.offer.currency)}</dd>
                    </div>
                  </dl>
                </Panel>
              )}

              {step === "vertrag" && (
                <Panel
                  eyebrow="Schritt 2"
                  title={view.contract.title}
                  onBack={back}
                  onNext={next}
                  nextDisabled={!readContract}
                  nextLabel={view.sepa_required ? "Weiter zum SEPA-Mandat" : "Weiter zur Unterschrift"}
                >
                  <div className="max-h-[60dvh] overflow-y-auto rounded-2xl border border-snow/10 bg-surface p-5 text-[14px] leading-relaxed">
                    {view.contract.sections.map((section) => (
                      <div key={section.heading} className="mb-5 last:mb-0">
                        <h3 className="mb-1.5 font-medium">{section.heading}</h3>
                        {section.body.split("\n").map((p, i) => (
                          <p key={i} className="mb-2 text-snow/75">
                            {p}
                          </p>
                        ))}
                      </div>
                    ))}
                  </div>
                  <label className="flex cursor-pointer items-start gap-3 text-[14px]">
                    <input type="checkbox" checked={readContract} onChange={(e) => setReadContract(e.target.checked)} className="mt-1 h-4 w-4" />
                    Ich habe den {view.contract.title} gelesen.
                  </label>
                </Panel>
              )}

              {step === "sepa" && (
                <Panel eyebrow="Schritt 3" title="SEPA-Lastschriftmandat" onBack={back} onNext={next} nextDisabled={!sepa.holder.trim() || !ibanOk} nextLabel="Weiter zur Unterschrift">
                  <div className="rounded-2xl border border-snow/10 bg-surface p-4 text-[13px] text-snow/70">
                    <p>
                      Zahlungsempfänger: <span className="text-snow">{view.company.name}</span> · Gläubiger-ID <span className="text-snow">{view.company.creditor_id}</span>
                    </p>
                    <p className="mt-1">Mandatsreferenz: wird mit der Unterschrift vergeben · wiederkehrende Zahlungen</p>
                  </div>
                  {SEPA_TEXT.replaceAll("{Gläubiger}", view.company.name)
                    .split("\n")
                    .map((p, i) => (
                      <p key={i} className={cn("text-[14px] leading-relaxed", i ? "text-snow/55" : "text-snow/80")}>
                        {p}
                      </p>
                    ))}
                  <div className="grid gap-3 sm:grid-cols-2">
                    <Field label="Kontoinhaber" className="sm:col-span-2">
                      {(id) => <Input id={id} value={sepa.holder} onChange={(e) => setSepa({ ...sepa, holder: e.target.value })} autoComplete="organization" />}
                    </Field>
                    <Field label="Straße" className="sm:col-span-2">
                      {(id) => <Input id={id} value={sepa.street} onChange={(e) => setSepa({ ...sepa, street: e.target.value })} autoComplete="street-address" />}
                    </Field>
                    <Field label="PLZ">{(id) => <Input id={id} value={sepa.zip} onChange={(e) => setSepa({ ...sepa, zip: e.target.value })} autoComplete="postal-code" />}</Field>
                    <Field label="Ort">{(id) => <Input id={id} value={sepa.city} onChange={(e) => setSepa({ ...sepa, city: e.target.value })} autoComplete="address-level2" />}</Field>
                    <Field label="IBAN" className="sm:col-span-2" hint={sepa.iban && !ibanOk ? "Diese IBAN ist ungültig – bitte prüfen." : undefined}>
                      {(id) => (
                        <Input
                          id={id}
                          value={sepa.iban}
                          onChange={(e) => setSepa({ ...sepa, iban: formatIban(e.target.value) })}
                          placeholder="DE00 0000 0000 0000 0000 00"
                          inputMode="text"
                          autoComplete="off"
                          className={cn("font-medium tracking-wide", sepa.iban && !ibanOk && "border-error/60")}
                        />
                      )}
                    </Field>
                    <Field label="BIC (optional)">{(id) => <Input id={id} value={sepa.bic} onChange={(e) => setSepa({ ...sepa, bic: e.target.value.toUpperCase() })} />}</Field>
                    <Field label="Kreditinstitut (optional)">{(id) => <Input id={id} value={sepa.bank} onChange={(e) => setSepa({ ...sepa, bank: e.target.value })} />}</Field>
                  </div>
                </Panel>
              )}

              {step === "unterschrift" && (
                <div className="flex flex-col gap-5">
                  <div>
                    <p className="text-[11px] tracking-[0.25em] text-snow/50 uppercase">Letzter Schritt</p>
                    <h2 className="mt-1 text-2xl font-medium tracking-tight">
                      Unterschreiben<span className="text-dune">.</span>
                    </h2>
                  </div>
                  <div className="rounded-2xl border border-snow/10 bg-surface p-4">
                    <p className="mb-3 text-[13px] text-snow/60">Unterschrift von {view.signer_name}</p>
                    <SignaturePad onChange={setSignature} name={view.signer_name} />
                  </div>
                  <p className="max-w-2xl text-[13px] leading-relaxed text-snow/60">
                    Mit „Verbindlich unterschreiben“ nehme ich {view.offer.label} an, schließe den {view.contract.title} mit {view.company.name}
                    {view.sepa_required ? ` und erteile das SEPA-Lastschriftmandat für das Konto ${sepa.iban.replace(/^(.{7}).*(.{4})$/, "$1 … $2")}` : ""}. Meine
                    Unterschrift gilt für alle Unterlagen dieser Mappe.
                  </p>
                  {signError && <p className="rounded-2xl bg-error/10 px-4 py-3 text-[13px] text-error">{signError}</p>}
                  <div className="flex flex-wrap gap-2">
                    <Button variant="ghost" onClick={back}>
                      Zurück
                    </Button>
                    <Button variant="primary" icon={<ShieldCheck className="h-4 w-4" />} disabled={!signature || !consent} loading={signing} loadingText="Wird unterschrieben …" onClick={sign}>
                      Verbindlich unterschreiben
                    </Button>
                  </div>
                </div>
              )}
            </section>
          </div>
        )}
      </main>

      <footer className="mx-auto max-w-5xl px-4 pb-10 text-[12px] text-snow/40 md:px-6">
        {view?.company.name ?? "GRID AGENCY UG"} · sign.grid-agency.de ·{" "}
        <a href="https://grid-agency.de/datenschutz" className="underline hover:text-snow/70">
          Datenschutz
        </a>{" "}
        ·{" "}
        <a href="https://grid-agency.de/impressum" className="underline hover:text-snow/70">
          Impressum
        </a>
      </footer>

      {view && <DeclineDialog token={token} open={declining} onClose={() => setDeclining(false)} onDone={() => setView({ ...view, status: "abgelehnt" })} />}
    </div>
  );
}

function Panel({
  eyebrow,
  title,
  children,
  onBack,
  onNext,
  nextLabel,
  nextDisabled,
}: {
  eyebrow: string;
  title: string;
  children: React.ReactNode;
  onBack: () => void;
  onNext: () => void;
  nextLabel: string;
  nextDisabled?: boolean;
}) {
  return (
    <div className="flex flex-col gap-5">
      <div>
        <p className="text-[11px] tracking-[0.25em] text-snow/50 uppercase">{eyebrow}</p>
        <h2 className="mt-1 text-2xl font-medium tracking-tight">
          {title}
          <span className="text-dune">.</span>
        </h2>
      </div>
      {children}
      <div className="flex flex-wrap gap-2">
        <Button variant="ghost" onClick={onBack}>
          Zurück
        </Button>
        <Button variant="primary" disabled={nextDisabled} onClick={onNext}>
          {nextLabel}
        </Button>
      </div>
    </div>
  );
}

function Message({ title, text }: { title: string; text: string }) {
  return (
    <div className="mx-auto max-w-xl py-16 text-center">
      <h1 className="text-2xl font-medium tracking-tight">{title}</h1>
      <p className="mt-3 text-[15px] text-snow/65">{text}</p>
    </div>
  );
}

function Done({ view, pdf }: { view: View; pdf: string }) {
  return (
    <div className="mx-auto flex max-w-xl flex-col items-center py-12 text-center">
      <CircleCheck className="h-12 w-12 text-success" strokeWidth={1.5} />
      <h1 className="mt-5 text-3xl font-medium tracking-tight">
        Vielen Dank, {view.signer_name.split(" ")[0]}
        <span className="text-dune">.</span>
      </h1>
      <p className="mt-3 text-[15px] leading-relaxed text-snow/70">
        {view.offer.label}, {view.contract.title}
        {view.sepa_required ? " und SEPA-Lastschriftmandat" : ""} sind von beiden Seiten unterschrieben
        {view.customer_signed_at ? ` (${date(view.customer_signed_at)})` : ""}. Die versiegelten Unterlagen kommen gleich per E-Mail.
      </p>
      <a href={`${pdf}?download=1`} className="mt-6">
        <Button variant="primary" icon={<Download className="h-4 w-4" />}>
          Unterlagen herunterladen
        </Button>
      </a>
      <p className="mt-8 text-[13px] text-snow/50">Wir freuen uns auf die Zusammenarbeit!</p>
    </div>
  );
}

function DeclineDialog({ token, open, onClose, onDone }: { token: string; open: boolean; onClose: () => void; onDone: () => void }) {
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  async function submit() {
    setBusy(true);
    try {
      await call(token, { action: "ablehnen", reason });
      onClose();
      onDone();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Fehlgeschlagen");
    }
    setBusy(false);
  }
  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Unterlagen ablehnen?"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Abbrechen
          </Button>
          <Button variant="danger" loading={busy} loadingText="Wird gesendet …" onClick={submit}>
            Ablehnen
          </Button>
        </>
      }
    >
      <p className="mb-3 text-sm text-snow/70">GRID AGENCY wird informiert. Wenn Sie mögen, sagen Sie uns kurz, was nicht passt.</p>
      <Textarea value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Grund (optional)" aria-label="Grund" />
      {error && <p className="mt-2 text-sm text-error">{error}</p>}
    </Dialog>
  );
}
