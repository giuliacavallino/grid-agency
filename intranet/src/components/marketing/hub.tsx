"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { CalendarDays, Plus, Unplug } from "lucide-react";
import { api } from "@/lib/api";
import { revalidate } from "@/lib/data";
import { cn as clsx } from "@/lib/cn";
import { PROJECT_COLORS } from "@/lib/tasks";
import { Button, Dialog, Empty, Field, Input, Spinner, useToast } from "@/components/ui";
import { AkteHeader } from "@/components/akte/header";
import { ProviderMark, useMarketingStatus } from "./common";
import { URL_WORKSPACES, useWorkspaces, WorkspaceLogo, type WorkspaceSummary } from "./workspace";

/** Einstellungen → Kundenakten: alle Akten (GRID und Kunden), neue anlegen */
export function Workspaces() {
  const router = useRouter();
  const workspaces = useWorkspaces();
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    // „Neue Kundenakte“ aus dem Auswahlmenü der Übersicht
    // eslint-disable-next-line react-hooks/set-state-in-effect -- Parameter gibt es nur im Browser
    if (new URLSearchParams(window.location.search).get("neu")) setCreating(true);
  }, []);

  return (
    <div className="flex h-full flex-col">
      <AkteHeader title="Kundenakten" meta="GRID selbst und alle Kunden: je Akte eigene Kanäle, Aufgaben, Posts und Agent">
        <Button variant="primary" size="sm" className="h-9" icon={<Plus className="h-4 w-4" />} onClick={() => setCreating(true)}>
          Neue Kundenakte
        </Button>
      </AkteHeader>
      {workspaces.error ? (
        <Empty title="Kundenakten konnten nicht geladen werden" text={workspaces.error.message} />
      ) : workspaces.loading ? (
        <div className="grid flex-1 place-items-center">
          <Spinner />
        </div>
      ) : (
        <div className="min-h-0 flex-1 overflow-y-auto p-4 pb-10 md:p-7">
          <ul className="max-w-4xl overflow-hidden rounded-2xl border border-snow/[0.08] bg-panel">
            {(workspaces.data ?? []).map((ws) => {
              const channels = ws.accounts.filter((a) => a.provider !== "canva");
              return (
                <li key={ws.id} className="flex items-center gap-3 border-b border-snow/[0.06] px-4 py-3 last:border-0">
                  <WorkspaceLogo workspace={ws} size={40} box />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[15px] font-medium">
                      {ws.name} {ws.kind === "agency" && <span className="ml-1 text-[11px] tracking-wide text-snow/45 uppercase">Agentur</span>}
                    </p>
                    <p className="flex items-center gap-3 text-[12.5px] text-snow/55">
                      <span className="flex items-center gap-1">
                        {channels.length ? channels.map((a) => <ProviderMark key={a.id} provider={a.provider} className="h-5 min-w-5 text-[9px]" />) : <><Unplug className="h-3.5 w-3.5" /> keine Kanäle</>}
                      </span>
                      <span className="flex items-center gap-1">
                        <CalendarDays className="h-3.5 w-3.5" /> {ws.scheduled} geplant
                      </span>
                    </p>
                  </div>
                  <Button size="sm" onClick={() => router.push(`/akte/${ws.id}`)}>
                    Öffnen
                  </Button>
                </li>
              );
            })}
          </ul>
        </div>
      )}
      {creating && <BrandDialog open onClose={() => setCreating(false)} onSaved={(id) => router.push(`/akte/${id}/einstellungen/stammdaten`)} />}
    </div>
  );
}

/** Canva gehört GRID (ein Konto für alle Kundenwelten) */
export function CanvaCard() {
  const toast = useToast();
  const status = useMarketingStatus();
  const [busy, setBusy] = useState(false);
  const canva = status.data?.canva;

  async function connect() {
    setBusy(true);
    try {
      const { url } = await api<{ url: string }>("/api/marketing/connect/canva", { method: "POST", body: "{}" });
      window.location.assign(url);
    } catch (error) {
      toast(error instanceof Error ? error.message : "Verbinden fehlgeschlagen", "error");
      setBusy(false);
    }
  }

  if (!status.data) return null;
  return (
    <section className="flex flex-wrap items-center gap-3 rounded-2xl border border-snow/[0.08] bg-panel p-4">
      <ProviderMark provider="canva" className="h-9 min-w-9 text-[12px]" />
      <div className="min-w-0 flex-1">
        <p className="text-[15px] font-medium">Canva {canva ? `· ${canva.name}` : ""}</p>
        <p className={clsx("text-[12.5px]", canva?.status === "error" ? "text-error" : "text-snow/60")}>
          {canva
            ? canva.status === "error"
              ? canva.error
              : "Verbunden. Designs je Kundenwelt landen in eigenen Ordnern."
            : status.data.configured.canva
              ? "Ein Canva-Konto für ganz GRID: Designs anlegen, exportieren und posten."
              : `In Vercel fehlen ${status.data.env.canva}.`}
        </p>
      </div>
      <Button size="sm" variant={canva ? "secondary" : "primary"} loading={busy} loadingText="Weiterleiten …" disabled={!status.data.configured.canva} onClick={connect}>
        {canva ? "Neu verbinden" : "Canva verbinden"}
      </Button>
    </section>
  );
}

