"use client";

import { useEffect, useState } from "react";
import { CircleDollarSign, FilePen, FileText, Lock, Pause, Play, Send, Square, Trash2, Undo2, Workflow } from "lucide-react";
import { api } from "@/lib/api";
import { FINANCE_MAILBOX, mailboxLabel } from "@/lib/config";
import { revalidate } from "@/lib/data";
import { graphErrorMessage, graphFor, type FileAttachment } from "@/lib/graph";
import { KIND_LABEL, docLabel, money, todayBerlin, type BillingDetail } from "@/lib/billing";
import { Button, Dialog, Field, Input, Popover, MenuItem, Select, Textarea, useToast } from "@/components/ui";
import { BILLING_URL } from "./billing-editor";

/** Aktion am Beleg; Antwort ist der Beleg, der danach offen sein soll */
async function act(id: string, action: string, body: Record<string, unknown> = {}) {
  const doc = await api<BillingDetail>(`${BILLING_URL}/${id}/aktion`, { method: "POST", body: JSON.stringify({ action, ...body }) });
  revalidate(BILLING_URL);
  return doc;
}

/** PDF in neuem Tab: abgelegt als signierter Link, Entwürfe als Vorschau.
 * Das Fenster öffnet sofort, sonst blockt Safari das Pop-up. */
export async function openPdf(id: string) {
  const tab = window.open("", "_blank");
  try {
    const result = await api<{ url?: string; data?: string }>(`${BILLING_URL}/${id}/pdf`);
    let url = result.url;
    if (!url && result.data) {
      const bytes = Uint8Array.from(atob(result.data), (c) => c.charCodeAt(0));
      url = URL.createObjectURL(new Blob([bytes], { type: "application/pdf" }));
    }
    if (!url) throw new Error("Kein PDF");
    if (tab) tab.location.href = url;
    else window.location.href = url;
  } catch (error) {
    tab?.close();
    throw error;
  }
}

type DialogName = "festschreiben" | "senden" | "zahlung" | "stornieren" | "korrigieren" | "loeschen" | "uebernehmen" | "beenden" | null;

