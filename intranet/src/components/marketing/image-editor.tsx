"use client";

import { useState } from "react";
import { Eraser, Sparkles, Stamp } from "lucide-react";
import { api } from "@/lib/api";
import { cn as clsx } from "@/lib/cn";
import type { MediaItem } from "@/lib/marketing";
import { Button, Dialog, Input, Select, useToast } from "@/components/ui";
import { useMarketingStatus } from "./common";

const FORMATS = [
  { id: "original", label: "Original" },
  { id: "4:5", label: "4:5 Feed" },
  { id: "9:16", label: "9:16 Story/Reel" },
  { id: "1:1", label: "1:1" },
  { id: "16:9", label: "16:9" },
  { id: "1.91:1", label: "1.91:1 Link" },
] as const;

const ASPECT: Record<string, string> = { "4:5": "4 / 5", "9:16": "9 / 16", "1:1": "1 / 1", "16:9": "16 / 9", "1.91:1": "1.91 / 1" };

type Adjust = { brightness: number; contrast: number; saturation: number };

/** Rohbild bearbeiten: Vorschau sofort im Browser, gerechnet wird beim
 * Übernehmen auf dem Server (das Original bleibt erhalten). */
export function ImageEditor({ image, workspaceId, onClose, onSaved }: { image: MediaItem; workspaceId: string; onClose: () => void; onSaved: (item: MediaItem) => void }) {
  const toast = useToast();
  const status = useMarketingStatus();
  const [current, setCurrent] = useState(image);
  const [format, setFormat] = useState<string>("4:5");
  const [adjust, setAdjust] = useState<Adjust>({ brightness: 0, contrast: 0, saturation: 0 });
  const [sharpen, setSharpen] = useState(false);
  const [logo, setLogo] = useState(false);
  const [position, setPosition] = useState("unten-rechts");
  const [prompt, setPrompt] = useState("");
  const [busy, setBusy] = useState<string | null>(null);

  // Vorschau der Korrekturen per CSS (entspricht ungefähr dem Server-Ergebnis)
  const filter = `brightness(${1 + adjust.brightness * 0.5}) contrast(${1 + adjust.contrast * 0.6}) saturate(${1 + adjust.saturation})`;

  async function run(kind: "edit" | "background" | "enhance") {
    setBusy(kind);
    try {
      const body =
        kind === "edit"
          ? { path: current.path, format, ...adjust, sharpen, ...(logo ? { logo: { workspace_id: workspaceId, position } } : {}) }
          : kind === "background"
            ? { path: current.path, ...(prompt.trim() ? { background_prompt: prompt.trim() } : {}) }
            : { path: current.path, upscale: true };
      const result = await api<MediaItem>(`/api/marketing/image/${kind}`, { method: "POST", body: JSON.stringify(body) });
      if (kind === "edit") {
        onSaved(result);
        onClose();
        return;
      }
      // KI-Schritte zuerst als neues Zwischenbild, dann weiter bearbeiten
      setCurrent(result);
      toast(kind === "background" ? "Hintergrund bearbeitet" : "Bild verbessert");
    } catch (error) {
      toast(error instanceof Error ? error.message : "Fehlgeschlagen", "error");
    }
    setBusy(null);
  }

  const slider = (key: keyof Adjust, label: string) => (
    <label className="grid gap-1 text-[12.5px] text-snow/70">
      <span className="flex justify-between">
        {label}
        <span className="tabular-nums text-snow/50">{Math.round(adjust[key] * 100)}</span>
      </span>
      <input
        type="range"
        min={-100}
        max={100}
        value={Math.round(adjust[key] * 100)}
        onChange={(e) => setAdjust((a) => ({ ...a, [key]: Number(e.target.value) / 100 }))}
        onDoubleClick={() => setAdjust((a) => ({ ...a, [key]: 0 }))}
        className="accent-[currentColor]"
      />
    </label>
  );

  return (
    <Dialog
      open
      onClose={onClose}
      title="Bild bearbeiten"
      width="max-w-3xl"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Abbrechen
          </Button>
          <Button variant="primary" loading={busy === "edit"} loadingText="Wird gerechnet …" disabled={busy !== null} onClick={() => run("edit")}>
            Übernehmen
          </Button>
        </>
      }
    >
      <div className="grid gap-5 md:grid-cols-[minmax(0,1fr)_260px]">
        <div className="grid place-items-center rounded-xl bg-[repeating-conic-gradient(#0000000d_0_25%,transparent_0_50%)] bg-[length:16px_16px] p-3">
          <div className="relative max-h-[60vh] w-full overflow-hidden rounded-lg" style={{ aspectRatio: ASPECT[format] ?? undefined }}>
            {/* eslint-disable-next-line @next/next/no-img-element -- Medien aus dem Storage */}
            <img src={current.url} alt="" className={clsx("h-full w-full", format === "original" ? "object-contain" : "object-cover")} style={{ filter }} />
            {logo && (
              <span
                className={clsx(
                  "absolute rounded bg-white/80 px-2 py-1 text-[10px] font-semibold text-black",
                  position.startsWith("oben") ? "top-3" : "bottom-3",
                  position.endsWith("links") ? "left-3" : "right-3"
                )}
              >
                Logo
              </span>
            )}
          </div>
        </div>

        <div className="grid content-start gap-4">
          <div>
            <p className="mb-1.5 text-xs font-medium text-snow/60">Format</p>
            <div className="flex flex-wrap gap-1.5">
              {FORMATS.map((f) => (
                <button
                  key={f.id}
                  type="button"
                  aria-pressed={format === f.id}
                  onClick={() => setFormat(f.id)}
                  className={clsx("h-8 rounded-full border px-2.5 text-[12px]", format === f.id ? "border-snow bg-snow text-sky" : "border-snow/15 text-snow/65 hover:text-snow")}
                >
                  {f.label}
                </button>
              ))}
            </div>
            <p className="mt-1 text-[11.5px] text-snow/45">Die Vorschau zeigt die Mitte; beim Übernehmen folgt der Ausschnitt automatisch dem Motiv.</p>
          </div>

          {slider("brightness", "Helligkeit")}
          {slider("contrast", "Kontrast")}
          {slider("saturation", "Sättigung")}
          <label className="flex items-center gap-2 text-[13px] text-snow/75">
            <input type="checkbox" checked={sharpen} onChange={(e) => setSharpen(e.target.checked)} className="h-4 w-4 accent-[#30a46c]" />
            Schärfen
          </label>
          <div className="flex flex-wrap items-center gap-2">
            <label className="flex items-center gap-2 text-[13px] text-snow/75">
              <input type="checkbox" checked={logo} onChange={(e) => setLogo(e.target.checked)} className="h-4 w-4 accent-[#30a46c]" />
              <Stamp className="h-4 w-4" /> Logo aus der CI
            </label>
            {logo && (
              <Select value={position} onChange={(e) => setPosition(e.target.value)} aria-label="Position" className="h-8 w-36">
                <option value="unten-rechts">unten rechts</option>
                <option value="unten-links">unten links</option>
                <option value="oben-rechts">oben rechts</option>
                <option value="oben-links">oben links</option>
              </Select>
            )}
          </div>

          <div className="grid gap-2 border-t border-snow/[0.08] pt-4">
            <p className="text-xs font-medium text-snow/60">KI-Werkzeuge</p>
            <Button
              size="sm"
              icon={<Sparkles className="h-4 w-4" />}
              loading={busy === "enhance"}
              loadingText="Wird verbessert …"
              disabled={busy !== null || !status.data?.tools.claid}
              title={status.data?.tools.claid ? undefined : "CLAID_API_KEY fehlt"}
              onClick={() => run("enhance")}
            >
              Automatisch verbessern
            </Button>
            <Input value={prompt} onChange={(e) => setPrompt(e.target.value)} placeholder="Neuer Hintergrund (leer = freistellen)" aria-label="Neuer Hintergrund" className="h-9 text-[13px]" />
            <Button
              size="sm"
              icon={<Eraser className="h-4 w-4" />}
              loading={busy === "background"}
              loadingText="Wird freigestellt …"
              disabled={busy !== null || !status.data?.tools.photoroom}
              title={status.data?.tools.photoroom ? undefined : "PHOTOROOM_API_KEY fehlt"}
              onClick={() => run("background")}
            >
              {prompt.trim() ? "Hintergrund ersetzen" : "Hintergrund entfernen"}
            </Button>
          </div>
        </div>
      </div>
    </Dialog>
  );
}
