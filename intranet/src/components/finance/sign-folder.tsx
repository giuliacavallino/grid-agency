"use client";

import { useState } from "react";
import { Copy, FileCheck2, FileText, PenLine, Send, Undo2 } from "lucide-react";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { SHARED_MAILBOX, mailboxLabel } from "@/lib/config";
import { DEFAULT_PURPOSE } from "@/lib/contract";
import { mutate, revalidate, useResource } from "@/lib/data";
import { formatDateTime } from "@/lib/format";
import { graphErrorMessage, graphFor } from "@/lib/graph";
import { todayBerlin, type BillingDetail } from "@/lib/billing";
import type { Settings } from "@/lib/sales/types";
import { Badge, Button, Dialog, Field, Input, Spinner, Textarea, useToast } from "@/components/ui";
import { SignaturePad } from "@/components/signature-pad";
import { BILLING_URL } from "./billing-editor";

// Angebot zur Unterschrift: Mappe (Angebot + Vertrag + SEPA-Mandat) anlegen,
// für GRID unterschreiben, Link von hello@ verschicken; Status der Mappen.

type Envelope = {
  id: string;
  created_at: string;
  status: "versendet" | "geoeffnet" | "unterschrieben" | "abgelehnt" | "widerrufen";
  signer_name: string;
  signer_email: string;
  sepa_required: boolean;
  mandate_reference: string | null;
  grid_signer: string;
  customer_signed_at: string | null;
  decline_reason: string | null;
  audit: { at: string; event: string; by?: string; ip?: string; detail?: string; ref?: string }[];
  sent_at: string | null;
  viewed_at: string | null;
  expires_at: string;
  mail_error: string | null;
  has_pdf: boolean;
};

const STATUS: Record<Envelope["status"], [string, string | undefined]> = {
  versendet: ["Versendet", "#e7a33e"],
  geoeffnet: ["Geöffnet", "#7fa8ff"],
  unterschrieben: ["Unterschrieben", "#9fd8a8"],
  abgelehnt: ["Abgelehnt", "#ec8a84"],
  widerrufen: ["Zurückgezogen", undefined],
};

const EVENT: Record<string, string> = {
  erstellt: "Erstellt und von GRID unterschrieben",
  versendet: "Versendet",
  geoeffnet: "Geöffnet",
  angenommen: "Angebot bestätigt",
  feld: "Unterschrift gesetzt",
  zugestimmt: "Elektronischer Unterschrift zugestimmt",
  unterschrieben: "Vom Kunden unterschrieben",
  versiegelt: "Versiegelt und in der Kundenakte abgelegt",
  abgelehnt: "Abgelehnt",
  widerrufen: "Zurückgezogen",
};

const mappenUrl = (id: string) => `${BILLING_URL}/${id}/mappe`;

function firstOfNextMonth() {
  const [y, m] = todayBerlin().split("-").map(Number);
  return new Date(Date.UTC(y, m, 1)).toISOString().slice(0, 10);
}

async function openBlob(base64: string) {
  const bytes = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
  window.open(URL.createObjectURL(new Blob([bytes], { type: "application/pdf" })), "_blank");
}

