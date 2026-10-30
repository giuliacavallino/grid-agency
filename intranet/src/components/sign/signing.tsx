"use client";

import { useEffect, useState } from "react";
import { ArrowDown, Check, CircleCheck, Download, FileText, Lock, PenLine, ShieldCheck } from "lucide-react";
import { cn } from "@/lib/cn";
import { formatIban, SEPA_TEXT, SIGN_FIELD_LABEL, signFields, validIban, type SignField } from "@/lib/contract";
import { money } from "@/lib/billing";
import { Logo } from "@/components/logo";
import { Button, Dialog, Spinner, Textarea } from "@/components/ui";
import { SignaturePad } from "@/components/signature-pad";

// Unterschriftsseite auf sign.grid-agency.de. Ablauf wie bei DocuSign:
// Angebot prüfen und annehmen → Unterschrift einmal erstellen → in den
// Dokumenten von Feld zu Feld unterschreiben (jede Unterschrift mit eigener
// Prüf-ID) → fertigstellen. Ohne Anmeldung, Zugang über den Link.

type View = {
  status: "versendet" | "geoeffnet" | "unterschrieben" | "abgelehnt" | "widerrufen" | "abgelaufen";
  company: { name: string; street: string; zip: string; city: string; email: string; creditor_id: string; managing_director: string };
  signer_name: string;
  grid_signer: string;
  grid_signature: string;
  grid_id: string;
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

type Step = "angebot" | "erstellen" | "dokumente";

const STEPS: { id: Step; label: string }[] = [
  { id: "angebot", label: "Angebot" },
  { id: "erstellen", label: "Unterschrift erstellen" },
  { id: "dokumente", label: "Unterschreiben" },
];

const date = (value: string | null | undefined) => (value ? new Date(value.length === 10 ? `${value}T12:00:00` : value).toLocaleDateString("de-DE") : "");
const qty = (value: number) => new Intl.NumberFormat("de-DE", { maximumFractionDigits: 2 }).format(value);

/** Prüf-ID je gesetzter Unterschrift, z. B. 8F3A-1C2E-4B7D-90AF */
const newVerifyId = () =>
  Array.from(crypto.getRandomValues(new Uint8Array(8)), (b) => b.toString(16).padStart(2, "0"))
    .join("")
    .toUpperCase()
    .match(/.{4}/g)!
    .join("-");

// Papier: Dokumente sehen in beiden Modi aus wie das PDF
const PAPER = "rounded-md bg-white px-5 py-7 text-[#2b2926] shadow-[0_1px_2px_rgba(0,0,0,0.10),0_10px_30px_rgba(0,0,0,0.10)] md:px-12 md:py-12";
const PAPER_INPUT = "h-9 w-full rounded-md border border-[#d8d5cf] bg-white px-2.5 text-[13px] text-[#2b2926] outline-none focus:border-[#2b2926]";

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
  const [accepting, setAccepting] = useState(false);
  const [consent, setConsent] = useState(false);
  const [signature, setSignature] = useState<string | null>(null);
  const [stamps, setStamps] = useState<Partial<Record<SignField, string>>>({});
  const [target, setTarget] = useState<string | null>(null);
  const [sepa, setSepa] = useState({ holder: "", street: "", zip: "", city: "", iban: "", bic: "", bank: "" });
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

  const fields = signFields(!!view?.sepa_required);
  const ibanOk = validIban(sepa.iban);
  const sepaOk = !view?.sepa_required || (!!sepa.holder.trim() && ibanOk);
  const done = fields.filter((f) => stamps[f]).length;
  const complete = done === fields.length && sepaOk;

  function go(next: Step) {
    setStep(next);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function accept() {
    setAccepting(true);
    // Bestätigung landet im Protokoll; die Unterschrift bleibt auch ohne sie möglich
    await call(token, { action: "annehmen" }).catch(() => undefined);
    setAccepting(false);
    go("erstellen");
  }

  /** Nächste offene Stelle: SEPA-Angaben oder ein Unterschriftsfeld */
  function next() {
    const open: string | undefined = fields
      .flatMap((f) => (f === "sepa" ? [!sepa.holder.trim() && "sepa-holder", !ibanOk && "sepa-iban", !stamps.sepa && "feld-sepa"] : [!stamps[f] && `feld-${f}`]))
      .find((id): id is string => !!id);
    const id = open ?? "fertigstellen";
    const element = document.getElementById(id);
    element?.scrollIntoView({ behavior: "smooth", block: "center" });
    if (element instanceof HTMLInputElement) element.focus({ preventScroll: true });
    setTarget(id);
  }

  function stamp(field: SignField) {
    setStamps((s) => ({ ...s, [field]: newVerifyId() }));
    setTarget(null);
  }

  async function sign() {
    setSigning(true);
    setSignError(null);
    try {
      const result = await call<{ signed_at: string }>(token, {
        action: "unterschreiben",
        consent,
        signature,
        fields: stamps,
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
  const index = STEPS.findIndex((s) => s.id === step);
  const field = (f: SignField) => (
    <SignHere
      field={f}
      verifyId={stamps[f]}
      image={signature}
      active={target === `feld-${f}`}
      onSign={() => stamp(f)}
      onClear={() => setStamps((s) => ({ ...s, [f]: undefined }))}
    />
  );

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

      <main className="mx-auto max-w-5xl px-4 py-8 md:px-6 md:py-10">
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
          <>
            {/* Schritte */}
            <ol aria-label="Schritte" className="mb-8 flex gap-1 overflow-x-auto">
              {STEPS.map((s, i) => (
                <li key={s.id} className="shrink-0">
                  <span
                    aria-current={s.id === step ? "step" : undefined}
                    className={cn(
                      "flex h-9 items-center gap-2 rounded-full px-3 text-[13px]",
                      s.id === step ? "bg-snow/[0.12] font-medium text-snow" : i < index ? "text-snow/70" : "text-snow/35"
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
                  </span>
                </li>
              ))}
            </ol>

            {step === "angebot" && (
              <div className="flex max-w-3xl flex-col gap-6">
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
                        ? "Die Rechnungsbeträge ziehen wir per SEPA-Basislastschrift ein. Das Mandat unterschreiben Sie mit dem Vertrag."
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
                  Danach unterschreiben Sie die Mappe mit Angebot, {view.contract.title}
                  {view.sepa_required ? " und SEPA-Lastschriftmandat" : ""}. {view.company.name} hat bereits unterschrieben. Link gültig bis {date(view.expires_at)}.
                </p>
              </div>
            )}

            {step === "erstellen" && (
              <div className="flex max-w-2xl flex-col gap-5">
                <div>
                  <h2 className="text-2xl font-medium tracking-tight md:text-3xl">
                    Unterschrift erstellen<span className="text-dune">.</span>
                  </h2>
                  <p className="mt-2 text-[14px] leading-relaxed text-snow/65">
                    Sie erstellen Ihre Unterschrift einmal und setzen sie dann mit einem Klick an jeder markierten Stelle. Jede gesetzte Unterschrift bekommt eine
                    eigene Prüf-ID.
                  </p>
                </div>
                <div className="rounded-2xl border border-snow/10 bg-surface p-4">
                  <p className="mb-3 text-[13px] text-snow/60">
                    Unterschrift von <span className="text-snow">{view.signer_name}</span>
                  </p>
                  <SignaturePad onChange={setSignature} name={view.signer_name} />
                </div>
                <div className="flex flex-col gap-2">
                  <p className="text-[11px] tracking-[0.2em] text-snow/50 uppercase">Vorschau</p>
                  <div className="w-fit rounded-xl bg-white px-4 py-3">
                    {signature ? <Stamp image={signature} verifyId="XXXX-XXXX-XXXX-XXXX" /> : <p className="py-6 text-[13px] text-[#8c867c]">Noch keine Unterschrift</p>}
                  </div>
                </div>
                <label className="flex cursor-pointer items-start gap-3 rounded-2xl border border-snow/10 bg-surface p-4 text-[13px] leading-relaxed text-snow/75">
                  <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} className="mt-0.5 h-4 w-4 shrink-0" />
                  <span>
                    Ich bin einverstanden, die Unterlagen elektronisch zu unterschreiben. Meine elektronische Unterschrift ist so verbindlich wie eine
                    handschriftliche. Eine Kopie erhalte ich per E-Mail.
                  </span>
                </label>
                <div className="flex flex-wrap gap-2">
                  <Button variant="ghost" onClick={() => go("angebot")}>
                    Zurück
                  </Button>
                  <Button
                    variant="primary"
                    icon={<PenLine className="h-4 w-4" />}
                    disabled={!signature || !consent}
                    onClick={() => {
                      setStamps({});
                      go("dokumente");
                    }}
                  >
                    Übernehmen und unterschreiben
                  </Button>
                </div>
              </div>
            )}

            {step === "dokumente" && (
              <div className="flex flex-col gap-6">
                {/* Leiste wie bei DocuSign: Fortschritt, Weiter, Fertigstellen */}
                <div className="sticky top-0 z-20 -mx-4 flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-snow/[0.08] bg-canvas/95 px-4 py-3 backdrop-blur md:-mx-6 md:px-6">
                  <div className="min-w-0 flex-1">
                    <p className="text-[13px] text-snow/80">
                      <span className="hidden sm:inline">
                        {complete ? "Alles unterschrieben. Bitte fertigstellen." : "Klicken Sie auf jedes markierte Feld, um zu unterschreiben."}
                      </span>
                      <span className="sm:hidden">{complete ? "Bereit zum Fertigstellen" : "Felder unterschreiben"}</span>
                    </p>
                    <div className="mt-1.5 flex items-center gap-2 whitespace-nowrap">
                      <div className="h-1 w-24 overflow-hidden rounded-full bg-snow/10 sm:w-40">
                        <div className="h-full rounded-full bg-success transition-[width]" style={{ width: `${(done / fields.length) * 100}%` }} />
                      </div>
                      <span className="text-[12px] text-snow/50 tabular-nums">
                        {done} von {fields.length}
                      </span>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => go("erstellen")}
                    className="hidden text-[13px] text-snow/60 underline-offset-4 hover:text-snow hover:underline sm:inline"
                  >
                    Unterschrift ändern
                  </button>
                  {complete ? (
                    <Button variant="primary" icon={<ShieldCheck className="h-4 w-4" />} loading={signing} loadingText="Wird abgeschlossen …" onClick={sign}>
                      Fertigstellen
                    </Button>
                  ) : (
                    <Button variant="primary" icon={<ArrowDown className="h-4 w-4" />} onClick={next}>
                      {done === 0 ? "Start" : "Weiter"}
                    </Button>
                  )}
                </div>

                <div className="mx-auto flex w-full max-w-3xl flex-col gap-6">
                  {/* Angebot */}
                  <article className={PAPER}>
                    <DocHead eyebrow={`${view.offer.label} · ${date(view.offer.date)}`} title="Angebot" />
                    <p className="mt-1 text-[13px] text-[#676159]">für {view.customer.name}</p>
                    <ul className="mt-6 divide-y divide-[#e2e0dc] border-y border-[#e2e0dc]">
                      {view.offer.items
                        .filter((i) => i.kind === "position")
                        .map((item, i) => (
                          <li key={i} className="flex gap-4 py-2.5 text-[13px]">
                            <span className="min-w-0 flex-1">
                              <span className="font-medium">{item.description.split("\n")[0]}</span>
                              <span className="block text-[12px] text-[#676159] tabular-nums">
                                {qty(item.quantity)} {item.unit ?? ""} × {money(item.unit_price_net, view.offer.currency)}
                              </span>
                            </span>
                            <span className="shrink-0 tabular-nums">{money(item.total_net, view.offer.currency)}</span>
                          </li>
                        ))}
                    </ul>
                    <div className="mt-3 flex justify-between text-[13px]">
                      <span className="text-[#676159]">Gesamt brutto · Zahlungsart {view.sepa_required ? "SEPA-Lastschrift" : "Überweisung"}</span>
                      <span className="font-medium tabular-nums">{money(view.offer.amount_gross, view.offer.currency)}</span>
                    </div>
                    <div className="mt-8">
                      <p className="text-[10px] tracking-[0.2em] text-[#676159] uppercase">Annahme</p>
                      <p className="mt-1 text-[13px] leading-relaxed">
                        Hiermit nehme ich das Angebot {view.offer.number} an. Es gilt der {view.contract.title}
                        {view.sepa_required ? "; gezahlt wird per SEPA-Lastschrift" : ""}.
                      </p>
                      <div className="mt-4 sm:ml-auto sm:w-1/2">
                        {field("angebot")}
                        <SignLabel>
                          {view.customer.name} · {view.signer_name}
                        </SignLabel>
                      </div>
                    </div>
                  </article>

                  {/* Vertrag */}
                  <article className={PAPER}>
                    <DocHead eyebrow="Vertrag" title={view.contract.title} />
                    <div className="mt-5 rounded-lg bg-[#f2f1ef] p-4 text-[13px] leading-relaxed">
                      zwischen <b className="font-medium">{view.company.name}</b>, {view.company.street}, {view.company.zip} {view.company.city}, vertreten durch die
                      Geschäftsführung ({view.company.managing_director}) <span className="text-[#676159]">– „Agentur“ –</span>
                      <br />
                      und <b className="font-medium">{view.customer.name}</b>
                      {view.customer.street ? `, ${view.customer.street}, ${view.customer.zip} ${view.customer.city}` : ""} <span className="text-[#676159]">– „Kunde“ –</span>
                    </div>
                    <div className="mt-5 text-[13px] leading-relaxed">
                      {view.contract.sections.map((section) => (
                        <section key={section.heading} className="mb-4">
                          <h3 className="mb-1 text-[14px] font-medium">{section.heading}</h3>
                          {section.body
                            .split("\n")
                            .filter((p) => p.trim())
                            .map((p, i) => (
                              <p key={i} className="mb-1.5 text-[#3d3a36]">
                                {p}
                              </p>
                            ))}
                        </section>
                      ))}
                    </div>
                    <div className="mt-8 grid gap-6 sm:grid-cols-2">
                      <div>
                        <Stamp image={view.grid_signature} verifyId={view.grid_id} />
                        <SignLabel>
                          Agentur: {view.company.name}
                          <br />
                          {view.grid_signer} · {view.company.city}, {date(view.grid_signed_at)}
                        </SignLabel>
                      </div>
                      <div>
                        {field("vertrag")}
                        <SignLabel>
                          Kunde: {view.customer.name}
                          <br />
                          {view.signer_name}
                        </SignLabel>
                      </div>
                    </div>
                  </article>

                  {/* SEPA-Mandat */}
                  {view.sepa_required && (
                    <article className={PAPER}>
                      <DocHead eyebrow="Zahlung" title="SEPA-Lastschriftmandat" />
                      <p className="mt-1 text-[13px] text-[#676159]">für SEPA-Basislastschriften · wiederkehrende Zahlungen</p>
                      <dl className="mt-5 divide-y divide-[#e2e0dc] rounded-lg border border-[#e2e0dc] px-4 text-[13px]">
                        {(
                          [
                            ["Zahlungsempfänger", `${view.company.name}, ${view.company.street}, ${view.company.zip} ${view.company.city}`],
                            ["Gläubiger-ID", view.company.creditor_id || "–"],
                            ["Mandatsreferenz", "wird mit der Unterschrift vergeben"],
                          ] as const
                        ).map(([label, value]) => (
                          <div key={label} className="flex flex-col gap-0.5 py-2 sm:flex-row sm:gap-4">
                            <dt className="w-40 shrink-0 text-[11px] tracking-[0.1em] text-[#676159] uppercase sm:pt-0.5">{label}</dt>
                            <dd>{value}</dd>
                          </div>
                        ))}
                      </dl>
                      <div className="mt-5 text-[13px] leading-relaxed">
                        {SEPA_TEXT.replaceAll("{Gläubiger}", view.company.name)
                          .split("\n")
                          .map((p, i) => (
                            <p key={i} className={cn("mb-2", i && "text-[#676159]")}>
                              {p}
                            </p>
                          ))}
                      </div>
                      <div className="mt-4 grid gap-3 sm:grid-cols-2">
                        <PaperField label="Kontoinhaber" className="sm:col-span-2">
                          <input
                            id="sepa-holder"
                            value={sepa.holder}
                            onChange={(e) => setSepa({ ...sepa, holder: e.target.value })}
                            autoComplete="organization"
                            className={cn(PAPER_INPUT, target === "sepa-holder" && !sepa.holder.trim() && "border-[#2b2926] ring-4 ring-[#afaaa0]/50")}
                          />
                        </PaperField>
                        <PaperField label="Straße" className="sm:col-span-2">
                          <input value={sepa.street} onChange={(e) => setSepa({ ...sepa, street: e.target.value })} autoComplete="street-address" className={PAPER_INPUT} />
                        </PaperField>
                        <PaperField label="PLZ">
                          <input value={sepa.zip} onChange={(e) => setSepa({ ...sepa, zip: e.target.value })} autoComplete="postal-code" className={PAPER_INPUT} />
                        </PaperField>
                        <PaperField label="Ort">
                          <input value={sepa.city} onChange={(e) => setSepa({ ...sepa, city: e.target.value })} autoComplete="address-level2" className={PAPER_INPUT} />
                        </PaperField>
                        <PaperField label="IBAN" className="sm:col-span-2" hint={sepa.iban && !ibanOk ? "Diese IBAN ist ungültig – bitte prüfen." : undefined}>
                          <input
                            id="sepa-iban"
                            value={sepa.iban}
                            onChange={(e) => setSepa({ ...sepa, iban: formatIban(e.target.value) })}
                            placeholder="DE00 0000 0000 0000 0000 00"
                            autoComplete="off"
                            className={cn(
                              PAPER_INPUT,
                              "font-medium tracking-wide",
                              sepa.iban && !ibanOk && "border-[#c0392b]",
                              target === "sepa-iban" && !ibanOk && "border-[#2b2926] ring-4 ring-[#afaaa0]/50"
                            )}
                          />
                        </PaperField>
                        <PaperField label="BIC (optional)">
                          <input value={sepa.bic} onChange={(e) => setSepa({ ...sepa, bic: e.target.value.toUpperCase() })} className={PAPER_INPUT} />
                        </PaperField>
                        <PaperField label="Kreditinstitut (optional)">
                          <input value={sepa.bank} onChange={(e) => setSepa({ ...sepa, bank: e.target.value })} className={PAPER_INPUT} />
                        </PaperField>
                      </div>
                      <div className="mt-8 grid gap-6 sm:grid-cols-2">
                        <div className="flex flex-col justify-end">
                          <p className="border-b border-[#2b2926] pb-1 text-[13px]">
                            {sepa.city || view.customer.city}, {new Date().toLocaleDateString("de-DE")}
                          </p>
                          <SignLabel>Ort, Datum</SignLabel>
                        </div>
                        <div>
                          {field("sepa")}
                          <SignLabel>Unterschrift Kontoinhaber · {sepa.holder || view.signer_name}</SignLabel>
                        </div>
                      </div>
                    </article>
                  )}

                  {signError && <p className="rounded-2xl bg-error/10 px-4 py-3 text-[13px] text-error">{signError}</p>}
                  <div id="fertigstellen" className="flex flex-wrap items-center gap-3 pb-6">
                    <Button
                      variant="primary"
                      icon={<ShieldCheck className="h-4 w-4" />}
                      disabled={!complete}
                      loading={signing}
                      loadingText="Wird abgeschlossen …"
                      onClick={sign}
                    >
                      Fertigstellen
                    </Button>
                    <Button variant="ghost" onClick={() => go("erstellen")}>
                      Unterschrift ändern
                    </Button>
                    <p className="flex basis-full items-center gap-1.5 text-[12px] text-snow/45">
                      <Lock className="h-3.5 w-3.5 shrink-0" />
                      Nach dem Fertigstellen wird die Mappe versiegelt; jede spätere Änderung wäre erkennbar.
                    </p>
                  </div>
                </div>
              </div>
            )}
          </>
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

function DocHead({ eyebrow, title }: { eyebrow: string; title: string }) {
  return (
    <div className="flex items-start justify-between gap-4">
      <div>
        <p className="text-[10px] tracking-[0.25em] text-[#676159] uppercase">{eyebrow}</p>
        <h2 className="mt-1 text-2xl font-medium tracking-tight">
          {title}
          <span className="text-[#afaaa0]">.</span>
        </h2>
      </div>
      <FileText className="mt-1 h-5 w-5 shrink-0 text-[#afaaa0]" />
    </div>
  );
}

function SignLabel({ children }: { children: React.ReactNode }) {
  return <p className="mt-1.5 text-[11px] leading-snug text-[#676159]">{children}</p>;
}

function PaperField({ label, hint, className, children }: { label: string; hint?: string; className?: string; children: React.ReactNode }) {
  return (
    <label className={cn("flex flex-col gap-1", className)}>
      <span className="text-[11px] font-medium text-[#676159]">{label}</span>
      {children}
      {hint && <span className="text-[11px] text-[#c0392b]">{hint}</span>}
    </label>
  );
}

/** Gesetzte elektronische Unterschrift: Klammer, Bild, Prüf-ID */
function Stamp({ image, verifyId }: { image: string; verifyId: string }) {
  return (
    <div className="relative flex h-[78px] w-[250px] max-w-full flex-col justify-between py-px pl-3 text-[#2b2926]">
      <span aria-hidden className="absolute top-[5px] bottom-[5px] left-0 w-5 rounded-l-lg border-y-[1.5px] border-l-[1.5px] border-[#2b2926]" />
      <span className="ml-4 text-[9px] leading-none tracking-wide text-[#676159]">Elektronisch unterschrieben · GRID sign</span>
      {/* eslint-disable-next-line @next/next/no-img-element -- data-URL der Unterschrift */}
      <img src={image} alt="Unterschrift" className="h-[46px] w-full object-contain object-left" />
      <span className="ml-4 font-mono text-[10px] leading-none">{verifyId}</span>
    </div>
  );
}

/** Unterschriftsfeld: markiert, bis es angeklickt wird; danach die Unterschrift mit Prüf-ID */
function SignHere({
  field,
  verifyId,
  image,
  active,
  onSign,
  onClear,
}: {
  field: SignField;
  verifyId?: string;
  image: string | null;
  active: boolean;
  onSign: () => void;
  onClear: () => void;
}) {
  return (
    <div id={`feld-${field}`} className="scroll-mt-28">
      {verifyId && image ? (
        <button type="button" onClick={onClear} title="Unterschrift entfernen" className="group relative block rounded-md text-left">
          <Stamp image={image} verifyId={verifyId} />
          <span className="absolute -top-2 right-0 hidden rounded-full bg-[#2b2926] px-2 py-0.5 text-[10px] text-white group-hover:block group-focus-visible:block">
            Entfernen
          </span>
        </button>
      ) : (
        <button
          type="button"
          onClick={onSign}
          aria-label={`Unterschreiben: ${SIGN_FIELD_LABEL[field]}`}
          className={cn(
            "relative flex h-[78px] w-[250px] max-w-full items-center gap-3 rounded-lg border-2 border-dashed border-[#2b2926]/45 bg-[#f2f1ef] px-3 text-left transition hover:border-[#2b2926] hover:bg-[#ebe9e5]",
            active && "border-[#2b2926] ring-4 ring-[#afaaa0]/60"
          )}
        >
          <span className={cn("flex shrink-0 items-center gap-1.5 rounded-full bg-[#2b2926] px-3 py-1.5 text-[12px] font-medium text-white", active && "animate-pulse")}>
            <PenLine className="h-3.5 w-3.5" />
            Unterschreiben
          </span>
          <span className="min-w-0 text-[11px] leading-tight [overflow-wrap:anywhere] hyphens-auto text-[#676159]">{SIGN_FIELD_LABEL[field]}</span>
        </button>
      )}
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
