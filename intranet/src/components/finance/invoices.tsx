"use client";

import { useCallback, useEffect, useMemo, useReducer, useState } from "react";
import Link from "next/link";
import { clsx } from "clsx";
import { ArrowLeft, ArrowRight, CalendarClock, Check, CheckCheck, FileText, Inbox, Plus, Search, Send, Undo2, X, XCircle } from "lucide-react";
import { FINANCE_MAILBOX, mailboxLabel } from "@/lib/config";
import { createRow, deleteRow, updateRow, useResource, useRows } from "@/lib/data";
import { formatDate, relativeTime } from "@/lib/format";
import { api, apiFetch } from "@/lib/api";
import { graphErrorMessage, graphFor, type FileAttachment } from "@/lib/graph";
import {
  INVOICE_CATEGORIES,
  INVOICE_STAGES,
  PAYMENT_METHODS,
  topPosition,
  type Invoice,
  type InvoiceStage,
  type PaymentMethod,
  type Settings,
} from "@/lib/sales/types";
import { Board, BoardCard } from "@/components/board";
import { Button, Dialog, Empty, Field, Input, Select, Sheet, Spinner, Textarea, useToast } from "@/components/ui";
import { Attachments, MailBody } from "@/components/sales/mail/reading-pane";
import { PageBar } from "@/components/sales/shell";

const money = (amount: number | null, currency = "EUR") =>
  amount === null ? "–" : new Intl.NumberFormat("de-DE", { style: "currency", currency }).format(amount);

const overdue = (invoice: Invoice) =>
  invoice.stage !== "datev" && !!invoice.due_date && new Date(`${invoice.due_date}T23:59:59`) < new Date();

/** Ein Klick: freigeben und die Belege der Rechnungsmail von buchhaltung@ an
 * die DATEV-Upload-Adresse (DATEV Unternehmen online) schicken. Manuell
 * erfasste Rechnungen ohne Mail werden nur freigegeben. */
async function release(invoice: Invoice, datevAddress: string): Promise<"datev" | "freigegeben"> {
  if (!invoice.mailbox || !invoice.graph_id) {
    await updateRow<Invoice>("invoices", invoice.id, { stage: "freigegeben", position: topPosition() });
    return "freigegeben";
  }
  if (!datevAddress) throw new Error("Keine DATEV-Upload-Adresse hinterlegt");
  // Belege per App-Zugriff vom Server, damit es nicht auf den Postfachzugriff der Person ankommt
  const files = await api<FileAttachment[]>(`/api/finance/belege/${invoice.id}?alle=1`);
  if (!files.length) throw new Error("Die Mail hat keine Dateianhänge");
  const subject = [invoice.vendor, invoice.invoice_number].filter(Boolean).join(" · ");
  await graphFor(FINANCE_MAILBOX).send({ to: [datevAddress], cc: [], subject: subject || "Eingangsrechnung", body: "" }, files);
  await updateRow<Invoice>("invoices", invoice.id, { stage: "datev", position: topPosition() });
  return "datev";
}

const releasedText = (invoice: Invoice, result: "datev" | "freigegeben") =>
  result === "datev" ? `${invoice.vendor}: an DATEV gesendet` : `${invoice.vendor}: freigegeben (kein Beleg, nicht an DATEV)`;

/** Fällige zuerst, Rechnungen ohne Fälligkeit nach Eingang */
const byDue = (a: Invoice, b: Invoice) =>
  (a.due_date ?? "9999").localeCompare(b.due_date ?? "9999") ||
  (a.received_at ?? a.created_at).localeCompare(b.received_at ?? b.created_at);

type View = "freigabe" | "alle";

/** Eingangsrechnungen: „Zur Freigabe“ ist eine Liste mit Beleg-Vorschau, in
 * der ein Klick auf „Freigeben“ die Rechnung direkt an DATEV schickt.
 * „Alle Rechnungen“ zeigt das Board Neu → Freigegeben → An DATEV gesendet. */