/** Knöpfe und Dialoge passend zum Zustand des Belegs */
export function DocumentActions({ doc, onOpen, onEdit }: { doc: BillingDetail; onOpen: (id: string) => void; onEdit: (doc: BillingDetail) => void }) {
  const toast = useToast();
  const [dialog, setDialog] = useState<DialogName>(null);
  const [busy, setBusy] = useState<string | null>(null);

  async function run(action: string, success: string, body?: Record<string, unknown>) {
    setBusy(action);
    try {
      const next = await act(doc.id, action, body);
      toast(success);
      setDialog(null);
      if (next.id !== doc.id) onOpen(next.id);
      return next;
    } catch (error) {
      toast(error instanceof Error ? error.message : "Aktion fehlgeschlagen", "error");
      return null;
    } finally {
      setBusy(null);
    }
  }

  async function preview() {
    setBusy("vorschau");
    try {
      await openPdf(doc.id);
    } catch {
      toast("Vorschau konnte nicht erzeugt werden", "error");
    }
    setBusy(null);
  }

  const intranet = doc.source === "intranet";
  const draft = intranet && doc.status === "entwurf";
  const finalized = !!doc.number && doc.status !== "entwurf";
  const invoiceLike = doc.kind === "rechnung" || doc.kind === "gutschrift";
  const correctable = finalized && invoiceLike && doc.status !== "storniert";
  const payable = finalized && invoiceLike && ["offen", "teilbezahlt", "bezahlt"].includes(doc.status);
  const series = doc.kind === "serie";
  const seriesInIntranet = series && doc.recurring?.managed_by === "intranet";

  return (
    <>
      <div className="flex flex-wrap gap-2">
        {draft && (
          <>
            <Button size="sm" variant="primary" icon={<Lock className="h-4 w-4" />} onClick={() => setDialog("festschreiben")}>
              Festschreiben
            </Button>
            <Button size="sm" icon={<FilePen className="h-4 w-4" />} onClick={() => onEdit(doc)}>
              Bearbeiten
            </Button>
            <Button size="sm" icon={<FileText className="h-4 w-4" />} loading={busy === "vorschau"} loadingText="Wird erzeugt …" onClick={preview}>
              Vorschau
            </Button>
            <Button size="sm" variant="ghost" icon={<Trash2 className="h-4 w-4" />} onClick={() => setDialog("loeschen")}>
              Löschen
            </Button>
          </>
        )}

        {finalized && !series && (
          <Button size="sm" variant={doc.sent_at ? "secondary" : "primary"} icon={<Send className="h-4 w-4" />} onClick={() => setDialog("senden")}>
            {doc.sent_at ? "Erneut senden" : "Senden"}
          </Button>
        )}
        {payable && doc.status !== "bezahlt" && (
          <Button size="sm" icon={<CircleDollarSign className="h-4 w-4" />} onClick={() => setDialog("zahlung")}>
            Zahlung erfassen
          </Button>
        )}
        {correctable && (
          <Popover
            align="left"
            trigger={({ toggle }) => (
              <Button size="sm" variant="ghost" icon={<Undo2 className="h-4 w-4" />} loading={busy === "gutschrift"} loadingText="Wird angelegt …" onClick={toggle}>
                Korrigieren …
              </Button>
            )}
          >
            {(close) => (
              <>
                {doc.kind === "rechnung" && (
                  <MenuItem onClick={() => (close(), setDialog("korrigieren"))}>Korrigieren (Storno und neuer Entwurf)</MenuItem>
                )}
                {doc.kind === "rechnung" && (
                  <MenuItem onClick={() => (close(), run("gutschrift", "Gutschrift als Entwurf angelegt").then((next) => next && onEdit(next)))}>
                    Gutschrift über einen Teilbetrag
                  </MenuItem>
                )}
                <MenuItem onClick={() => (close(), setDialog("stornieren"))}>Stornieren</MenuItem>
              </>
            )}
          </Popover>
        )}
        {intranet && finalized && !doc.has_pdf && (
          <Button size="sm" variant="ghost" loading={busy === "pdf_nachholen"} loadingText="Wird erzeugt …" onClick={() => run("pdf_nachholen", "PDF abgelegt")}>
            PDF erzeugen
          </Button>
        )}

        {series && !seriesInIntranet && doc.status !== "erledigt" && (
          <Button size="sm" variant="primary" icon={<Workflow className="h-4 w-4" />} onClick={() => setDialog("uebernehmen")}>
            Ins Intranet übernehmen
          </Button>
        )}
        {seriesInIntranet && (
          <>
            <Button size="sm" icon={<FilePen className="h-4 w-4" />} onClick={() => onEdit(doc)}>
              Bearbeiten
            </Button>
            {doc.recurring?.status === "RUNNING" && (
              <Button size="sm" icon={<Pause className="h-4 w-4" />} loading={busy === "pausieren"} loadingText="Wird pausiert …" onClick={() => run("pausieren", "Serie pausiert")}>
                Pausieren
              </Button>
            )}
            {doc.recurring?.status === "PAUSE" && (
              <Button size="sm" icon={<Play className="h-4 w-4" />} loading={busy === "fortsetzen"} loadingText="Wird fortgesetzt …" onClick={() => run("fortsetzen", "Serie läuft wieder")}>
                Fortsetzen
              </Button>
            )}
            {doc.recurring?.status !== "STOP" && (
              <Button size="sm" variant="ghost" icon={<Square className="h-4 w-4" />} onClick={() => setDialog("beenden")}>
                Beenden
              </Button>
            )}
          </>
        )}
      </div>

      <Confirm
        open={dialog === "festschreiben"}
        onClose={() => setDialog(null)}
        title={`${KIND_LABEL[doc.kind]} festschreiben?`}
        text="Der Beleg bekommt die nächste Nummer aus dem Nummernkreis und das PDF wird abgelegt. Danach lässt er sich nicht mehr ändern, nur noch stornieren oder korrigieren."
        busy={busy === "festschreiben"}
        confirm="Festschreiben"
        confirmBusy="Wird festgeschrieben …"
        onConfirm={async () => {
          const next = await run("festschreiben", "Festgeschrieben");
          if (next) setDialog("senden");
        }}
      />
      <Confirm
        open={dialog === "loeschen"}
        onClose={() => setDialog(null)}
        title="Entwurf löschen?"
        text="Der Entwurf hat noch keine Nummer und verschwindet vollständig."
        busy={busy === "loeschen"}
        confirm="Löschen"
        confirmBusy="Wird gelöscht …"
        danger
        onConfirm={async () => {
          setBusy("loeschen");
          try {
            await api(`${BILLING_URL}/${doc.id}`, { method: "DELETE" });
            revalidate(BILLING_URL);
            toast("Entwurf gelöscht");
            setDialog(null);
            onOpen("");
          } catch (error) {
            toast(error instanceof Error ? error.message : "Löschen fehlgeschlagen", "error");
          }
          setBusy(null);
        }}
      />
      <Confirm
        open={dialog === "stornieren"}
        onClose={() => setDialog(null)}
        title={`${docLabel(doc)} stornieren?`}
        text={`Es entsteht eine Stornorechnung mit eigener Nummer über ${money(-doc.amount_gross, doc.currency)}. ${doc.paid_amount ? "Bereits gezahlte Beträge musst du erstatten. " : ""}Das Original gilt danach als storniert.`}
        busy={busy === "stornieren"}
        confirm="Stornieren"
        confirmBusy="Wird storniert …"
        danger
        onConfirm={() => run("stornieren", "Storniert")}
      />
      <Confirm
        open={dialog === "korrigieren"}
        onClose={() => setDialog(null)}
        title={`${docLabel(doc)} korrigieren?`}
        text="Die Rechnung wird storniert (Stornorechnung mit eigener Nummer) und als neuer Entwurf geöffnet. Den passt du an und schreibst ihn neu fest."
        busy={busy === "korrigieren"}
        confirm="Stornieren und Entwurf öffnen"
        confirmBusy="Wird angelegt …"
        onConfirm={async () => {
          const next = await run("korrigieren", "Storniert, Entwurf angelegt");
          if (next) onEdit(next);
        }}
      />
      <Confirm
        open={dialog === "uebernehmen"}
        onClose={() => setDialog(null)}
        title="Serie ins Intranet übernehmen?"
        text="Ab dem nächsten Termin erzeugt, schreibt fest und verschickt das Intranet die Rechnungen dieser Serie. Stoppe die Serie vorher in easybill, sonst wird doppelt berechnet."
        busy={busy === "uebernehmen"}
        confirm="Übernehmen"
        confirmBusy="Wird übernommen …"
        onConfirm={() => run("uebernehmen", "Serie läuft jetzt im Intranet")}
      />
      <Confirm
        open={dialog === "beenden"}
        onClose={() => setDialog(null)}
        title="Serie beenden?"
        text="Es entstehen keine weiteren Rechnungen. Bereits erstellte bleiben unverändert."
        busy={busy === "beenden"}
        confirm="Beenden"
        confirmBusy="Wird beendet …"
        danger
        onConfirm={() => run("beenden", "Serie beendet")}
      />
      {dialog === "senden" && <SendDialog doc={doc} onClose={() => setDialog(null)} />}
      {dialog === "zahlung" && <PaymentDialog doc={doc} onClose={() => setDialog(null)} />}
    </>
  );
}