/** Dialog: Mappe zusammenstellen, für GRID unterschreiben, Link senden */
export function SignFolderDialog({ doc, onClose }: { doc: BillingDetail; onClose: () => void }) {
  const toast = useToast();
  const { account } = useAuth();
  const { data: settings } = useResource<Settings>("/api/sales/settings");
  const contact = [doc.address?.first_name, doc.address?.last_name].filter(Boolean).join(" ");
  const [signerName, setSignerName] = useState(contact);
  const [signerEmail, setSignerEmail] = useState(doc.recipient_email ?? "");
  const [start, setStart] = useState(doc.service_from ?? firstOfNextMonth());
  const [minTerm, setMinTerm] = useState("3");
  const [notice, setNotice] = useState("1");
  const [purpose, setPurpose] = useState(DEFAULT_PURPOSE);
  const [sepa, setSepa] = useState(true);
  const [gridSigner, setGridSigner] = useState<string | null>(null);
  const [drawn, setDrawn] = useState<string | null>(null);
  const [redraw, setRedraw] = useState(false);
  const [remember, setRemember] = useState(true);
  const [busy, setBusy] = useState<"vorschau" | "senden" | null>(null);
  const [fallback, setFallback] = useState<{ link: string; error: string } | null>(null);

  const saved = settings?.grid_signature ?? null;
  const useSaved = !!saved && !redraw;
  const signature = useSaved ? saved.image : drawn;
  const signer = gridSigner ?? (useSaved ? saved.signer : account?.name) ?? "";
  const creditor = settings?.billing.company.creditor_id;

  const input = () => ({
    signer_name: signerName,
    signer_email: signerEmail,
    terms: { purpose, start_date: start, min_term_months: Number(minTerm), notice_months: Number(notice) },
    sepa_required: sepa,
    grid_signer: signer,
    grid_signature: signature ?? "",
  });

  async function preview() {
    setBusy("vorschau");
    try {
      const { data } = await api<{ data: string }>(`${mappenUrl(doc.id)}?vorschau=1`, { method: "POST", body: JSON.stringify(input()) });
      await openBlob(data);
    } catch (e) {
      toast(e instanceof Error ? e.message : "Vorschau fehlgeschlagen", "error");
    }
    setBusy(null);
  }

  async function send() {
    if (!signature) return toast("Bitte für GRID unterschreiben", "error");
    setBusy("senden");
    try {
      const created = await api<{ id: string; link: string; mail: { from: string; to: string; subject: string; body: string } }>(mappenUrl(doc.id), {
        method: "POST",
        body: JSON.stringify(input()),
      });
      if (remember && !useSaved && drawn) {
        const result = await api<Settings>("/api/sales/settings", { method: "PUT", body: JSON.stringify({ grid_signature: { signer, image: drawn } }) });
        mutate<Settings>("/api/sales/settings", () => result);
      }
      try {
        await graphFor(created.mail.from).send({ to: [created.mail.to], cc: [], subject: created.mail.subject, body: created.mail.body });
        await api(`/api/finance/mappen/${created.id}`, { method: "POST", body: JSON.stringify({ action: "versendet", by: created.mail.from, to: created.mail.to }) });
        toast(`Mappe an ${created.mail.to} gesendet`);
        revalidate(mappenUrl(doc.id));
        onClose();
      } catch (e) {
        // Mappe steht, nur die Mail ging nicht raus: Link zum Kopieren zeigen
        setFallback({ link: created.link, error: graphErrorMessage(e) });
        revalidate(mappenUrl(doc.id));
      }
    } catch (e) {
      toast(e instanceof Error ? e.message : "Mappe konnte nicht angelegt werden", "error");
    }
    setBusy(null);
  }

  return (
    <Dialog
      open
      onClose={onClose}
      title={`${doc.number ? `Angebot ${doc.number}` : "Angebot"} zur Unterschrift`}
      width="max-w-2xl"
      footer={
        fallback ? (
          <Button variant="primary" onClick={onClose}>
            Fertig
          </Button>
        ) : (
          <>
            <Button variant="ghost" onClick={onClose}>
              Abbrechen
            </Button>
            <Button icon={<FileText className="h-4 w-4" />} loading={busy === "vorschau"} loadingText="Wird erzeugt …" disabled={!!busy} onClick={preview}>
              Vorschau
            </Button>
            <Button
              variant="primary"
              icon={<Send className="h-4 w-4" />}
              loading={busy === "senden"}
              loadingText="Wird gesendet …"
              disabled={!!busy || !signature || !signerName.trim() || !signerEmail.trim()}
              onClick={send}
            >
              Unterschreiben und senden
            </Button>
          </>
        )
      }
    >
      {fallback ? (
        <div className="flex flex-col gap-3 text-sm">
          <p className="text-snow/75">Die Mappe ist angelegt, die Mail ging aber nicht raus: {fallback.error}</p>
          <p className="text-snow/60">Schick dem Kunden diesen Link selbst. Er ist nur hier einmal sichtbar:</p>
          <div className="flex gap-2">
            <Input readOnly value={fallback.link} onFocus={(e) => e.target.select()} />
            <Button icon={<Copy className="h-4 w-4" />} onClick={() => navigator.clipboard.writeText(fallback.link).then(() => toast("Link kopiert"))}>
              Kopieren
            </Button>
          </div>
        </div>
      ) : !settings ? (
        <Spinner />
      ) : (
        <div className="flex flex-col gap-5">
          <p className="text-[13px] text-snow/60">
            Angebot, Agenturvertrag{sepa ? " und SEPA-Lastschriftmandat" : ""} gehen als eine Mappe von {mailboxLabel(SHARED_MAILBOX)} an den Kunden. Er
            unterschreibt auf sign.grid-agency.de; danach landet alles versiegelt in der Kundenakte.
          </p>
          <section className="grid gap-3 sm:grid-cols-2">
            <Field label="Unterschreibt für den Kunden">{(id) => <Input id={id} value={signerName} onChange={(e) => setSignerName(e.target.value)} placeholder="Vor- und Nachname" />}</Field>
            <Field label="E-Mail">{(id) => <Input id={id} type="email" value={signerEmail} onChange={(e) => setSignerEmail(e.target.value)} />}</Field>
          </section>
          <section className="grid gap-3 sm:grid-cols-3">
            <Field label="Vertragsbeginn">{(id) => <Input id={id} type="date" value={start} onChange={(e) => setStart(e.target.value)} />}</Field>
            <Field label="Mindestlaufzeit (Monate)">{(id) => <Input id={id} inputMode="numeric" value={minTerm} onChange={(e) => setMinTerm(e.target.value)} />}</Field>
            <Field label="Kündigungsfrist (Monate)">{(id) => <Input id={id} inputMode="numeric" value={notice} onChange={(e) => setNotice(e.target.value)} />}</Field>
            <Field label="Ziel der Zusammenarbeit (Präambel)" className="sm:col-span-3" hint="„Ziel der Zusammenarbeit … ist …“">
              {(id) => <Textarea id={id} value={purpose} onChange={(e) => setPurpose(e.target.value)} className="min-h-16" />}
            </Field>
          </section>
          <label className="flex items-start gap-3 text-[14px]">
            <input type="checkbox" checked={sepa && !!creditor} disabled={!creditor} onChange={(e) => setSepa(e.target.checked)} className="mt-1 h-4 w-4" />
            <span>
              SEPA-Lastschriftmandat mitschicken
              {!creditor && <span className="block text-[12px] text-snow/50">Erst die Gläubiger-ID in Finance → Einstellungen eintragen.</span>}
            </span>
          </label>

          <section className="flex flex-col gap-2">
            <h3 className="text-[12px] font-medium text-snow/50">Unterschrift für GRID</h3>
            {useSaved ? (
              <div className="flex items-center gap-4 rounded-2xl border border-snow/10 bg-white p-3">
                {/* eslint-disable-next-line @next/next/no-img-element -- data-URL der gespeicherten Unterschrift */}
                <img src={saved.image} alt={`Unterschrift ${saved.signer}`} className="h-16 max-w-[60%] object-contain" />
                <div className="flex-1 text-[13px] text-[#2b2926]">
                  {saved.signer}
                  <button type="button" onClick={() => setRedraw(true)} className="ml-3 inline-flex items-center gap-1 text-[#676159] underline">
                    <PenLine className="h-3.5 w-3.5" />
                    neu unterschreiben
                  </button>
                </div>
              </div>
            ) : (
              <>
                <Field label="Name">{(id) => <Input id={id} value={signer} onChange={(e) => setGridSigner(e.target.value)} />}</Field>
                <SignaturePad onChange={setDrawn} name={signer} />
                <label className="flex items-center gap-2 text-[13px] text-snow/70">
                  <input type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} className="h-4 w-4" />
                  Unterschrift für künftige Mappen speichern
                </label>
              </>
            )}
          </section>
        </div>
      )}
    </Dialog>
  );
}

