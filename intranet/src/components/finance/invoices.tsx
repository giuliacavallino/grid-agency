"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { clsx } from "clsx";
import { CalendarClock, Check, Inbox, Search, Send, Undo2, XCircle } from "lucide-react";
import { FINANCE_MAILBOX, mailboxLabel } from "@/lib/config";
import { createRow, deleteRow, updateRow, useResource, useRows } from "@/lib/data";
import { formatDate, relativeTime } from "@/lib/format";
import { graphFor } from "@/lib/graph";
import { INVOICE_STAGES, topPosition, type Invoice, type InvoiceStage, type Settings } from "@/lib/sales/types";
import { Board, BoardCard } from "@/components/board";
import { Button, Dialog, Empty, Field, Input, Sheet, Spinner, Textarea, useToast } from "@/components/ui";
import { Attachments } from "@/components/sales/mail/reading-pane";
import { PageBar } from "@/components/sales/shell";

const money = (amount: number | null, currency = "EUR") =>
  amount === null ? "–" : new Intl.NumberFormat("de-DE", { style: "currency", currency }).format(amount);

const overdue = (invoice: Invoice) =>
  invoice.stage !== "datev" && !!invoice.due_date && new Date(`${invoice.due_date}T23:59:59`) < new Date();

/** Eingangsrechnungen: Neu (aus den Postfächern erfasst) → Freigegeben →
 * An DATEV gesendet (Upload-Mail von buchhaltung@). */
export function Invoices() {
  const { data: invoices, loading, error } = useRows<Invoice>("invoices");
  const { data: settings } = useResource<Settings>("/api/sales/settings");
  const toast = useToast();
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
      if (stage === "freigegeben" && invoice.stage === "neu") toast("Freigegeben");
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
        <div className="relative min-w-0 flex-1 md:max-w-56">
          <Search className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-snow/40" />
          <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Suchen" aria-label="Rechnungen durchsuchen" className="h-9 w-full pl-9" />
        </div>
        <Button variant="primary" size="sm" className="h-9" onClick={() => setCreating(true)}>
          Rechnung erfassen
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
        {invoice.mailbox && <span>{mailboxLabel(invoice.mailbox)}</span>}
      </div>
    </BoardCard>
  );
}

type Form = Record<"vendor" | "invoice_number" | "invoice_date" | "due_date" | "amount" | "currency" | "description" | "notes", string>;

const toForm = (i: Invoice): Form => ({
  vendor: i.vendor ?? "",
  invoice_number: i.invoice_number ?? "",
  invoice_date: i.invoice_date ?? "",
  due_date: i.due_date ?? "",
  amount: i.amount?.toString().replace(".", ",") ?? "",
  currency: i.currency ?? "EUR",
  description: i.description ?? "",
  notes: i.notes ?? "",
});

function fromForm(f: Form): Partial<Invoice> {
  const amount = f.amount.trim() ? Number(f.amount.replace(/\./g, "").replace(",", ".")) : null;
  return {
    vendor: f.vendor.trim(),
    invoice_number: f.invoice_number.trim() || null,
    invoice_date: f.invoice_date || null,
    due_date: f.due_date || null,
    amount: amount !== null && Number.isFinite(amount) ? amount : null,
    currency: f.currency.trim().toUpperCase() || "EUR",
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
  const [confirm, setConfirm] = useState<"datev" | "reject" | "delete" | null>(null);
  const dirty = JSON.stringify(form) !== JSON.stringify(toForm(invoice));
  const set = (key: keyof Form) => (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
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

  const approve = () =>
    run(
      "approve",
      async () => {
        if (dirty) await updateRow<Invoice>("invoices", invoice.id, fromForm(form));
        await updateRow<Invoice>("invoices", invoice.id, { stage: "freigegeben", position: topPosition() });
      },
      "Freigegeben",
      "Freigabe fehlgeschlagen"
    );

  /** Anhänge aus der Original-Mail holen und von buchhaltung@ an DATEV schicken */
  const sendToDatev = () =>
    run(
      "datev",
      async () => {
        if (!datevAddress) throw new Error("Keine DATEV-Upload-Adresse hinterlegt");
        if (!invoice.mailbox || !invoice.graph_id) throw new Error("Rechnung hat keine Mail mit Anhang");
        const files = await graphFor(invoice.mailbox).files(invoice.graph_id);
        if (!files.length) throw new Error("Die Mail hat keine Dateianhänge");
        const subject = [invoice.vendor, invoice.invoice_number].filter(Boolean).join(" · ");
        await graphFor(FINANCE_MAILBOX).send({ to: [datevAddress], cc: [], subject: subject || "Eingangsrechnung", body: "" }, files);
        await updateRow<Invoice>("invoices", invoice.id, { stage: "datev", position: topPosition() });
      },
      "An DATEV gesendet",
      "Senden fehlgeschlagen"
    );

  return (
    <div className="flex flex-col gap-6 p-5">
      <div className="flex flex-wrap items-center gap-2">
        {invoice.stage === "neu" && (
          <Button variant="primary" icon={<Check className="h-4 w-4" />} onClick={approve} loading={busy === "approve"} loadingText="Wird freigegeben …">
            Freigeben
          </Button>
        )}
        {invoice.stage === "freigegeben" && (
          <>
            <Button variant="primary" icon={<Send className="h-4 w-4" />} onClick={() => setConfirm("datev")}>
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
        <Field label="Rechnungsdatum">{(id) => <Input id={id} type="date" value={form.invoice_date} onChange={set("invoice_date")} />}</Field>
        <Field label="Fällig am">{(id) => <Input id={id} type="date" value={form.due_date} onChange={set("due_date")} />}</Field>
        <Field label="Leistung" className="col-span-2">
          {(id) => <Input id={id} value={form.description} onChange={set("description")} />}
        </Field>
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
        open={confirm === "datev"}
        onClose={() => setConfirm(null)}
        title="An DATEV senden?"
        footer={
          <>
            <Button variant="ghost" onClick={() => setConfirm(null)}>
              Abbrechen
            </Button>
            <Button variant="primary" loading={busy === "datev"} loadingText="Wird gesendet …" onClick={sendToDatev}>
              Senden
            </Button>
          </>
        }
      >
        <p className="text-sm text-snow/60">
          Die Belege aus der Rechnungsmail gehen von <b>{FINANCE_MAILBOX}</b> an <b>{datevAddress || "(keine Adresse hinterlegt)"}</b>.
          DATEV legt jeden Anhang als eigenen Beleg an.
        </p>
      </Dialog>
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
