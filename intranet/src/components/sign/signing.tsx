"use client";

import { useEffect, useState } from "react";
import { Check, CircleCheck, Download, FileText, Lock, ShieldCheck } from "lucide-react";
import { cn } from "@/lib/cn";
import { formatIban, SEPA_TEXT, validIban } from "@/lib/contract";
import { money } from "@/lib/billing";
import { Logo } from "@/components/logo";
import { Button, Dialog, Field, Input, Spinner, Textarea } from "@/components/ui";
import { SignaturePad } from "@/components/signature-pad";

// Unterschriftsseite auf sign.grid-agency.de: Angebot prüfen und annehmen →
// Mappe (Vertrag, SEPA-Mandat) unterschreiben → fertig. Ohne Anmeldung, Zugang über den Link.

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

type Step = "angebot" | "unterschrift";

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
  const [step, setStep] = useState<Step>("angebot");
  const [consent, setConsent] = useState(false);
  const [accepting, setAccepting] = useState(false);
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

  const steps: { id: Step; label: string }[] = [
    { id: "angebot", label: "Angebot" },
    { id: "unterschrift", label: "Unterschrift" },
  ];
  const index = steps.findIndex((s) => s.id === step);
  const ibanOk = validIban(sepa.iban);

  async function accept() {
    setAccepting(true);
    // Bestätigung landet im Protokoll; die Unterschrift bleibt auch ohne sie möglich
    await call(token, { action: "annehmen" }).catch(() => undefined);
    setAccepting(false);
    setStep("unterschrift");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

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
              {step === "angebot" && (
                <div className="flex flex-col gap-6">
                  <div>
                    <p className="text-[11px] tracking-[0.25em] text-snow/50 uppercase">{view.offer.label} für</p>
                    <h1 className="mt-2 text-3xl font-medium tracking-tight md:text-4xl">
                      {view.customer.name.replace(/\.$/, "")}
                      <span className="text-dune">.</span>
                    </h1>
                    <p className="mt-3 text-[13px] text-snow/55">
                      von {view.grid_signer}, {view.company.name} · vom {date(view.offer.date)}
                      {view.offer.valid_until ? ` · gültig bis ${date(view.offer.valid_until)}` : ""}
                    </p>
                  </div>
                  {view.offer.intro && <p className="max-w-2xl text-[15px] leading-relaxed whitespace-pre-line text-snow/75">{view.offer.intro}</p>}
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
                  <div className="grid gap-3 sm:grid-cols-[1fr_minmax(0,18rem)]">
                    <div className="rounded-2xl border border-snow/10 bg-surface p-4 text-[13px] leading-relaxed text-snow/65">
                      <p className="text-[11px] tracking-[0.2em] text-snow/50 uppercase">Zahlungsart</p>
                      <p className="mt-1 text-[15px] font-medium text-snow">{view.sepa_required ? "SEPA-Lastschrift" : "Überweisung"}</p>
                      <p className="mt-1">
                        {view.sepa_required
                          ? "Die Rechnungsbeträge ziehen wir per SEPA-Basislastschrift ein. Das Mandat erteilen Sie mit der Unterschrift im nächsten Schritt."
                          : "Sie erhalten Rechnungen per E-Mail und überweisen den Betrag."}
                      </p>
                    </div>
                    <dl className="rounded-2xl bg-sky p-4 text-[13px] text-snow">
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
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button variant="primary" icon={<Check className="h-4 w-4" />} loading={accepting} loadingText="Einen Moment …" onClick={accept}>
                      Angebot annehmen
                    </Button>
                    <Button variant="ghost" onClick={() => setDeclining(true)}>
                      Ablehnen
                    </Button>
                  </div>
                  <p className="text-[12px] text-snow/45">
                    Nach der Annahme unterschreiben Sie in einem Schritt die Mappe mit {view.contract.title}
                    {view.sepa_required ? " und SEPA-Lastschriftmandat" : ""}. {view.company.name} hat bereits unterschrieben. Link gültig bis {date(view.expires_at)}.
                  </p>
                </div>
              )}

              {step === "unterschrift" && (
                <div className="flex flex-col gap-6">
                  <div>
                    <p className="text-[11px] tracking-[0.25em] text-snow/50 uppercase">Ihre Mappe</p>
                    <h2 className="mt-1 text-2xl font-medium tracking-tight md:text-3xl">
                      Unterschreiben<span className="text-dune">.</span>
                    </h2>
                    <p className="mt-2 max-w-2xl text-[14px] leading-relaxed text-snow/65">
                      Eine Unterschrift für alle Unterlagen: {view.offer.label}, {view.contract.title}
                      {view.sepa_required ? " und SEPA-Lastschriftmandat" : ""}.
                    </p>
                  </div>

                  <Doc title={view.contract.title} hint="Gegenseitig unterschrieben, sobald Sie unterschreiben">
                    <div className="max-h-[50dvh] overflow-y-auto pr-1 text-[14px] leading-relaxed">
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
                  </Doc>

                  {view.sepa_required && (
                    <Doc title="SEPA-Lastschriftmandat" hint={`Zahlungsempfänger ${view.company.name} · Gläubiger-ID ${view.company.creditor_id} · Mandatsreferenz wird mit der Unterschrift vergeben`}>
                      {SEPA_TEXT.replaceAll("{Gläubiger}", view.company.name)
                        .split("\n")
                        .map((p, i) => (
                          <p key={i} className={cn("mb-2 text-[13px] leading-relaxed", i ? "text-snow/55" : "text-snow/80")}>
                            {p}
                          </p>
                        ))}
                      <div className="mt-2 grid gap-3 sm:grid-cols-2">
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
                    </Doc>
                  )}

                  <div className="rounded-2xl border border-snow/10 bg-surface p-4">
                    <p className="mb-3 text-[13px] text-snow/60">Unterschrift von {view.signer_name}</p>
                    <SignaturePad onChange={setSignature} name={view.signer_name} />
                  </div>
                  <label className="flex max-w-2xl cursor-pointer items-start gap-3 text-[13px] leading-relaxed text-snow/70">
                    <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} className="mt-1 h-4 w-4 shrink-0" />
                    <span>
                      Ich habe die Unterlagen gelesen und unterschreibe sie elektronisch. Damit nehme ich {view.offer.label} an, schließe den {view.contract.title} mit{" "}
                      {view.company.name}
                      {view.sepa_required && sepa.iban ? ` und erteile das SEPA-Lastschriftmandat für das Konto ${sepa.iban.replace(/^(.{7}).*(.{4})$/, "$1 … $2")}` : ""}. Eine Kopie
                      kommt per E-Mail.
                    </span>
                  </label>
                  {signError && <p className="rounded-2xl bg-error/10 px-4 py-3 text-[13px] text-error">{signError}</p>}
                  <div className="flex flex-wrap gap-2">
                    <Button variant="ghost" onClick={() => setStep("angebot")}>
                      Zurück zum Angebot
                    </Button>
                    <Button
                      variant="primary"
                      icon={<ShieldCheck className="h-4 w-4" />}
                      disabled={!signature || !consent || (view.sepa_required && (!sepa.holder.trim() || !ibanOk))}
                      loading={signing}
                      loadingText="Wird unterschrieben …"
                      onClick={sign}
                    >
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

function Doc({ title, hint, children }: { title: string; hint: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-snow/10 bg-surface p-4 md:p-5">
      <div className="mb-3 flex items-start gap-2.5">
        <FileText className="mt-0.5 h-4 w-4 shrink-0 text-snow/50" />
        <div>
          <h3 className="text-[15px] font-medium">{title}</h3>
          <p className="text-[12px] text-snow/50">{hint}</p>
        </div>
      </div>
      {children}
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
