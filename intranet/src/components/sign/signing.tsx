"use client";

import { useEffect, useState } from "react";
import { ArrowDown, Check, FileText, Lock, Mail, PenLine, ShieldCheck } from "lucide-react";
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
  signer_email: string;
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
const PAPER = "rise-in rounded-2xl bg-white px-5 py-7 text-[#2b2926] shadow-[0_1px_2px_rgba(0,0,0,0.10),0_10px_30px_rgba(0,0,0,0.10)] md:px-12 md:py-12";
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
  function next(current = stamps) {
    const open: string | undefined = fields
      .flatMap((f) => (f === "sepa" ? [!sepa.holder.trim() && "sepa-holder", !ibanOk && "sepa-iban", !current.sepa && "feld-sepa"] : [!current[f] && `feld-${f}`]))
      .find((id): id is string => !!id);
    const id = open ?? "fertigstellen";
    const element = document.getElementById(id);
    element?.scrollIntoView({ behavior: "smooth", block: "center" });
    if (element instanceof HTMLInputElement) element.focus({ preventScroll: true });
    setTarget(id);
  }

  /** Unterschrift setzen und – nach kurzer Animation – zur nächsten Stelle springen */
  function stamp(field: SignField) {
    const updated = { ...stamps, [field]: newVerifyId() };
    setStamps(updated);
    setTarget(null);
    window.setTimeout(() => next(updated), 650);
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
    <div className="relative min-h-dvh overflow-x-clip bg-sky text-snow">
      {/* Hintergrund wie auf der Website: Aurora, die langsam driftet, und feines Grid */}
      <div aria-hidden className="pointer-events-none fixed inset-0">
        <div className="login-aurora aurora absolute -inset-[10%]" />
        <div className="sign-grid absolute inset-x-0 top-0 h-[40rem]" />
      </div>

      <header className="sticky top-0 z-30 px-3 pt-3 md:px-6">
        <div className="glass mx-auto flex h-14 max-w-5xl items-center justify-between rounded-full pr-2 pl-5">
          <a href="https://grid-agency.de" className="group flex items-center gap-3" aria-label="GRID Agency">
            <span className="logo-rainbow">
              <Logo className="h-5" priority />
            </span>
            <span className="rounded-full border border-snow/15 px-2.5 py-0.5 text-[11px] tracking-[0.2em] text-snow/60 uppercase">sign</span>
          </a>
          {view && !["widerrufen", "unterschrieben"].includes(view.status) && (
            <a
              href={pdf}
              target="_blank"
              rel="noopener"
              className="flex h-10 items-center gap-1.5 rounded-full border border-snow/12 bg-snow/[0.06] px-4 text-[13px] text-snow/80 transition-colors hover:bg-snow/[0.12] hover:text-snow"
            >
              <FileText className="h-4 w-4" />
              <span className="hidden sm:inline">Alle Unterlagen als PDF</span>
              <span className="sm:hidden">PDF</span>
            </a>
          )}
        </div>
      </header>

      <main className="relative mx-auto max-w-5xl px-4 pt-10 pb-16 md:px-6 md:pt-14">
        {error ? (
          <Message title="Dieser Link funktioniert nicht." text={`${error} Bitte wenden Sie sich an GRID AGENCY.`} />
        ) : !view ? (
          <div className="grid h-60 place-items-center">
            <Spinner />
          </div>
        ) : view.status === "unterschrieben" ? (
          <Done view={view} />
        ) : view.status === "abgelehnt" ? (
          <Message title="Sie haben die Unterlagen abgelehnt." text={`${view.grid_signer} von ${view.company.name} ist informiert und meldet sich bei Ihnen.`} />
        ) : view.status === "widerrufen" ? (
          <Message title="Diese Unterlagen sind nicht mehr aktuell." text={`${view.company.name} hat Ihnen eine neuere Fassung geschickt. Bitte nutzen Sie den Link aus der neuesten E-Mail.`} />
        ) : view.status === "abgelaufen" ? (
          <Message title="Der Link ist abgelaufen." text={`Bitte fordern Sie bei ${view.company.name} (${view.company.email}) einen neuen Link an.`} />
        ) : (
          <>
            {/* Schritte */}
            <ol aria-label="Schritte" className="glass rise-in mb-10 inline-flex max-w-full gap-1 overflow-x-auto rounded-full p-1">
              {STEPS.map((s, i) => (
                <li key={s.id} className="shrink-0">
                  <span
                    aria-current={s.id === step ? "step" : undefined}
                    className={cn(
                      "flex h-9 items-center gap-2 rounded-full px-3 text-[13px]",
                      "transition-colors duration-300",
                      s.id === step ? "bg-snow font-medium text-sky" : i < index ? "text-snow/75" : "text-snow/40"
                    )}
                  >
                    <span
                      style={s.id === step ? { backgroundImage: "var(--aurora)" } : undefined}
                      className={cn(
                        "grid h-5 w-5 place-items-center rounded-full text-[10px]",
                        i < index ? "bg-success/20 text-success" : s.id === step ? "text-snow" : "border border-snow/20"
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
                  <span className="sign-eyebrow rise-in">{view.offer.label}</span>
                  <h1 className="rise-in mt-5 text-[2.5rem] leading-[1.02] font-semibold tracking-[-0.035em] md:text-6xl" style={{ "--delay": "80ms" } as React.CSSProperties}>
                    Für <span className="text-aurora">{view.customer.name.replace(/\.$/, "")}</span>.
                  </h1>
                  <p className="rise-in mt-4 text-[13px] text-snow/55" style={{ "--delay": "160ms" } as React.CSSProperties}>
                    von {view.grid_signer}, {view.company.name} · vom {date(view.offer.date)}
                    {view.offer.valid_until ? ` · gültig bis ${date(view.offer.valid_until)}` : ""}
                  </p>
                </div>
                {view.offer.intro && (
                  <p className="rise-in max-w-2xl text-[15px] leading-relaxed whitespace-pre-line text-snow/75" style={{ "--delay": "220ms" } as React.CSSProperties}>
                    {view.offer.intro}
                  </p>
                )}
                <ul className="glass rise-in divide-y divide-snow/[0.08] overflow-hidden rounded-3xl" style={{ "--delay": "280ms" } as React.CSSProperties}>
                  {view.offer.items.map((item, i) =>
                    item.kind === "text" ? (
                      <li key={i} className="px-4 py-3 text-[13px] whitespace-pre-line text-snow/60">
                        {item.description}
                      </li>
                    ) : (
                      <li key={i} className="flex gap-4 px-5 py-4 transition-colors hover:bg-snow/[0.03]">
                        <div className="min-w-0 flex-1">
                          <p className="text-[15px] font-medium">{item.description.split("\n")[0]}</p>
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
                <div className="rise-in grid gap-3 sm:grid-cols-[1fr_minmax(0,18rem)]" style={{ "--delay": "340ms" } as React.CSSProperties}>
                  <div className="glass rounded-3xl p-5 text-[13px] leading-relaxed text-snow/65">
                    <p className="text-[11px] tracking-[0.2em] text-snow/50 uppercase">Zahlungsart</p>
                    <p className="mt-1 text-[15px] font-medium text-snow">{view.sepa_required ? "SEPA-Lastschrift" : "Überweisung"}</p>
                    <p className="mt-1">
                      {view.sepa_required
                        ? "Die Rechnungsbeträge ziehen wir per SEPA-Basislastschrift ein. Das Mandat unterschreiben Sie mit dem Vertrag."
                        : "Sie erhalten Rechnungen per E-Mail und überweisen den Betrag."}
                    </p>
                  </div>
                  <dl className="glass relative overflow-hidden rounded-3xl p-5 text-[13px] text-snow">
                    <div aria-hidden className="absolute -inset-px opacity-25" style={{ backgroundImage: "var(--aurora)" }} />
                    <div className="relative flex justify-between text-snow/60">
                      <dt>Netto</dt>
                      <dd className="tabular-nums">{money(view.offer.amount_net, view.offer.currency)}</dd>
                    </div>
                    <div className="relative mt-1 flex justify-between text-snow/60">
                      <dt>USt</dt>
                      <dd className="tabular-nums">{money(view.offer.amount_vat, view.offer.currency)}</dd>
                    </div>
                    <div className="relative mt-3 flex items-baseline justify-between">
                      <dt className="text-[11px] tracking-[0.2em] text-snow/50 uppercase">Gesamt</dt>
                      <dd className="text-2xl font-semibold tracking-tight tabular-nums">{money(view.offer.amount_gross, view.offer.currency)}</dd>
                    </div>
                  </dl>
                </div>
                <div className="rise-in flex flex-wrap gap-2" style={{ "--delay": "400ms" } as React.CSSProperties}>
                  <Button variant="primary" className="h-12 px-6 text-[15px]" icon={<Check className="h-4 w-4" />} loading={accepting} loadingText="Einen Moment …" onClick={accept}>
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
                  <span className="sign-eyebrow rise-in">Schritt 2 von 3</span>
                  <h2 className="rise-in mt-5 text-4xl leading-[1.05] font-semibold tracking-[-0.03em] md:text-5xl" style={{ "--delay": "80ms" } as React.CSSProperties}>
                    Unterschrift <span className="text-aurora">erstellen</span>.
                  </h2>
                  <p className="mt-2 text-[14px] leading-relaxed text-snow/65">
                    Sie erstellen Ihre Unterschrift einmal und setzen sie dann mit einem Klick an jeder markierten Stelle. Jede gesetzte Unterschrift bekommt eine
                    eigene Prüf-ID.
                  </p>
                </div>
                <div className="glass rise-in rounded-3xl p-5" style={{ "--delay": "160ms" } as React.CSSProperties}>
                  <p className="mb-3 text-[13px] text-snow/60">
                    Unterschrift von <span className="text-snow">{view.signer_name}</span>
                  </p>
                  <SignaturePad onChange={setSignature} name={view.signer_name} />
                </div>
                <div className="flex flex-col gap-2">
                  <p className="text-[11px] tracking-[0.2em] text-snow/50 uppercase">Vorschau</p>
                  <div className="w-fit rounded-2xl bg-white px-5 py-3 shadow-[0_10px_40px_rgb(0_0_0/0.25)]">
                    {signature ? <Stamp image={signature} verifyId="XXXX-XXXX-XXXX-XXXX" /> : <p className="py-6 text-[13px] text-[#8c867c]">Noch keine Unterschrift</p>}
                  </div>
                </div>
                <label className="glass flex cursor-pointer items-start gap-3 rounded-3xl p-5 text-[13px] leading-relaxed text-snow/75">
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
                <div className="glass sticky top-[4.75rem] z-20 flex flex-wrap items-center gap-x-4 gap-y-2 rounded-3xl px-4 py-3 md:px-5">
                  <div className="min-w-0 flex-1">
                    <p className="text-[13px] text-snow/80">
                      <span className="hidden sm:inline">
                        {complete ? "Alles unterschrieben. Bitte fertigstellen." : "Klicken Sie auf jedes markierte Feld, um zu unterschreiben."}
                      </span>
                      <span className="sm:hidden">{complete ? "Bereit zum Fertigstellen" : "Felder unterschreiben"}</span>
                    </p>
                    <div className="mt-1.5 flex items-center gap-2 whitespace-nowrap">
                      <div className="h-1.5 w-24 overflow-hidden rounded-full bg-snow/10 sm:w-48">
                        <div
                          className="h-full rounded-full transition-[width] duration-700 ease-out"
                          style={{ width: `${(done / fields.length) * 100}%`, backgroundImage: "var(--aurora)", backgroundSize: "200% 100%" }}
                        />
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
                    <Button variant="primary" icon={<ArrowDown className="h-4 w-4" />} onClick={() => next()}>
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

      <SiteFooter />

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
    <div className="stamp-in relative flex h-[78px] w-[250px] max-w-full flex-col justify-between py-px pl-3 text-[#2b2926]">
      <span aria-hidden className="absolute top-[5px] bottom-[5px] left-0 w-5 rounded-l-lg border-y-[1.5px] border-l-[1.5px] border-[#2b2926]" />
      <span className="ml-4 text-[9px] leading-none tracking-wide text-[#676159]">Elektronisch unterschrieben · GRID sign</span>
      {/* eslint-disable-next-line @next/next/no-img-element -- data-URL der Unterschrift */}
      <img src={image} alt="Unterschrift" className="ink-in h-[46px] w-full object-contain object-left" />
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
            active && "field-glow border-[#2b2926]"
          )}
        >
          <span
            style={active ? { backgroundImage: "var(--aurora)", backgroundSize: "200% 100%" } : undefined}
            className={cn("flex shrink-0 items-center gap-1.5 rounded-full bg-[#2b2926] px-3 py-1.5 text-[12px] font-medium text-white", active && "animate-[rainbow-slide_1.6s_linear_infinite]")}
          >
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
    <div className="glass rise-in mx-auto max-w-xl rounded-3xl px-6 py-14 text-center">
      <h1 className="text-2xl font-semibold tracking-tight md:text-3xl">{title}</h1>
      <p className="mt-3 text-[15px] text-snow/65">{text}</p>
    </div>
  );
}

// Konfetti in den Aurora-Farben; Position, Drehung und Tempo je Stück fest verteilt
const CONFETTI = Array.from({ length: 56 }, (_, i) => ({
  x: (i * 37) % 100,
  delay: (i % 14) * 90,
  duration: 2600 + ((i * 53) % 1400),
  rotate: (i * 47) % 360,
  drift: ((i * 29) % 120) - 60,
  color: ["#feda75", "#fa7e1e", "#d62976", "#962fbf", "#4f5bd5"][i % 5],
  wide: i % 3 === 0,
}));

/** Abschluss: große Erfolgsanimation, Unterlagen kommen per Mail */
function Done({ view }: { view: View }) {
  const docs = [view.offer.label, view.contract.title, ...(view.sepa_required ? ["SEPA-Lastschriftmandat"] : [])];
  const first = view.signer_name.split(" ")[0];
  return (
    <div className="relative">
      {/* Konfetti über die ganze Seite */}
      <div aria-hidden className="pointer-events-none fixed inset-0 z-40 overflow-hidden">
        {CONFETTI.map((c, i) => (
          <span
            key={i}
            className="confetti absolute top-0 block rounded-[2px]"
            style={
              {
                left: `${c.x}%`,
                width: c.wide ? 12 : 7,
                height: c.wide ? 6 : 12,
                background: c.color,
                "--delay": `${c.delay}ms`,
                "--duration": `${c.duration}ms`,
                "--rotate": `${c.rotate}deg`,
                "--drift": `${c.drift}px`,
              } as React.CSSProperties
            }
          />
        ))}
      </div>

      <div className="glass relative mx-auto max-w-3xl overflow-hidden rounded-[2.25rem] px-6 pt-16 pb-14 text-center md:px-14 md:pt-20">
        <div aria-hidden className="login-aurora aurora absolute -inset-[20%]" />

        {/* Haken mit Lichtringen */}
        <div className="relative mx-auto h-32 w-32">
          <span className="success-ring absolute inset-0 rounded-full" style={{ backgroundImage: "var(--aurora)" }} />
          <span className="success-ring absolute inset-0 rounded-full" style={{ backgroundImage: "var(--aurora)", "--delay": "1.1s" } as React.CSSProperties} />
          <span className="success-core absolute inset-3 rounded-full" style={{ backgroundImage: "var(--aurora)", backgroundSize: "200% 100%" }} />
          <svg viewBox="0 0 80 80" className="relative h-32 w-32 text-white" aria-hidden>
            <path
              d="M24 41 l11 11 l22 -24"
              fill="none"
              stroke="currentColor"
              strokeWidth="6"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="draw"
              style={{ "--length": 50, "--delay": "550ms" } as React.CSSProperties}
            />
          </svg>
        </div>

        <span className="sign-eyebrow rise-in relative mt-9" style={{ "--delay": "650ms" } as React.CSSProperties}>
          Unterschrieben und versiegelt
        </span>
        <h1
          className="rise-in relative mt-5 text-[2.6rem] leading-[1] font-semibold tracking-[-0.04em] md:text-7xl"
          style={{ "--delay": "750ms" } as React.CSSProperties}
        >
          Willkommen bei GRID,
          <br />
          <span className="text-aurora">{first}!</span>
        </h1>
        <p className="rise-in relative mx-auto mt-6 max-w-xl text-lg leading-relaxed text-snow/75 md:text-xl" style={{ "--delay": "900ms" } as React.CSSProperties}>
          Wir freuen uns riesig auf die Zusammenarbeit mit {view.customer.name.replace(/\.$/, "")}.
        </p>

        {/* Unterlagen fliegen ins Postfach */}
        <div className="rise-in relative mx-auto mt-10 max-w-md" style={{ "--delay": "1050ms" } as React.CSSProperties}>
          <p className="text-center text-[13px] text-snow/60">
            <Mail className="mail-fly mr-1.5 inline-block h-4 w-4 align-[-3px] text-snow" />
            Kommt gleich per E-Mail an <span className="text-snow/85">{view.signer_email}</span>
          </p>
          <ul className="mt-4 flex flex-col gap-2 text-left">
            {docs.map((label, i) => (
              <li
                key={label}
                className="rise-in flex items-center gap-3 rounded-2xl border border-snow/10 bg-snow/[0.06] px-4 py-3 text-[14px] backdrop-blur"
                style={{ "--delay": `${1150 + i * 120}ms` } as React.CSSProperties}
              >
                <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-success/15 text-success">
                  <Check className="h-4 w-4" />
                </span>
                <span className="min-w-0 flex-1 truncate">{label}</span>
                <span className="text-[11px] text-snow/45">PDF · versiegelt</span>
              </li>
            ))}
          </ul>
        </div>

        <p className="rise-in relative mt-10 text-[13px] text-snow/50" style={{ "--delay": "1600ms" } as React.CSSProperties}>
          Als Nächstes melden wir uns für den Kick-off. Bis gleich!
        </p>
      </div>
    </div>
  );
}

const FOOTER_LINKS: { title: string; links: [string, string][] }[] = [
  {
    title: "Agentur",
    links: [
      ["Leistungen", "https://grid-agency.de/#leistungen"],
      ["Projekte", "https://grid-agency.de/projekte"],
      ["Events", "https://grid-agency.de/events"],
      ["Jobs", "https://grid-agency.de/jobs"],
      ["FAQ", "https://grid-agency.de/faq"],
    ],
  },
  {
    title: "Kontakt",
    links: [
      ["Erstgespräch buchen", "https://grid-agency.de/termin"],
      ["hello@grid-agency.de", "mailto:hello@grid-agency.de"],
    ],
  },
  {
    title: "Rechtliches",
    links: [
      ["Impressum", "https://grid-agency.de/impressum"],
      ["Datenschutz", "https://grid-agency.de/datenschutz"],
      ["AGB", "https://grid-agency.de/agb"],
    ],
  },
];

/** Footer wie auf der Website: Marke, Standorte, Navigation, Rechtliches */
function SiteFooter() {
  return (
    <footer className="relative mx-auto w-full max-w-5xl px-4 pt-6 pb-10 md:px-6">
      <div className="glass rounded-[2rem] p-7 md:p-10">
        <div className="grid grid-cols-1 gap-10 md:grid-cols-[minmax(0,2fr)_repeat(3,minmax(0,1fr))]">
          <div>
            <Logo className="h-6" />
            <p className="mt-4 max-w-xs text-sm font-light leading-relaxed text-snow/55">Social-Media-Agentur für Marken, die man nicht wegscrollen kann.</p>
            <p className="mt-4 text-xs font-light leading-relaxed text-snow/40">
              Sömmeringstraße 37, 10589 Berlin
              <br />
              Eichendorffstraße 32, 60320 Frankfurt am Main
            </p>
          </div>
          {FOOTER_LINKS.map((col) => (
            <nav key={col.title} aria-label={col.title}>
              <p className="text-xs font-medium tracking-[0.2em] text-snow/40 uppercase">{col.title}</p>
              <ul className="mt-4 space-y-2.5 text-sm font-light text-snow/70">
                {col.links.map(([label, href]) => (
                  <li key={label}>
                    <a href={href} className="nav-rainbow transition-colors hover:text-snow">
                      {label}
                    </a>
                  </li>
                ))}
              </ul>
            </nav>
          ))}
        </div>
        <div className="mt-10 flex flex-col gap-2 border-t border-snow/10 pt-6 text-xs font-light text-snow/35 sm:flex-row sm:justify-between">
          <p>© {new Date().getFullYear()} GRID Agency UG (haftungsbeschränkt) · sign.grid-agency.de</p>
          <p>Made with ♥ in Berlin &amp; Frankfurt</p>
        </div>
      </div>
    </footer>
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
