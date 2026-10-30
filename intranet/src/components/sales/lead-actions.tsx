"use client";

import { useState } from "react";
import Link from "next/link";
import { CalendarCheck, CalendarPlus, FileSignature, Rocket, Video, X } from "lucide-react";
import { api } from "@/lib/api";
import { revalidate, updateRow } from "@/lib/data";
import { relativeTime } from "@/lib/format";
import type { Lead } from "@/lib/sales/types";
import { Button, Dialog, Field, Input, useToast } from "@/components/ui";
import { OfferDialog } from "./offer-dialog";

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
            <Button size={size} variant="ghost" icon={<X className="h-4 w-4" />} onClick={() => setDialog("absage")}>
              Absage
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
            <Button size={size} variant="ghost" icon={<X className="h-4 w-4" />} onClick={() => setDialog("absage")}>
              Absage
            </Button>
          </div>
        </>
      )}

      {lead.stage === "angebot" && (
        <p className="flex items-center gap-1.5 text-[12px] text-snow/60">
          <FileSignature className="h-3.5 w-3.5 shrink-0" />
          Wartet auf Unterschrift
          {lead.offer_id && (
            <Link href={`/finance/ausgangsrechnungen?id=${lead.offer_id}`} className="ml-auto text-snow/80 hover:underline">
              Angebot
            </Link>
          )}
        </p>
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

const REASONS = ["Spam", "Kein Bedarf", "Budget zu klein", "Passt nicht zu uns", "Keine Rückmeldung"];

/** Absage bzw. „verloren“ mit Schnellauswahl des Grunds */
export function LostDialog({ open, lead, onClose, onDone }: { open: boolean; lead: Lead; onClose: () => void; onDone?: () => void }) {
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const toast = useToast();
  async function submit(value = reason) {
    setBusy(true);
    try {
      await updateRow<Lead>("leads", lead.id, { status: "verloren", lost_reason: value.trim() || null });
      revalidate("/api/sales/leads");
      toast(`${lead.company || lead.name} aus der Pipeline genommen`);
      onClose();
      onDone?.();
    } catch {
      toast("Das hat nicht geklappt", "error");
    }
    setBusy(false);
  }
  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={`Absage: ${lead.company || lead.name}`}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Abbrechen
          </Button>
          <Button variant="primary" onClick={() => submit()} loading={busy} loadingText="Wird gespeichert …">
            Absagen
          </Button>
        </>
      }
    >
      <p className="mb-3 text-sm text-snow/60">Der Lead verschwindet aus der Pipeline und zählt in Analytics als verloren.</p>
      <div className="mb-4 flex flex-wrap gap-1.5">
        {REASONS.map((r) => (
          <button
            key={r}
            type="button"
            disabled={busy}
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
    </Dialog>
  );
}