/** Onboarding bzw. CI bearbeiten: Name, Hauptfarbe, Zweitfarbe, Logo */
export function BrandDialog({ open, workspace, onClose, onSaved }: { open: boolean; workspace?: WorkspaceSummary | null; onClose: () => void; onSaved: (id: string) => void }) {
  const toast = useToast();
  const [name, setName] = useState(workspace?.name ?? "");
  const [color, setColor] = useState(workspace?.color ?? PROJECT_COLORS[0]);
  const [secondary, setSecondary] = useState(workspace?.secondary_color ?? "");
  const [logo, setLogo] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const preview = logo ? URL.createObjectURL(logo) : workspace?.logo_url;

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!name.trim()) return;
    setBusy(true);
    try {
      const body = JSON.stringify({ name, color, secondary_color: secondary || null });
      const saved = workspace
        ? await api<{ id: string }>(`${URL_WORKSPACES}/${workspace.id}`, { method: "PATCH", body })
        : await api<{ id: string }>(URL_WORKSPACES, { method: "POST", body });
      if (logo) {
        const form = new FormData();
        form.append("file", logo);
        await api(`${URL_WORKSPACES}/${saved.id}/logo`, { method: "POST", body: form });
      }
      revalidate(URL_WORKSPACES);
      onClose();
      onSaved(saved.id);
    } catch (error) {
      toast(error instanceof Error ? error.message : "Speichern fehlgeschlagen", "error");
    }
    setBusy(false);
  }

  return (
    <Dialog open={open} onClose={onClose} title={workspace ? `CI von ${workspace.name}` : "Neue Kundenwelt"}>
      <form onSubmit={submit} className="grid gap-4">
        <Field label="Kunde">{(id) => <Input id={id} value={name} onChange={(e) => setName(e.target.value)} placeholder="z. B. Huck" autoFocus />}</Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Hauptfarbe (CI)">
            {(id) => (
              <div className="flex items-center gap-2">
                <input id={id} type="color" value={color} onChange={(e) => setColor(e.target.value)} className="h-10 w-12 cursor-pointer rounded-lg border border-snow/15 bg-transparent" />
                <Input value={color} onChange={(e) => setColor(e.target.value)} aria-label="Hauptfarbe als Hex" className="font-mono" />
              </div>
            )}
          </Field>
          <Field label="Zweitfarbe (optional)">
            {(id) => (
              <div className="flex items-center gap-2">
                <input id={id} type="color" value={secondary || color} onChange={(e) => setSecondary(e.target.value)} className="h-10 w-12 cursor-pointer rounded-lg border border-snow/15 bg-transparent" />
                <Input value={secondary} onChange={(e) => setSecondary(e.target.value)} placeholder="#" aria-label="Zweitfarbe als Hex" className="font-mono" />
              </div>
            )}
          </Field>
        </div>
        <div className="flex flex-wrap gap-2" aria-label="Schnellauswahl">
          {PROJECT_COLORS.map((c) => (
            <button key={c} type="button" aria-label={c} onClick={() => setColor(c)} className={clsx("h-6 w-6 rounded-full border-2", c === color ? "border-snow" : "border-transparent")} style={{ background: c }} />
          ))}
        </div>
        <Field label="Logo (PNG, JPG oder WebP)">
          {(id) => (
            <div className="flex items-center gap-3">
              {preview ? (
                // eslint-disable-next-line @next/next/no-img-element -- Vorschau des Logos
                <img src={preview} alt="" className="h-12 w-12 rounded-lg bg-white object-contain" style={{ boxShadow: `0 0 0 2px ${color}` }} />
              ) : (
                <span className="h-12 w-12 rounded-lg" style={{ background: color }} />
              )}
              <input id={id} type="file" accept="image/png,image/jpeg,image/webp" onChange={(e) => setLogo(e.target.files?.[0] ?? null)} className="text-[13px] text-snow/60 file:mr-3 file:rounded-full file:border-0 file:bg-snow/10 file:px-3 file:py-1.5 file:text-[13px] file:text-snow" />
            </div>
          )}
        </Field>
        <div className="h-2 rounded-full" style={{ background: `linear-gradient(90deg, ${color}, ${secondary || color})` }} aria-hidden />
        <div className="mt-1 flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>
            Abbrechen
          </Button>
          <Button variant="primary" type="submit" loading={busy} loadingText="Wird gespeichert …" disabled={!name.trim()}>
            {workspace ? "Speichern" : "Anlegen"}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
