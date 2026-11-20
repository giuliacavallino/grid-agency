"use client";

import { useState } from "react";
import { ExternalLink, RefreshCw, Sparkles } from "lucide-react";
import { api } from "@/lib/api";
import { cn as clsx } from "@/lib/cn";
import type { MediaItem } from "@/lib/marketing";
import { Button, Dialog, Input, useToast } from "@/components/ui";

// „Mit KI in Canva gestalten“ und die Canva-Aktionen an einem Medium
// (in Canva bearbeiten, aus Canva aktualisieren)

export type CanvaFormat = "feed" | "story";
type Created = { item: MediaItem; edit_url: string | null; headline: string; subline: string };

const FORMATS: { value: CanvaFormat; label: string; hint: string }[] = [
  { value: "feed", label: "Feed", hint: "4:5 · 1080 × 1350" },
  { value: "story", label: "Story / Reel", hint: "9:16 · 1080 × 1920" },
];

export function CanvaAiDialog({
  workspaceId,
  caption,
  defaultFormat = "feed",
  onClose,
  onCreated,
}: {
  workspaceId: string;
  caption: string;
  defaultFormat?: CanvaFormat;
  onClose: () => void;
  onCreated: (item: MediaItem, editUrl: string | null) => void;
}) {
  const toast = useToast();
  const [brief, setBrief] = useState("");
  const [format, setFormat] = useState<CanvaFormat>(defaultFormat);
  const [busy, setBusy] = useState(false);
  const ready = !!caption.trim() || !!brief.trim();

  async function create() {
    setBusy(true);
    try {
      const result = await api<Created>("/api/marketing/canva/ai-design", { method: "POST", body: JSON.stringify({ workspace_id: workspaceId, caption, brief, format }) });
      onCreated(result.item, result.edit_url);
      toast(`Design „${result.headline}“ liegt in Canva`);
      onClose();
    } catch (error) {
      toast(error instanceof Error ? error.message : "Gestalten fehlgeschlagen", "error");
      setBusy(false);
    }
  }

  return (
    <Dialog
      open
      onClose={busy ? () => {} : onClose}
      title="Mit KI in Canva gestalten"
      footer={
        <>
          <Button variant="ghost" disabled={busy} onClick={onClose}>
            Abbrechen
          </Button>
          <Button variant="primary" icon={<Sparkles className="h-4 w-4" />} loading={busy} loadingText="Wird gestaltet …" disabled={!ready} onClick={create}>
            Gestalten
          </Button>
        </>
      }
    >
      <p className="mb-4 text-[13px] text-snow/65">
        Claude macht aus dem Text eine Headline, daraus entsteht eine Grafik in der CI. Sie landet als bearbeitbares Design in Canva und als Bild im Post.
      </p>
      <label className="mb-1 block text-xs font-medium text-snow/60" htmlFor="canva-ai-brief">
        Worum geht es auf der Grafik? <span className="font-normal text-snow/40">(optional)</span>
      </label>
      <Input
        id="canva-ai-brief"
        value={brief}
        onChange={(e) => setBrief(e.target.value)}
        maxLength={500}
        placeholder={caption.trim() ? "Sonst nutzt Claude den Text des Posts" : "z. B. „Kürbisbrot ab Montag“"}
        className="mb-4 h-10"
        disabled={busy}
      />
      <p className="mb-1 text-xs font-medium text-snow/60">Format</p>
      <div className="flex gap-2" role="radiogroup" aria-label="Format">
        {FORMATS.map((f) => (
          <button
            key={f.value}
            type="button"
            role="radio"
            aria-checked={format === f.value}
            disabled={busy}
            onClick={() => setFormat(f.value)}
            className={clsx("flex-1 rounded-xl border px-3 py-2 text-left", format === f.value ? "border-snow bg-snow/[0.08]" : "border-snow/15 text-snow/65 hover:border-snow/35")}
          >
            <span className="block text-[13px] font-medium">{f.label}</span>
            <span className="block text-[11.5px] text-snow/50">{f.hint}</span>
          </button>
        ))}
      </div>
      {!ready && <p className="mt-3 text-[12px] text-snow/50">Erst Text schreiben oder eine Idee eingeben.</p>}
    </Dialog>
  );
}

/** Zwei kleine Aktionen unter einem Medium aus Canva */
export function CanvaMediaActions({ item, editUrl, onRefreshed }: { item: MediaItem; editUrl?: string; onRefreshed: (item: MediaItem) => void }) {
  const toast = useToast();
  const [busy, setBusy] = useState<"edit" | "refresh" | null>(null);
  const id = item.canva_design_id!;

  async function edit() {
    if (editUrl) return void window.open(editUrl, "_blank", "noopener");
    // Fenster sofort öffnen, sonst blockt der Browser das Pop-up nach dem Laden
    const win = window.open("", "_blank");
    setBusy("edit");
    try {
      const design = await api<{ edit_url: string | null }>(`/api/marketing/canva/designs/${encodeURIComponent(id)}`);
      if (!design.edit_url) throw new Error("Canva liefert keine Bearbeiten-Adresse");
      if (win) {
        win.opener = null;
        win.location.href = design.edit_url;
      } else window.open(design.edit_url, "_blank", "noopener");
    } catch (error) {
      win?.close();
      toast(error instanceof Error ? error.message : "Design nicht gefunden", "error");
    }
    setBusy(null);
  }

  async function refresh() {
    setBusy("refresh");
    try {
      onRefreshed(await api<MediaItem>("/api/marketing/canva/refresh", { method: "POST", body: JSON.stringify({ design_id: id }) }));
      toast("Aus Canva aktualisiert");
    } catch (error) {
      toast(error instanceof Error ? error.message : "Aktualisieren fehlgeschlagen", "error");
    }
    setBusy(null);
  }

  const small = "h-6 w-full justify-start gap-1 rounded-md px-1.5 text-[11px] [&>svg]:h-3 [&>svg]:w-3";
  return (
    <div className="mt-1 grid gap-0.5">
      <Button size="sm" variant="ghost" className={small} icon={<ExternalLink className="h-3 w-3" />} loading={busy === "edit"} loadingText="Öffnet …" disabled={busy !== null} aria-label="In Canva bearbeiten" title="In Canva bearbeiten" onClick={edit}>
        Bearbeiten
      </Button>
      <Button size="sm" variant="ghost" className={small} icon={<RefreshCw className="h-3 w-3" />} loading={busy === "refresh"} loadingText="Lädt …" disabled={busy !== null} aria-label="Aus Canva aktualisieren" title="Aus Canva aktualisieren" onClick={refresh}>
        Aktualisieren
      </Button>
    </div>
  );
}