export function Invoices() {
  const { data: invoices, loading, error } = useRows<Invoice>("invoices");
  const { data: settings } = useResource<Settings>("/api/sales/settings");
  const toast = useToast();
  const [view, setView] = useState<View>("freigabe");
  const [query, setQuery] = useState("");
  const [openId, setOpenId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (invoices ?? []).filter(
      (i) => i.stage !== "abgelehnt" && (!q || [i.vendor, i.invoice_number, i.description].some((v) => v?.toLowerCase().includes(q)))
    );
  }, [invoices, query]);

  const open = visible.filter((i) => i.stage !== "datev");
  const openSum = open.reduce((sum, i) => sum + (i.amount ?? 0), 0);
  const late = open.filter(overdue).length;

  async function move(invoice: Invoice, stage: string, position: number) {
    try {
      await updateRow<Invoice>("invoices", invoice.id, { stage: stage as InvoiceStage, position });
      if (stage === "freigegeben" && invoice.stage === "neu") toast("Freigegeben – an DATEV senden in der Rechnung");
    } catch {
      toast("Verschieben fehlgeschlagen", "error");
    }
  }

  return (
    <div className="flex h-full flex-col">
      <PageBar
        title="Eingangsrechnungen"
        meta={
          invoices && (
            <>
              {open.length} offen · {money(openSum)}
              {late > 0 && <span className="text-error"> · {late} überfällig</span>}
            </>
          )
        }
      >
        <div className="flex shrink-0 rounded-full bg-snow/[0.06] p-1" role="tablist" aria-label="Ansicht">
          {(
            [
              ["freigabe", "Zur Freigabe"],
              ["alle", "Alle Rechnungen"],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              role="tab"
              aria-selected={view === id}
              onClick={() => setView(id)}
              className={clsx(
                "inline-flex h-7 items-center gap-1.5 rounded-full px-3 text-[13px] font-medium transition-colors",
                view === id ? "bg-snow text-sky" : "text-snow/65 hover:text-snow"
              )}
            >
              {label}
              {id === "freigabe" && invoices && (
                <span className={clsx("rounded-full px-1.5 text-[11px] tabular-nums", view === id ? "bg-sky/15" : "bg-snow/10")}>
                  {visible.filter((i) => i.stage === "neu").length}
                </span>
              )}
            </button>
          ))}
        </div>
        <div className="relative hidden min-w-0 flex-1 md:block md:max-w-56">
          <Search className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-snow/40" />
          <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Suchen" aria-label="Rechnungen durchsuchen" className="h-9 w-full pl-9" />
        </div>
        <Button variant="primary" size="sm" className="h-9" icon={<Plus className="h-4 w-4" />} onClick={() => setCreating(true)} aria-label="Rechnung erfassen">
          <span className="hidden md:inline">Rechnung erfassen</span>
        </Button>
      </PageBar>

      {settings && !settings.datev.upload_address && (
        <p className="border-b border-snow/[0.08] bg-[#e7a33e]/10 px-5 py-2 text-[13px] text-snow/80">
          Noch keine DATEV-Upload-Adresse hinterlegt.{" "}
          <Link href="/finance/einstellungen" className="underline">
            Jetzt eintragen
          </Link>
        </p>
      )}

      {error ? (
        <Empty title="Rechnungen konnten nicht geladen werden" text={error.message} />
      ) : loading ? (
        <div className="grid flex-1 place-items-center">
          <Spinner />
        </div>
      ) : view === "freigabe" ? (
        <ApprovalQueue
          invoices={visible}
          datevAddress={settings?.datev.upload_address ?? ""}
          onDetails={setOpenId}
          blocked={!!openId || creating}
        />
      ) : (
        <Board
          columns={INVOICE_STAGES}
          items={visible}
          onOpen={setOpenId}
          onMove={move}
          // Nach DATEV nur über „An DATEV senden“, gesendete bleiben dort
          canDrop={(invoice, stage) => stage !== "datev" && invoice.stage !== "datev"}
          onAdd={() => setCreating(true)}
          addLabel="Rechnung erfassen"
          summary={(items) => {
            const sum = items.reduce((s, i) => s + (i.amount ?? 0), 0);
            return sum > 0 ? money(sum) : null;
          }}
          renderCard={(invoice, overlay) => <InvoiceCard invoice={invoice} overlay={overlay} />}
        />
      )}

      <InvoiceSheet id={openId} invoices={invoices ?? []} datevAddress={settings?.datev.upload_address ?? ""} onClose={() => setOpenId(null)} />
      <NewInvoiceDialog open={creating} onClose={() => setCreating(false)} onCreated={(id) => setOpenId(id)} />
    </div>
  );
}

/** Freigabe-Liste: links die neuen Rechnungen, rechts die gewählte mit Beleg.
 * „Freigeben“ (oder Pfeil rechts) schickt sie an DATEV und springt sofort zur
 * nächsten; der Versand läuft im Hintergrund weiter. */