/** Mappen eines Angebots mit Status und Verlauf */
export function SignFolders({ doc }: { doc: BillingDetail }) {
  const { data } = useResource<Envelope[]>(mappenUrl(doc.id));
  const toast = useToast();
  const [busy, setBusy] = useState<string | null>(null);

  async function act(id: string, action: "pdf" | "widerrufen") {
    setBusy(`${action}:${id}`);
    const tab = action === "pdf" ? window.open("", "_blank") : null;
    try {
      const result = await api<{ url?: string }>(`/api/finance/mappen/${id}`, { method: "POST", body: JSON.stringify({ action }) });
      if (action === "pdf" && result.url) {
        if (tab) tab.location.href = result.url;
        else window.location.assign(result.url);
      } else {
        toast("Mappe zurückgezogen");
        revalidate(mappenUrl(doc.id));
      }
    } catch (e) {
      tab?.close();
      toast(e instanceof Error ? e.message : "Fehlgeschlagen", "error");
    }
    setBusy(null);
  }

  if (!data?.length) return null;
  return (
    <section>
      <h3 className="mb-2 text-[12px] font-medium text-snow/50">Unterschriftsmappen</h3>
      <ul className="flex flex-col gap-2">
        {data.map((e) => {
          const [label, color] = STATUS[e.status];
          return (
            <li key={e.id} className="rounded-2xl border border-snow/[0.08] p-4 text-[13px]">
              <div className="flex flex-wrap items-center gap-2">
                <Badge color={color} className={color ? undefined : "text-snow/50"}>
                  {label}
                </Badge>
                <span className="font-medium">{e.signer_name}</span>
                <span className="text-snow/55">{e.signer_email}</span>
                {e.sepa_required && <Badge>mit SEPA</Badge>}
              </div>
              <ol className="mt-3 flex flex-col gap-1 border-l border-snow/10 pl-3">
                {e.audit.map((a, i) => (
                  <li key={i} className="text-snow/65">
                    <span className="tabular-nums text-snow/45">{formatDateTime(a.at)}</span> · {EVENT[a.event] ?? a.event}
                    {a.event === "feld" && a.detail ? `: ${a.detail} · ID ${a.ref}` : ""}
                    {a.by ? ` · ${a.by}` : ""}
                    {a.detail && a.event !== "erstellt" ? ` · ${a.detail}` : ""}
                    {a.ip ? ` · IP ${a.ip}` : ""}
                  </li>
                ))}
              </ol>
              {e.decline_reason && <p className="mt-2 text-snow/70">Grund: {e.decline_reason}</p>}
              {e.mail_error && <p className="mt-2 text-error">Abschlussmail fehlgeschlagen: {e.mail_error}</p>}
              <div className="mt-3 flex flex-wrap gap-2">
                {e.has_pdf && (
                  <Button size="sm" icon={<FileCheck2 className="h-4 w-4" />} loading={busy === `pdf:${e.id}`} loadingText="Wird geöffnet …" onClick={() => act(e.id, "pdf")}>
                    Unterschriebene Unterlagen
                  </Button>
                )}
                {(e.status === "versendet" || e.status === "geoeffnet") && (
                  <Button size="sm" variant="ghost" icon={<Undo2 className="h-4 w-4" />} loading={busy === `widerrufen:${e.id}`} loadingText="Wird zurückgezogen …" onClick={() => act(e.id, "widerrufen")}>
                    Zurückziehen
                  </Button>
                )}
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
