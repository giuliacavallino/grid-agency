"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CalendarCheck, CalendarPlus, FileSignature, Handshake, LoaderCircle, Rocket, ShieldAlert, Video, X } from "lucide-react";
import { api } from "@/lib/api";
import { revalidate, updateRow } from "@/lib/data";
import { relativeTime } from "@/lib/format";
import type { Lead } from "@/lib/sales/types";
import { Button, Dialog, Field, Input, useToast } from "@/components/ui";
import { OfferDialog } from "./offer-dialog";
import { openCompose } from "./mail/compose-window";

// Nächster Schritt je Spalte, direkt an der Karte:
// Neuer Lead → „Termin einladen“ · Erstgespräch → „Absage“ / „Angebot erstellen“
// · Angebot verschickt → wartet auf Unterschrift · Kunde gewonnen → „Onboarding starten“

const when = (iso: string) =>
  new Date(iso).toLocaleString("de-DE", { timeZone: "Europe/Berlin", weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });

/** Klicks in der Aktionsleiste öffnen nicht die Karte und starten kein Ziehen */
const stop = {
  onClick: (e: React.SyntheticEvent) => e.stopPropagation(),
  onPointerDown: (e: React.SyntheticEvent) => e.stopPropagation(),
  // Escape muss bis zum Dialog durch (schließt ihn)
  onKeyDown: (e: React.KeyboardEvent) => e.key !== "Escape" && e.stopPropagation(),
};

export function LeadActions({ lead, size = "sm" }: { lead: Lead; size?: "sm" | "md" }) {
  const toast = useToast();
  const [busy, setBusy] = useState<"einladen" | "onboarding" | null>(null);
  const [dialog, setDialog] = useState<"angebot" | "absage" | null>(null);
  const [now] = useState(() => Date.now());

  async function run(action: "einladen" | "onboarding") {
    setBusy(action);
    try {
      const result = await api<{ done?: string[] }>(`/api/sales/pipeline/${lead.id}/${action}`, { method: "POST" });
      revalidate("/api/sales/leads");
      revalidate("/api/sales/lead_activities");
      toast(action === "einladen" ? `Einladung an ${lead.email} gesendet` : `Onboarding gestartet${result.done?.length ? `: ${result.done.join(", ")}` : ""}`);
    } catch (e) {
      toast(e instanceof Error ? e.message : "Das hat nicht geklappt", "error");
    }
    setBusy(null);
  }

  const upcoming = lead.meeting_at && new Date(lead.meeting_at).getTime() > now - 60 * 60_000;

  return (
    <div {...stop} className="flex flex-col gap-2">
      {lead.stage === "neu" && (
        <>
          {lead.invited_at && <p className="text-[12px] text-snow/50">Eingeladen {relativeTime(lead.invited_at)} · wartet auf Buchung</p>}
          <div className="flex flex-wrap gap-1.5">
            <Button
              size={size}
              variant={lead.invited_at ? "secondary" : "primary"}
              icon={<CalendarPlus className="h-4 w-4" />}
              loading={busy === "einladen"}
              loadingText="Wird gesendet …"
              disabled={!lead.email}
              title={lead.email ? undefined : "Keine E-Mail-Adresse"}
              onClick={() => run("einladen")}
            >
              {lead.invited_at ? "Erneut einladen" : "Termin einladen"}
            </Button>
            <Button
              size={size}
              variant="ghost"
              icon={<X className="h-4 w-4" />}
              aria-label="Absage"
              title="Absage"
              className={size === "sm" ? "w-8 px-0" : undefined}
              onClick={() => setDialog("absage")}
            >
              {size === "sm" ? null : "Absage"}
            </Button>
          </div>
        </>
      )}

      {lead.stage === "erstgespraech" && (
        <>
          {lead.meeting_at && (
            <p className="flex items-center gap-1.5 text-[12px] text-snow/75">
              <CalendarCheck className="h-3.5 w-3.5 shrink-0" />
              {when(lead.meeting_at)}
              {upcoming && lead.meeting_url && (
                <a href={lead.meeting_url} target="_blank" rel="noopener" className="ml-auto inline-flex items-center gap-1 text-snow hover:underline">
                  <Video className="h-3.5 w-3.5" /> Beitreten
                </a>
              )}
            </p>
          )}
          <div className="flex flex-wrap gap-1.5">
            <Button size={size} variant="primary" icon={<FileSignature className="h-4 w-4" />} onClick={() => setDialog("angebot")}>
              Angebot erstellen
            </Button>
            <Button
              size={size}
              variant="ghost"
              icon={<X className="h-4 w-4" />}
              aria-label="Absage"
              title="Absage"
              className={size === "sm" ? "w-8 px-0" : undefined}
              onClick={() => setDialog("absage")}
            >
              {size === "sm" ? null : "Absage"}
            </Button>
          </div>
        </>
      )}

      {lead.stage === "angebot" && (
        <>
          <p className="flex items-center gap-1.5 text-[12px] text-snow/60">
            <FileSignature className="h-3.5 w-3.5 shrink-0" />
            Wartet auf Unterschrift
            {lead.offer_id && (
              <Link href={`/finance/ausgangsrechnungen?id=${lead.offer_id}`} className="ml-auto text-snow/80 hover:underline">
                Angebot
              </Link>
            )}
          </p>
          <Button size={size} variant="ghost" icon={<FileSignature className="h-4 w-4" />} className="self-start" onClick={() => setDialog("angebot")}>
            Neues Angebot
          </Button>
        </>
      )}

      {lead.stage === "gewonnen" &&
        (lead.onboarding_at ? (
          <p className="flex items-center gap-1.5 text-[12px] text-success">
            <Rocket className="h-3.5 w-3.5 shrink-0" />
            {lead.kickoff_at ? `Kick-off ${when(lead.kickoff_at)}` : "Onboarding läuft · Kick-off offen"}
          </p>
        ) : (
          <Button
            size={size}
            variant="primary"
            icon={<Rocket className="h-4 w-4" />}
            loading={busy === "onboarding"}
            loadingText="Wird gestartet …"
            disabled={!lead.customer_id}
            onClick={() => run("onboarding")}
          >
            Onboarding starten
          </Button>
        ))}

      {dialog === "angebot" && <OfferDialog lead={lead} onClose={() => setDialog(null)} />}
      <LostDialog open={dialog === "absage"} lead={lead} onClose={() => setDialog(null)} />
    </div>
  );
}