function ApprovalQueue({
  invoices,
  datevAddress,
  onDetails,
  blocked,
}: {
  invoices: Invoice[];
  datevAddress: string;
  onDetails: (id: string) => void;
  /** Sheet oder Dialog offen: Tastenkürzel aus */
  blocked: boolean;
}) {
  const toast = useToast();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [sending, setSending] = useState<ReadonlySet<string>>(new Set());
  const [rejecting, setRejecting] = useState<Invoice | null>(null);
  const [rejectBusy, setRejectBusy] = useState(false);
  // Auf dem Handy: Liste oder Rechnung
  const [paneOpen, setPaneOpen] = useState(false);

  const queue = useMemo(() => invoices.filter((i) => i.stage === "neu").sort(byDue), [invoices]);
  const ready = queue.filter((i) => !sending.has(i.id));
  usePreloadBelege(queue);
  const selected = ready.find((i) => i.id === selectedId) ?? ready[0] ?? null;

  /** Nach Freigabe/Ablehnung die nächste Rechnung zeigen */
  const advance = useCallback(
    (invoice: Invoice) => {
      const index = ready.findIndex((i) => i.id === invoice.id);
      const next = ready[index + 1] ?? ready[index - 1];
      setSelectedId(next?.id ?? null);
      if (!next) setPaneOpen(false);
    },
    [ready]
  );

  const approve = useCallback(
    async (invoice: Invoice) => {
      advance(invoice);
      setSending((set) => new Set(set).add(invoice.id));
      try {
        toast(releasedText(invoice, await release(invoice, datevAddress)));
      } catch (error) {
        toast(`${invoice.vendor}: Senden fehlgeschlagen – ${graphErrorMessage(error)}`, "error");
      }
      setSending((set) => {
        const rest = new Set(set);
        rest.delete(invoice.id);
        return rest;
      });
    },
    [advance, datevAddress, toast]
  );

  async function reject(invoice: Invoice) {
    setRejectBusy(true);
    try {
      await updateRow<Invoice>("invoices", invoice.id, { stage: "abgelehnt" });
      advance(invoice);
      setRejecting(null);
      toast(`${invoice.vendor}: zurückgewiesen`);
    } catch {
      toast("Das hat nicht geklappt", "error");
    }
    setRejectBusy(false);
  }

  // Pfeil rechts = Freigeben, Pfeil hoch/runter = vorige/nächste Rechnung
  useEffect(() => {
    if (blocked || rejecting) return;
    function onKey(event: KeyboardEvent) {
      if (event.defaultPrevented || event.repeat || event.metaKey || event.ctrlKey || event.altKey || event.shiftKey) return;
      if ((event.target as HTMLElement).closest("input, textarea, select, [contenteditable=true]")) return;
      if (!selected) return;
      const index = ready.indexOf(selected);
      if (event.key === "ArrowRight") {
        event.preventDefault();
        approve(selected);
      } else if (event.key === "ArrowDown" || event.key === "ArrowUp") {
        const next = ready[index + (event.key === "ArrowDown" ? 1 : -1)];
        if (!next) return;
        event.preventDefault();
        setSelectedId(next.id);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [blocked, rejecting, selected, ready, approve]);

  if (!queue.length) {
    return (
      <Empty
        icon={<CheckCheck className="h-8 w-8" />}
        title="Alles freigegeben"
        text="Neue Rechnungen an buchhaltung@ landen automatisch hier."
      />
    );
  }

  return (
    <div className="flex min-h-0 flex-1">
      <aside
        className={clsx(
          "w-full shrink-0 overflow-y-auto border-snow/[0.08] p-3 md:block md:w-80 md:border-r",
          paneOpen && "hidden"
        )}
      >
        <p className="px-2 pt-2 pb-3 text-[11px] font-semibold tracking-[0.12em] text-snow/50 uppercase">
          {queue.length} zur Freigabe
        </p>
        <ul className="flex flex-col gap-1">
          {queue.map((invoice) => {
            const busy = sending.has(invoice.id);
            const active = !busy && invoice.id === selected?.id;
            return (
              <li key={invoice.id}>
                <button
                  type="button"
                  disabled={busy}
                  aria-busy={busy || undefined}
                  aria-current={active || undefined}
                  onClick={() => {
                    setSelectedId(invoice.id);
                    setPaneOpen(true);
                  }}
                  className={clsx(
                    "flex w-full items-center gap-3 rounded-2xl border px-3 py-2.5 text-left transition-colors",
                    active ? "border-snow/15 bg-snow/[0.08]" : "border-transparent hover:bg-snow/[0.05]",
                    busy && "cursor-progress opacity-60"
                  )}
                >
                  <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-snow/[0.06] text-snow/60">
                    {busy ? <Spinner className="h-4 w-4" /> : <FileText className="h-4 w-4" />}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[14px] font-medium">{invoice.vendor}</span>
                    <span className={clsx("block truncate text-[12px]", overdue(invoice) && !busy ? "text-error" : "text-snow/55")}>
                      {busy
                        ? "Wird an DATEV gesendet …"
                        : [money(invoice.amount, invoice.currency), invoice.due_date && `fällig ${formatDate(invoice.due_date)}`]
                            .filter(Boolean)
                            .join(" · ")}
                    </span>
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      </aside>

      <section className={clsx("min-w-0 flex-1 overflow-y-auto", !paneOpen && "hidden md:block")}>
        {selected ? (
          <ApprovalPane
            key={selected.id}
            invoice={selected}
            onApprove={() => approve(selected)}
            onReject={() => setRejecting(selected)}
            onDetails={() => onDetails(selected.id)}
            onBack={() => setPaneOpen(false)}
          />
        ) : (
          <div className="grid h-full place-items-center">
            <Spinner />
          </div>
        )}
      </section>

      <Dialog
        open={!!rejecting}
        onClose={() => setRejecting(null)}
        title="Rechnung zurückweisen?"
        footer={
          <>
            <Button variant="ghost" onClick={() => setRejecting(null)}>
              Abbrechen
            </Button>
            <Button variant="danger" loading={rejectBusy} loadingText="Wird zurückgewiesen …" onClick={() => rejecting && reject(rejecting)}>
              Zurückweisen
            </Button>
          </>
        }
      >
        <p className="text-sm text-snow/60">
          {rejecting?.vendor} geht nicht an DATEV und verschwindet aus der Freigabe. Die Mail bleibt im Postfach.
        </p>
      </Dialog>
    </div>
  );
}

function ApprovalPane({
  invoice,
  onApprove,
  onReject,
  onDetails,
  onBack,
}: {
  invoice: Invoice;
  onApprove: () => void;
  onReject: () => void;
  onDetails: () => void;
  onBack: () => void;
}) {
  const toast = useToast();
  const late = overdue(invoice);
  const facts: [string, React.ReactNode, boolean?][] = [
    ["Nr.", invoice.invoice_number ?? "–"],
    ["Datum", formatDate(invoice.invoice_date)],
    ["Fällig", formatDate(invoice.due_date), late],
    ["Netto", money(invoice.net_amount, invoice.currency)],
    ["USt", money(invoice.vat_amount, invoice.currency)],
    ["Eingang", relativeTime(invoice.received_at ?? invoice.created_at)],
    ["Von", invoice.vendor_email ?? (invoice.mailbox ? mailboxLabel(invoice.mailbox) : "manuell erfasst")],
  ];
  // Zahlung und Kategorie direkt hier ändern, ohne Details zu öffnen
  const change = (patch: Partial<Invoice>) =>
    updateRow<Invoice>("invoices", invoice.id, patch).catch(() => toast("Speichern fehlgeschlagen", "error"));
  return (
    <div className="flex min-h-full flex-col gap-4 p-3 md:p-5">
      <div className="rounded-3xl border border-snow/10 bg-surface p-5 md:p-6">
        <button type="button" onClick={onBack} className="mb-3 inline-flex items-center gap-1.5 text-[13px] text-snow/60 md:hidden">
          <ArrowLeft className="h-4 w-4" /> Liste
        </button>
        <div className="flex items-start gap-4">
          <div className="min-w-0 flex-1">
            <h2 className="text-xl font-medium">{invoice.vendor}</h2>
            {invoice.description && <p className="mt-0.5 truncate text-sm text-snow/55">{invoice.description}</p>}
          </div>
          <span className="shrink-0 text-2xl font-semibold tabular-nums">{money(invoice.amount, invoice.currency)}</span>
        </div>

        <div className="mt-5 flex flex-wrap items-center gap-2">
          <Button variant="danger" icon={<X className="h-4 w-4" />} onClick={onReject}>
            Zurückweisen
          </Button>
          <Button variant="primary" icon={<Check className="h-4 w-4" />} onClick={onApprove} aria-keyshortcuts="ArrowRight" title="Pfeil rechts">
            Freigeben
          </Button>
          <span className="ml-1 hidden items-center gap-1 text-[12px] text-snow/45 md:inline-flex">
            oder
            <kbd className="inline-grid h-5 min-w-5 place-items-center rounded-md border border-snow/15 px-1">
              <ArrowRight className="h-3 w-3" />
            </kbd>
          </span>
        </div>

        <dl className="mt-6 grid grid-cols-2 gap-x-6 gap-y-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
          {facts.map(([label, value, alert]) => (
            <div key={label} className="min-w-0">
              <dt className="text-[11px] font-semibold tracking-[0.1em] text-snow/45 uppercase">{label}</dt>
              <dd className={clsx("mt-1 truncate text-[14px] font-medium", alert && "text-error")}>{value}</dd>
            </div>
          ))}
          <div className="min-w-0">
            <dt>
              <label htmlFor={`pay-${invoice.id}`} className="text-[11px] font-semibold tracking-[0.1em] text-snow/45 uppercase">
                Zahlung
              </label>
            </dt>
            <dd className="mt-0.5">
              <InlineSelect
                id={`pay-${invoice.id}`}
                value={invoice.payment_method ?? ""}
                onChange={(value) => change({ payment_method: (value || null) as PaymentMethod | null })}
                options={PAYMENT_METHODS.map((m) => [m.id, m.label])}
              />
            </dd>
          </div>
          <div className="min-w-0">
            <dt>
              <label htmlFor={`cat-${invoice.id}`} className="text-[11px] font-semibold tracking-[0.1em] text-snow/45 uppercase">
                Kategorie
              </label>
            </dt>
            <dd className="mt-0.5">
              <InlineSelect
                id={`cat-${invoice.id}`}
                value={invoice.category ?? ""}
                onChange={(value) => change({ category: value || null })}
                options={INVOICE_CATEGORIES.map((c) => [c, c])}
              />
            </dd>
          </div>
        </dl>

        <div className="mt-5">
          <PaidCheckbox invoice={invoice} />
        </div>

        <div className="mt-5 flex flex-wrap items-center gap-x-5 gap-y-2 border-t border-snow/[0.08] pt-4 text-[13px]">
          <button type="button" onClick={onDetails} className="inline-flex items-center gap-1.5 text-snow/70 hover:text-snow">
            Details bearbeiten <ArrowRight className="h-4 w-4" />
          </button>
          <span className="text-snow/45">
            {invoice.graph_id ? "Freigeben schickt den Beleg von buchhaltung@ an DATEV Unternehmen online." : "Kein Beleg – wird nur freigegeben."}
          </span>
        </div>
      </div>

      <BelegPreview key={invoice.id} invoice={invoice} />
    </div>
  );
}

/** Auswahl, die wie ein Wert aussieht (für die Eckdaten in der Freigabe) */
function InlineSelect({
  id,
  value,
  onChange,
  options,
}: {
  id: string;
  value: string;
  onChange: (value: string) => void;
  options: [string, string][];
}) {
  return (
    <select
      id={id}
      value={value}
      onChange={(event) => onChange(event.target.value)}
      className="-ml-1 max-w-full cursor-pointer truncate rounded-lg bg-transparent px-1 py-0.5 text-[14px] font-medium hover:bg-snow/[0.06] focus-visible:outline-2 focus-visible:outline-snow"
    >
      <option value="">–</option>
      {options.map(([key, label]) => (
        <option key={key} value={key}>
          {label}
        </option>
      ))}
    </select>
  );
}

/** „Schon bezahlt“ wird sofort gespeichert */
function PaidCheckbox({ invoice }: { invoice: Invoice }) {
  const toast = useToast();
  return (
    <label className="inline-flex cursor-pointer items-center gap-2.5 text-[14px]">
      <input
        type="checkbox"
        checked={!!invoice.paid}
        onChange={(event) =>
          updateRow<Invoice>("invoices", invoice.id, { paid: event.target.checked }).catch(() => toast("Speichern fehlgeschlagen", "error"))
        }
        className="h-4 w-4 accent-snow"
      />
      Schon bezahlt <span className="text-snow/50">(Karte, PayPal, Lastschrift)</span>
    </label>
  );
}

// ---------- Beleg-Vorschau ----------
// Der Server holt den Beleg per App-Zugriff aus der Rechnungsmail und legt ihn
// einmal ab. Hier werden die Belege der Freigabe-Liste vorab geladen und für
// die Sitzung gemerkt, damit beim Wechsel der Rechnung der Beleg sofort dasteht.

type Beleg = { kind: "file"; url: string; name: string; image: boolean } | { kind: "mail"; html: string } | { kind: "none" };

const belegPromises = new Map<string, Promise<Beleg>>();
const belege = new Map<string, Beleg>();

function loadBeleg(invoice: Invoice) {
  let promise = belegPromises.get(invoice.id);
  if (!promise) {
    promise = (async (): Promise<Beleg> => {
      if (!invoice.mailbox || !invoice.graph_id) return { kind: "none" };
      const response = await apiFetch(`/api/finance/belege/${invoice.id}`);
      const type = response.headers.get("Content-Type") ?? "";
      if (type.startsWith("text/html")) return { kind: "mail", html: await response.text() };
      const name = decodeURIComponent(response.headers.get("Content-Disposition")?.match(/filename\*=UTF-8''(.+)$/)?.[1] ?? "Beleg");
      return { kind: "file", url: URL.createObjectURL(await response.blob()), name, image: type.startsWith("image/") };
    })();
    promise.then(
      (beleg) => belege.set(invoice.id, beleg),
      () => belegPromises.delete(invoice.id)
    );
    belegPromises.set(invoice.id, promise);
  }
  return promise;
}

/** Belege der nächsten Rechnungen im Hintergrund laden */
function usePreloadBelege(invoices: Invoice[]) {
  useEffect(() => {
    for (const invoice of invoices.slice(0, 12)) loadBeleg(invoice).catch(() => {});
  }, [invoices]);
}

function BelegPreview({ invoice }: { invoice: Invoice }) {
  const [, rerender] = useReducer((n: number) => n + 1, 0);
  const [failed, setFailed] = useState<string | null>(null);
  const [attempt, retry] = useReducer((n: number) => n + 1, 0);
  const beleg = belege.get(invoice.id);

  useEffect(() => {
    if (belege.has(invoice.id)) return;
    let live = true;
    loadBeleg(invoice).then(
      () => live && rerender(),
      (error) => live && setFailed(error instanceof Error ? error.message : "Unbekannter Fehler")
    );
    return () => {
      live = false;
    };
    // invoice.id reicht: dieselbe Rechnung hat denselben Beleg
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [invoice.id, attempt]);

  if (failed) {
    return (
      <Frame>
        <div className="grid h-full place-items-center p-8 text-center">
          <div>
            <p className="text-sm text-error">Beleg konnte nicht geladen werden: {failed}</p>
            <Button
              size="sm"
              className="mt-3"
              onClick={() => {
                setFailed(null);
                retry();
              }}
            >
              Nochmal versuchen
            </Button>
          </div>
        </div>
      </Frame>
    );
  }

  return (
    <Frame>
      {!beleg ? (
        <div className="grid h-full place-items-center">
          <Spinner />
        </div>
      ) : beleg.kind === "file" ? (
        beleg.image ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={beleg.url} alt={beleg.name} className="h-full w-full bg-white object-contain" />
        ) : (
          <iframe src={`${beleg.url}#view=FitH`} title={beleg.name} className="h-full w-full bg-white" />
        )
      ) : beleg.kind === "mail" ? (
        <div className="h-full overflow-y-auto bg-white">
          <MailBody body={{ contentType: "html", content: beleg.html }} />
        </div>
      ) : (
        <div className="grid h-full place-items-center p-8 text-center text-sm text-snow/55">
          <div>
            <FileText className="mx-auto mb-2 h-8 w-8 text-snow/30" />
            Kein Beleg – manuell erfasst.
          </div>
        </div>
      )}
    </Frame>
  );
}

/** Fläche für den Beleg: füllt die restliche Höhe, mindestens 70 % des Fensters */
function Frame({ children }: { children: React.ReactNode }) {
  return <div className="min-h-[70vh] flex-1 overflow-hidden rounded-3xl border border-snow/10 bg-surface">{children}</div>;
}

function InvoiceCard({ invoice, overlay }: { invoice: Invoice; overlay?: boolean }) {
  const late = overdue(invoice);
  return (
    <BoardCard overlay={overlay}>
      <div className="flex items-start gap-2">
        <div className="min-w-0 flex-1">
          <p className="truncate text-[14px] font-medium">{invoice.vendor}</p>
          <p className="truncate text-[12px] text-snow/55">{invoice.invoice_number ? `Nr. ${invoice.invoice_number}` : invoice.description}</p>
        </div>
        <span className="shrink-0 text-[13px] font-medium">{money(invoice.amount, invoice.currency)}</span>
      </div>
      {invoice.due_date && invoice.stage !== "datev" && (
        <p className={clsx("mt-2 flex items-center gap-1.5 text-[12px]", late ? "text-error" : "text-snow/60")}>
          <CalendarClock className="h-3.5 w-3.5 shrink-0" />
          {late ? "Überfällig seit" : "Fällig"} {formatDate(invoice.due_date, { day: "numeric", month: "short" })}
        </p>
      )}
      <div className="mt-2.5 flex items-center justify-between text-[12px] text-snow/45">
        <span>{relativeTime(invoice.received_at ?? invoice.created_at)}</span>
        <span>{invoice.paid ? "bezahlt" : invoice.mailbox ? mailboxLabel(invoice.mailbox) : null}</span>
      </div>
    </BoardCard>
  );
}

type Form = Record<
  | "vendor"
  | "invoice_number"
  | "invoice_date"
  | "due_date"
  | "amount"
  | "net_amount"
  | "vat_amount"
  | "currency"
  | "payment_method"
  | "category"
  | "description"
  | "notes",
  string
>;

const toInput = (value: number | null) => value?.toString().replace(".", ",") ?? "";
const fromInput = (value: string) => {
  const number = value.trim() ? Number(value.replace(/\./g, "").replace(",", ".")) : null;
  return number !== null && Number.isFinite(number) ? number : null;
};

const toForm = (i: Invoice): Form => ({
  vendor: i.vendor ?? "",
  invoice_number: i.invoice_number ?? "",
  invoice_date: i.invoice_date ?? "",
  due_date: i.due_date ?? "",
  amount: toInput(i.amount),
  net_amount: toInput(i.net_amount),
  vat_amount: toInput(i.vat_amount),
  currency: i.currency ?? "EUR",
  payment_method: i.payment_method ?? "",
  category: i.category ?? "",
  description: i.description ?? "",
  notes: i.notes ?? "",
});

function fromForm(f: Form): Partial<Invoice> {
  return {
    vendor: f.vendor.trim(),
    invoice_number: f.invoice_number.trim() || null,
    invoice_date: f.invoice_date || null,
    due_date: f.due_date || null,
    amount: fromInput(f.amount),
    net_amount: fromInput(f.net_amount),
    vat_amount: fromInput(f.vat_amount),
    currency: f.currency.trim().toUpperCase() || "EUR",
    payment_method: (f.payment_method || null) as PaymentMethod | null,
    category: f.category || null,
    description: f.description.trim() || null,
    notes: f.notes.trim() || null,
  };
}

function InvoiceSheet({
  id,
  invoices,
  datevAddress,
  onClose,
}: {
  id: string | null;
  invoices: Invoice[];
  datevAddress: string;
  onClose: () => void;
}) {
  const invoice = invoices.find((i) => i.id === id);
  return (
    <Sheet
      open={!!id}
      onClose={onClose}
      title={invoice ? invoice.vendor : "Rechnung"}
      subtitle={invoice && `${money(invoice.amount, invoice.currency)} · eingegangen ${relativeTime(invoice.received_at ?? invoice.created_at)}`}
    >
      {invoice ? (
        <InvoiceDetail key={invoice.id} invoice={invoice} datevAddress={datevAddress} onClose={onClose} />
      ) : (
        <div className="grid h-40 place-items-center">
          <Spinner />
        </div>
      )}
    </Sheet>
  );
}

function InvoiceDetail({ invoice, datevAddress, onClose }: { invoice: Invoice; datevAddress: string; onClose: () => void }) {
  const toast = useToast();
  const [form, setForm] = useState<Form>(() => toForm(invoice));
  const [busy, setBusy] = useState<"save" | "approve" | "datev" | "reset" | "reject" | "delete" | null>(null);
  const [confirm, setConfirm] = useState<"reject" | "delete" | null>(null);
  const dirty = JSON.stringify(form) !== JSON.stringify(toForm(invoice));
  const set = (key: keyof Form) => (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
    setForm((f) => ({ ...f, [key]: event.target.value }));

  async function run(kind: NonNullable<typeof busy>, action: () => Promise<unknown>, success: string, failure: string) {
    setBusy(kind);
    try {
      await action();
      toast(success);
      setConfirm(null);
    } catch (error) {
      toast(error instanceof Error && error.message ? `${failure}: ${error.message}` : failure, "error");
    }
    setBusy(null);
  }

  const save = () => {
    if (!form.vendor.trim()) return toast("Rechnungssteller fehlt", "error");
    return run("save", () => updateRow<Invoice>("invoices", invoice.id, fromForm(form)), "Gespeichert", "Speichern fehlgeschlagen");
  };

  /** Freigeben schickt direkt an DATEV; „An DATEV senden“ holt den Versand
   * für schon freigegebene Rechnungen nach. */
  async function approve(kind: "approve" | "datev") {
    if (!form.vendor.trim()) return toast("Rechnungssteller fehlt", "error");
    setBusy(kind);
    try {
      if (dirty) await updateRow<Invoice>("invoices", invoice.id, fromForm(form));
      toast(releasedText(invoice, await release({ ...invoice, ...fromForm(form) }, datevAddress)));
    } catch (error) {
      toast(`Senden fehlgeschlagen: ${graphErrorMessage(error)}`, "error");
    }
    setBusy(null);
  }

  return (
    <div className="flex flex-col gap-6 p-5">
      <div className="flex flex-wrap items-center gap-2">
        {invoice.stage === "neu" && (
          <Button
            variant="primary"
            icon={<Check className="h-4 w-4" />}
            onClick={() => approve("approve")}
            loading={busy === "approve"}
            loadingText="Wird an DATEV gesendet …"
            disabled={!!busy}
          >
            Freigeben
          </Button>
        )}
        {invoice.stage === "freigegeben" && (
          <>
            <Button
              variant="primary"
              icon={<Send className="h-4 w-4" />}
              onClick={() => approve("datev")}
              loading={busy === "datev"}
              loadingText="Wird gesendet …"
              disabled={!!busy}
            >
              An DATEV senden
            </Button>
            <Button
              icon={<Undo2 className="h-4 w-4" />}
              onClick={() => run("reset", () => updateRow<Invoice>("invoices", invoice.id, { stage: "neu" }), "Freigabe zurückgenommen", "Das hat nicht geklappt")}
              loading={busy === "reset"}
              loadingText="Wird geändert …"
            >
              Freigabe zurücknehmen
            </Button>
          </>
        )}
        {invoice.stage !== "datev" && invoice.stage !== "abgelehnt" && (
          <Button variant="ghost" icon={<XCircle className="h-4 w-4" />} onClick={() => setConfirm("reject")}>
            Keine Rechnung / ablehnen
          </Button>
        )}
      </div>

      <dl className="grid grid-cols-2 gap-x-4 gap-y-2 rounded-2xl bg-snow/[0.04] p-4 text-[13px]">
        <dt className="text-snow/50">Postfach</dt>
        <dd>{invoice.mailbox ?? "manuell erfasst"}</dd>
        {invoice.vendor_email && (
          <>
            <dt className="text-snow/50">Absender</dt>
            <dd className="truncate">{invoice.vendor_email}</dd>
          </>
        )}
        {invoice.approved_at && (
          <>
            <dt className="text-snow/50">Freigegeben</dt>
            <dd>
              {formatDate(invoice.approved_at)} · {invoice.approved_by}
            </dd>
          </>
        )}
        {invoice.datev_sent_at && (
          <>
            <dt className="text-snow/50">An DATEV</dt>
            <dd>
              {formatDate(invoice.datev_sent_at)} · {invoice.datev_sent_by}
            </dd>
          </>
        )}
      </dl>

      {invoice.mailbox && invoice.graph_id && (
        <div>
          <p className="text-xs font-medium text-snow/60">Belege</p>
          <Attachments mailbox={invoice.mailbox} messageId={invoice.graph_id} />
          <Link href="/finance/posteingang" className="mt-3 inline-flex items-center gap-2 text-[13px] text-snow/60 hover:text-snow">
            <Inbox className="h-4 w-4" /> Zum Posteingang
          </Link>
        </div>
      )}

      <div className="grid grid-cols-2 gap-3">
        <Field label="Rechnungssteller *" className="col-span-2">
          {(id) => <Input id={id} value={form.vendor} onChange={set("vendor")} />}
        </Field>
        <Field label="Rechnungsnummer">{(id) => <Input id={id} value={form.invoice_number} onChange={set("invoice_number")} />}</Field>
        <Field label="Betrag (brutto)">
          {(id) => <Input id={id} inputMode="decimal" value={form.amount} onChange={set("amount")} placeholder="z. B. 1.428,00" />}
        </Field>
        <Field label="Netto">{(id) => <Input id={id} inputMode="decimal" value={form.net_amount} onChange={set("net_amount")} />}</Field>
        <Field label="USt">{(id) => <Input id={id} inputMode="decimal" value={form.vat_amount} onChange={set("vat_amount")} />}</Field>
        <Field label="Zahlung">
          {(id) => (
            <Select id={id} value={form.payment_method} onChange={set("payment_method")}>
              <option value="">–</option>
              {PAYMENT_METHODS.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.label}
                </option>
              ))}
            </Select>
          )}
        </Field>
        <Field label="Kategorie">
          {(id) => (
            <Select id={id} value={form.category} onChange={set("category")}>
              <option value="">–</option>
              {INVOICE_CATEGORIES.map((c) => (
                <option key={c}>{c}</option>
              ))}
            </Select>
          )}
        </Field>
        <Field label="Rechnungsdatum">{(id) => <Input id={id} type="date" value={form.invoice_date} onChange={set("invoice_date")} />}</Field>
        <Field label="Fällig am">{(id) => <Input id={id} type="date" value={form.due_date} onChange={set("due_date")} />}</Field>
        <Field label="Leistung" className="col-span-2">
          {(id) => <Input id={id} value={form.description} onChange={set("description")} />}
        </Field>
        <div className="col-span-2">
          <PaidCheckbox invoice={invoice} />
        </div>
        <Field label="Notiz" className="col-span-2">
          {(id) => <Textarea id={id} rows={3} value={form.notes} onChange={set("notes")} />}
        </Field>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Button variant="primary" onClick={save} loading={busy === "save"} loadingText="Wird gespeichert …" disabled={!dirty}>
          Speichern
        </Button>
        <Button variant="ghost" className="ml-auto text-error" onClick={() => setConfirm("delete")}>
          Löschen
        </Button>
      </div>

      <Dialog
        open={confirm === "reject"}
        onClose={() => setConfirm(null)}
        title="Rechnung ablehnen?"
        footer={
          <>
            <Button variant="ghost" onClick={() => setConfirm(null)}>
              Abbrechen
            </Button>
            <Button
              variant="danger"
              loading={busy === "reject"}
              loadingText="Wird abgelehnt …"
              onClick={() =>
                run("reject", () => updateRow<Invoice>("invoices", invoice.id, { stage: "abgelehnt" }), "Abgelehnt", "Das hat nicht geklappt").then(onClose)
              }
            >
              Ablehnen
            </Button>
          </>
        }
      >
        <p className="text-sm text-snow/60">Die Rechnung verschwindet vom Board und wird nicht an DATEV gesendet. Die Mail bleibt im Postfach.</p>
      </Dialog>
      <Dialog
        open={confirm === "delete"}
        onClose={() => setConfirm(null)}
        title="Rechnung löschen?"
        footer={
          <>
            <Button variant="ghost" onClick={() => setConfirm(null)}>
              Abbrechen
            </Button>
            <Button
              variant="danger"
              loading={busy === "delete"}
              loadingText="Wird gelöscht …"
              onClick={() => run("delete", () => deleteRow("invoices", invoice.id), "Gelöscht", "Löschen fehlgeschlagen").then(onClose)}
            >
              Löschen
            </Button>
          </>
        }
      >
        <p className="text-sm text-snow/60">Der Eintrag wird entfernt. Die Mail im Postfach bleibt erhalten.</p>
      </Dialog>
    </div>
  );
}

function NewInvoiceDialog({ open, onClose, onCreated }: { open: boolean; onClose: () => void; onCreated: (id: string) => void }) {
  const toast = useToast();
  const [vendor, setVendor] = useState("");
  const [amount, setAmount] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!vendor.trim()) return toast("Rechnungssteller fehlt", "error");
    setBusy(true);
    try {
      const value = amount.trim() ? Number(amount.replace(/\./g, "").replace(",", ".")) : null;
      const row = await createRow<Invoice>("invoices", {
        vendor: vendor.trim(),
        amount: value !== null && Number.isFinite(value) ? value : null,
        stage: "neu",
        position: topPosition(),
      });
      setVendor("");
      setAmount("");
      onClose();
      onCreated(row.id);
    } catch {
      toast("Anlegen fehlgeschlagen", "error");
    }
    setBusy(false);
  }

  return (
    <Dialog open={open} onClose={onClose} title="Rechnung erfassen">
      <form onSubmit={submit} className="grid gap-3">
        <Field label="Rechnungssteller *">{(id) => <Input id={id} value={vendor} onChange={(e) => setVendor(e.target.value)} autoFocus />}</Field>
        <Field label="Betrag (brutto)" hint="Rechnungen per Mail an buchhaltung@ werden automatisch erfasst. Manuell erfasste Rechnungen haben keinen Beleg für DATEV.">
          {(id) => <Input id={id} inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} />}
        </Field>
        <div className="mt-2 flex justify-end gap-2">
          <Button variant="ghost" type="button" onClick={onClose}>
            Abbrechen
          </Button>
          <Button variant="primary" type="submit" loading={busy} loadingText="Wird angelegt …">
            Anlegen
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