function Confirm({
  open,
  onClose,
  title,
  text,
  confirm,
  confirmBusy,
  busy,
  danger,
  onConfirm,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  text: string;
  confirm: string;
  confirmBusy: string;
  busy: boolean;
  danger?: boolean;
  onConfirm: () => void;
}) {
  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={title}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Abbrechen
          </Button>
          <Button variant={danger ? "danger" : "primary"} loading={busy} loadingText={confirmBusy} onClick={onConfirm}>
            {confirm}
          </Button>
        </>
      }
    >
      <p className="text-sm text-snow/70">{text}</p>
    </Dialog>
  );
}

const split = (value: string) => value.split(/[,;\s]+/).map((v) => v.trim()).filter(Boolean);

/** Beleg als PDF von buchhaltung@ verschicken (im Browser über Graph) */
function SendDialog({ doc, onClose }: { doc: BillingDetail; onClose: () => void }) {
  const toast = useToast();
  const [mail, setMail] = useState<{ to: string; cc: string; subject: string; body: string; attachment: FileAttachment } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);

  // PDF, Empfänger, Betreff und Text vom Server
  useEffect(() => {
    api<{ to: string | null; subject: string; body: string; attachment: FileAttachment }>(`${BILLING_URL}/${doc.id}/pdf?mail=1`)
      .then((m) => setMail({ to: m.to ?? "", cc: "", subject: m.subject, body: m.body, attachment: m.attachment }))
      .catch((e: Error) => setError(e.message));
  }, [doc.id]);

  async function send() {
    if (!mail) return;
    const to = split(mail.to);
    if (!to.length) return toast("Bitte eine Empfänger-Adresse eintragen", "error");
    setSending(true);
    try {
      await graphFor(FINANCE_MAILBOX).send({ to, cc: split(mail.cc), subject: mail.subject, body: mail.body }, [mail.attachment]);
      await act(doc.id, "versendet", { to: to.join(", ") });
      toast(`An ${to.join(", ")} gesendet`);
      onClose();
    } catch (e) {
      toast(graphErrorMessage(e), "error");
    }
    setSending(false);
  }

  return (
    <Dialog
      open
      onClose={onClose}
      title={`${docLabel(doc)} senden`}
      width="max-w-xl"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Später
          </Button>
          <Button variant="primary" icon={<Send className="h-4 w-4" />} loading={sending} loadingText="Wird gesendet …" disabled={!mail} onClick={send}>
            Senden
          </Button>
        </>
      }
    >
      {error ? (
        <p className="text-sm text-error">{error}</p>
      ) : !mail ? (
        <p className="text-sm text-snow/60">PDF wird vorbereitet …</p>
      ) : (
        <div className="flex flex-col gap-3">
          <p className="text-[13px] text-snow/55">Von {mailboxLabel(FINANCE_MAILBOX)}</p>
          <Field label="An">{(id) => <Input id={id} value={mail.to} onChange={(e) => setMail({ ...mail, to: e.target.value })} placeholder="kunde@firma.de" />}</Field>
          <Field label="Cc">{(id) => <Input id={id} value={mail.cc} onChange={(e) => setMail({ ...mail, cc: e.target.value })} />}</Field>
          <Field label="Betreff">{(id) => <Input id={id} value={mail.subject} onChange={(e) => setMail({ ...mail, subject: e.target.value })} />}</Field>
          <Field label="Text">{(id) => <Textarea id={id} value={mail.body} onChange={(e) => setMail({ ...mail, body: e.target.value })} className="min-h-40" />}</Field>
          <p className="flex items-center gap-2 text-[13px] text-snow/60">
            <FileText className="h-4 w-4" />
            {mail.attachment.name}
          </p>
        </div>
      )}
    </Dialog>
  );
}

