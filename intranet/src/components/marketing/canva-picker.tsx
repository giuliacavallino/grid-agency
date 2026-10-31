"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import { api } from "@/lib/api";
import { useResource } from "@/lib/data";
import type { MediaItem } from "@/lib/marketing";
import { Button, Dialog, Input, Spinner, useToast } from "@/components/ui";

// Design aus Canva wählen oder neu anlegen und als Bild/Video exportieren

type Design = { id: string; title: string; thumbnail: string | null; edit_url: string | null };

export function CanvaPicker({ workspaceId, onClose, onPicked }: { workspaceId: string; onClose: () => void; onPicked: (media: MediaItem[]) => void }) {
  const toast = useToast();
  const [query, setQuery] = useState("");
  const [search, setSearch] = useState("");
  const designs = useResource<{ items: Design[] }>(`/api/marketing/canva/designs${search ? `?query=${encodeURIComponent(search)}` : ""}`);
  const [busy, setBusy] = useState<string | null>(null);

  async function pick(design: Design, format: "png" | "mp4") {
    setBusy(`${design.id}:${format}`);
    try {
      const { media } = await api<{ media: MediaItem[] }>("/api/marketing/canva/export", { method: "POST", body: JSON.stringify({ design_id: design.id, format }) });
      onPicked(media);
      onClose();
    } catch (error) {
      toast(error instanceof Error ? error.message : "Export fehlgeschlagen", "error");
    }
    setBusy(null);
  }

  async function create() {
    setBusy("new");
    try {
      const design = await api<Design>("/api/marketing/canva/designs", { method: "POST", body: JSON.stringify({ title: query || "Neuer Post", workspace_id: workspaceId }) });
      if (design.edit_url) window.open(design.edit_url, "_blank", "noopener");
      designs.reload();
    } catch (error) {
      toast(error instanceof Error ? error.message : "Anlegen fehlgeschlagen", "error");
    }
    setBusy(null);
  }

  return (
    <Dialog open onClose={onClose} title="Aus Canva" width="max-w-2xl">
      <form
        className="mb-3 flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          setSearch(query.trim());
        }}
      >
        <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Design suchen …" aria-label="Design suchen" className="h-9 flex-1" />
        <Button type="submit" size="sm" className="h-9">
          Suchen
        </Button>
        <Button size="sm" className="h-9" icon={<Plus className="h-4 w-4" />} loading={busy === "new"} loadingText="Wird angelegt …" onClick={create}>
          Neu (1080 × 1350)
        </Button>
      </form>
      {designs.error ? (
        <p className="text-[13px] text-error">{designs.error.message}</p>
      ) : designs.loading ? (
        <Spinner />
      ) : (
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {(designs.data?.items ?? []).map((d) => (
            <li key={d.id} className="rounded-xl border border-snow/[0.08] p-2">
              {d.thumbnail ? (
                // eslint-disable-next-line @next/next/no-img-element -- Vorschaubild von Canva
                <img src={d.thumbnail} alt="" className="aspect-square w-full rounded-lg object-cover" />
              ) : (
                <span className="grid aspect-square w-full place-items-center rounded-lg bg-snow/[0.06] text-[12px] text-snow/50">Canva</span>
              )}
              <p className="mt-1.5 truncate text-[13px]">{d.title}</p>
              <div className="mt-1.5 flex gap-1.5">
                <Button size="sm" className="flex-1" loading={busy === `${d.id}:png`} loadingText="Export …" disabled={busy !== null} onClick={() => pick(d, "png")}>
                  Bild
                </Button>
                <Button size="sm" className="flex-1" loading={busy === `${d.id}:mp4`} loadingText="Export …" disabled={busy !== null} onClick={() => pick(d, "mp4")}>
                  Video
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </Dialog>
  );
}
