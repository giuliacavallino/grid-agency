"use client";

import { useRef, useState } from "react";
import { AtSign, Camera, Trash2 } from "lucide-react";
import { apiFetch } from "@/lib/api";
import { cn as clsx } from "@/lib/cn";
import { revalidate } from "@/lib/data";
import { avatarUrl, type TaskProject } from "@/lib/tasks";
import { Button, Input, useToast } from "@/components/ui";

/** Profilbild des Kunden, sonst die Initiale auf seiner Farbe */
export function ProjectAvatar({ project, size = 40, className }: { project: TaskProject; size?: number; className?: string }) {
  const url = avatarUrl(project);
  const [broken, setBroken] = useState<string | null>(null);
  if (url && broken !== url) {
    return (
      // eslint-disable-next-line @next/next/no-img-element -- Bild aus dem Storage
      <img
        src={url}
        alt=""
        width={size}
        height={size}
        onError={() => setBroken(url)}
        className={clsx("shrink-0 rounded-full object-cover", className)}
        style={{ width: size, height: size, boxShadow: `0 0 0 2px ${project.color}` }}
      />
    );
  }
  return (
    <span
      aria-hidden
      className={clsx("grid shrink-0 place-items-center rounded-full font-semibold text-white", className)}
      style={{ width: size, height: size, background: project.color, fontSize: size * 0.42 }}
    >
      {project.name.trim().charAt(0).toUpperCase()}
    </span>
  );
}

/** Im Dialog „Kunde bearbeiten“: Bild von Instagram holen, hochladen oder entfernen */
export function AvatarEditor({ project }: { project: TaskProject }) {
  const toast = useToast();
  const file = useRef<HTMLInputElement>(null);
  const [handle, setHandle] = useState(project.instagram ? `@${project.instagram}` : "");
  const [busy, setBusy] = useState<"instagram" | "upload" | "remove" | null>(null);
  const url = `/api/aufgaben/projects/${project.id}/avatar`;

  async function run(kind: "instagram" | "upload" | "remove", init: RequestInit, done: string) {
    setBusy(kind);
    try {
      const response = await apiFetch(url, init);
      if (!response.ok) throw new Error(((await response.json().catch(() => ({}))) as { error?: string }).error ?? "Fehlgeschlagen");
      revalidate("/api/sales/task_projects");
      toast(done);
    } catch (error) {
      toast(error instanceof Error ? error.message : "Fehlgeschlagen", "error");
    }
    setBusy(null);
  }

  function upload(event: React.ChangeEvent<HTMLInputElement>) {
    const picked = event.target.files?.[0];
    event.target.value = "";
    if (!picked) return;
    const body = new FormData();
    body.append("file", picked);
    run("upload", { method: "POST", body }, "Profilbild gespeichert");
  }

  return (
    <div>
      <p className="mb-2 text-xs font-medium text-snow/60">Profilbild</p>
      <div className="flex items-center gap-3">
        <ProjectAvatar project={project} size={56} />
        <div className="flex min-w-0 flex-1 flex-col gap-2">
          <div className="flex gap-2">
            <Input aria-label="Instagram-Name" value={handle} onChange={(e) => setHandle(e.target.value)} placeholder="@instagram_name" className="min-w-0 flex-1" />
            <Button
              size="sm"
              className="h-10"
              icon={<AtSign className="h-4 w-4" />}
              loading={busy === "instagram"}
              loadingText="Lädt …"
              disabled={!handle.trim() || busy !== null}
              onClick={() => run("instagram", { method: "POST", body: JSON.stringify({ instagram: handle }) }, "Profilbild von Instagram übernommen")}
            >
              Laden
            </Button>
          </div>
          <div className="flex gap-2">
            <input ref={file} type="file" accept="image/*" className="hidden" onChange={upload} />
            <Button size="sm" variant="ghost" icon={<Camera className="h-4 w-4" />} loading={busy === "upload"} loadingText="Lädt hoch …" disabled={busy !== null} onClick={() => file.current?.click()}>
              Hochladen
            </Button>
            {project.avatar_path && (
              <Button size="sm" variant="ghost" icon={<Trash2 className="h-4 w-4" />} loading={busy === "remove"} loadingText="Entfernt …" disabled={busy !== null} onClick={() => run("remove", { method: "DELETE" }, "Profilbild entfernt")}>
                Entfernen
              </Button>
            )}
          </div>
        </div>
      </div>
      {project.avatar_source === "instagram" && <p className="mt-1.5 text-[12px] text-snow/45">Wird wöchentlich von Instagram aktualisiert.</p>}
    </div>
  );
}