const METHODS = ["Überweisung", "Lastschrift", "PayPal", "Bar", "Verrechnung"];

function PaymentDialog({ doc, onClose }: { doc: BillingDetail; onClose: () => void }) {
  const toast = useToast();
  const open = Math.round((doc.amount_gross - doc.paid_amount) * 100) / 100;
  const [paidOn, setPaidOn] = useState(todayBerlin());
  const [amount, setAmount] = useState(String(open).replace(".", ","));
  const [method, setMethod] = useState(METHODS[0]);
  const [reference, setReference] = useState(doc.number ?? "");
  const [saving, setSaving] = useState(false);

  async function save() {
    const value = Number(amount.replace(/\./g, "").replace(",", "."));
    if (!value) return toast("Betrag fehlt", "error");
    setSaving(true);
    try {
      await act(doc.id, "zahlung", { paid_on: paidOn, amount: value, method, reference });
      toast("Zahlung erfasst");
      onClose();
    } catch (e) {
      toast(e instanceof Error ? e.message : "Speichern fehlgeschlagen", "error");
    }
    setSaving(false);
  }

  return (
    <Dialog
      open
      onClose={onClose}
      title="Zahlung erfassen"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Abbrechen
          </Button>
          <Button variant="primary" loading={saving} loadingText="Wird gespeichert …" onClick={save}>
            Erfassen
          </Button>
        </>
      }
    >
      <div className="grid gap-3 sm:grid-cols-2">
        <p className="text-[13px] text-snow/60 sm:col-span-2">
          {docLabel(doc)} · offen {money(open, doc.currency)}
        </p>
        <Field label="Datum">{(id) => <Input id={id} type="date" value={paidOn} onChange={(e) => setPaidOn(e.target.value)} />}</Field>
        <Field label="Betrag">{(id) => <Input id={id} inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} />}</Field>
        <Field label="Zahlart">
          {(id) => (
            <Select id={id} value={method} onChange={(e) => setMethod(e.target.value)}>
              {METHODS.map((m) => (
                <option key={m}>{m}</option>
              ))}
            </Select>
          )}
        </Field>
        <Field label="Referenz">{(id) => <Input id={id} value={reference} onChange={(e) => setReference(e.target.value)} />}</Field>
      </div>
    </Dialog>
  );
}

/** Zahlung entfernen (nur im Intranet erfasste) */
export async function removePayment(docId: string, paymentId: string) {
  await act(docId, "zahlung_loeschen", { payment_id: paymentId });
}