const REASONS = ["Kein Bedarf", "Budget zu klein", "Passt nicht zu uns", "Keine Rückmeldung"];

const firstName = (name: string) => name.trim().split(/\s+/)[0] ?? name;

/** Höfliche Absage zum Anpassen im Verfassen-Fenster (Signatur kommt dort dazu) */
const declineText = (lead: Lead) =>
  [
    `Hallo ${firstName(lead.name)},`,
    "vielen Dank für deine Anfrage und dein Interesse an GRID!",
    "Wir haben uns das genau angeschaut, können dir aktuell aber leider kein passendes Angebot machen. Wir wünschen dir alles Gute und freuen uns, wenn sich unsere Wege später noch einmal kreuzen.",
    "Liebe Grüße",
  ].join("\n\n");

/** Absage bzw. „verloren“ mit Schnellauswahl des Grunds; optional mit
 * vorbereiteter Absage-Mail. „Spam“ löscht den Lead und sperrt den Absender. */
export function LostDialog({ open, lead, onClose, onDone }: { open: boolean; lead: Lead; onClose: () => void; onDone?: () => void }) {
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState<"absage" | "spam" | "partner" | null>(null);
  const router = useRouter();
  const [mail, setMail] = useState(!!lead.email);
  const toast = useToast();
  const label = lead.company || lead.name;

  async function submit(value = reason) {
    // Verfassen-Fenster direkt im Klick öffnen, sonst blockiert der Browser das Pop-up
    if (mail && lead.email) openCompose({ mode: "new", to: lead.email, subject: "Deine Anfrage bei GRID", body: declineText(lead) });
    setBusy("absage");
    try {
      await updateRow<Lead>("leads", lead.id, { status: "verloren", lost_reason: value.trim() || null });
      revalidate("/api/sales/leads");
      toast(`${label} aus der Pipeline genommen`);
      onClose();
      onDone?.();
    } catch {
      toast("Das hat nicht geklappt", "error");
    }
    setBusy(null);
  }

  async function spam() {
    setBusy("spam");
    try {
      const result = await api<{ blocked: string | null }>(`/api/sales/pipeline/${lead.id}/spam`, { method: "POST" });
      revalidate("/api/sales/leads");
      toast(result.blocked ? `${label} gelöscht, ${result.blocked} ist gesperrt` : `${label} gelöscht`);
      onClose();
      onDone?.();
    } catch (error) {
      toast(error instanceof Error ? error.message : "Löschen fehlgeschlagen", "error");
    }
    setBusy(null);
  }

  async function partner() {
    setBusy("partner");
    try {
      await api(`/api/sales/pipeline/${lead.id}/partner`, { method: "POST" });
      revalidate("/api/sales/leads");
      revalidate("/api/sales/partners");
      toast(`${label} ist jetzt im Netzwerk (Freelancer & Partner)`);
      onClose();
      onDone?.();
      router.push("/personal/netzwerk");
    } catch (error) {
      toast(error instanceof Error ? error.message : "Übernehmen fehlgeschlagen", "error");
    }
    setBusy(null);
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={`Absage: ${label}`}
      footer={
        <>
          <Button
            variant="danger"
            className="mr-auto"
            icon={<ShieldAlert className="h-4 w-4" />}
            onClick={spam}
            loading={busy === "spam"}
            loadingText="Wird gelöscht …"
            disabled={busy !== null}
            title="Lead löschen und Absender sperren (keine Absage-Mail)"
          >
            Spam
          </Button>
          <Button variant="ghost" onClick={onClose} disabled={busy !== null}>
            Abbrechen
          </Button>
          <Button variant="primary" onClick={() => submit()} loading={busy === "absage"} loadingText="Wird gespeichert …" disabled={busy !== null}>
            Absagen
          </Button>
        </>
      }
    >
      <p className="mb-3 text-sm text-snow/60">
        <strong className="font-medium text-snow/80">Absagen:</strong> Der Lead verschwindet aus der Pipeline und zählt in Analytics als verloren.{" "}
        <strong className="font-medium text-snow/80">Spam:</strong> Der Lead wird gelöscht, weitere Anfragen dieser Adresse landen nicht mehr in der Pipeline.
      </p>
      <div className="mb-4 flex flex-wrap gap-1.5">
        {REASONS.map((r) => (
          <button
            key={r}
            type="button"
            disabled={busy !== null}
            onClick={() => submit(r)}
            className="rounded-full border border-snow/15 px-3 py-1.5 text-[13px] text-snow/80 hover:bg-snow/[0.08] disabled:opacity-50"
          >
            {r}
          </button>
        ))}
      </div>
      <Field label="Oder eigener Grund">
        {(id) => <Input id={id} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="z. B. hat sich für andere Agentur entschieden" />}
      </Field>
      <button
        type="button"
        onClick={partner}
        disabled={busy !== null}
        aria-busy={busy === "partner"}
        className="mt-4 inline-flex items-center gap-2 text-[13.5px] text-snow/75 underline-offset-4 hover:text-snow hover:underline disabled:opacity-50"
      >
        {busy === "partner" ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Handshake className="h-4 w-4" />}
        {busy === "partner" ? "Wird übernommen …" : "Kein Kunde, sondern Partner: ins Netzwerk übernehmen"}
      </button>
      {lead.email && (
        <label className="mt-4 flex cursor-pointer items-center gap-2.5 text-[13.5px] text-snow/80">
          <input type="checkbox" checked={mail} onChange={(e) => setMail(e.target.checked)} className="h-4 w-4 accent-current" />
          Absage-Mail an {lead.email} vorbereiten (öffnet sich zum Prüfen, wird nicht automatisch gesendet)
        </label>
      )}
    </Dialog>
  );
}
