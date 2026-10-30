"use client";

import { useState } from "react";
import { Copy, Pencil } from "lucide-react";
import { updateRow } from "@/lib/data";
import type { TaskProject } from "@/lib/tasks";
import { Button, Empty, Sheet, Textarea, useToast } from "@/components/ui";

const URL_PATTERN = /(https?:\/\/[^\s]+)/g;

/** Text mit klickbaren Links */
function Linked({ text }: { text: string }) {
  return text.split(URL_PATTERN).map((part, i) =>
    i % 2 ? (
      <a key={i} href={part} target="_blank" rel="noreferrer" className="break-all underline decoration-snow/30 underline-offset-2 hover:decoration-snow">
        {part}
      </a>
    ) : (
      part
    )
  );
}

/** Projektbriefing eines Kunden: Zugänge, Ansprechpartner, Postingplan.
 * Nur für angemeldete Mitarbeitende sichtbar (wie alles im Intranet). */
export function BriefingSheet({ project, open, onClose }: { project: TaskProject; open: boolean; onClose: () => void }) {
  return (
    <Sheet open={open} onClose={onClose} title="Briefing" subtitle={project.name} width="max-w-2xl">
      <BriefingBody key={project.id} project={project} />
    </Sheet>
  );
}

function BriefingBody({ project }: { project: TaskProject }) {
  const toast = useToast();
  const [editing, setEditing] = useState(!project.briefing);
  const [text, setText] = useState(project.briefing ?? "");
  const [saving, setSaving] = useState(false);

  async function save() {
    setSaving(true);
    try {
      await updateRow<TaskProject>("task_projects", project.id, { briefing: text.trim() || null });
      setEditing(false);
      toast("Briefing gespeichert");
    } catch {
      toast("Speichern fehlgeschlagen", "error");
    }
    setSaving(false);
  }

  async function copy() {
    try {
      await navigator.clipboard.writeText(project.briefing ?? "");
      toast("In die Zwischenablage kopiert");
    } catch {
      toast("Kopieren nicht möglich", "error");
    }
  }

  if (editing) {
    return (
      <div className="flex h-full flex-col gap-3 p-5">
        <Textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          autoFocus
          aria-label="Briefing"
          placeholder={"Über den Kunden, Ansprechpartner, Zugänge, Postingplan …"}
          className="min-h-[50dvh] flex-1 font-mono text-[13px]"
        />
        <div className="flex gap-2">
          <Button variant="primary" onClick={save} loading={saving} loadingText="Wird gespeichert …" disabled={text === (project.briefing ?? "")}>
            Speichern
          </Button>
          {project.briefing && (
            <Button
              variant="ghost"
              onClick={() => {
                setText(project.briefing ?? "");
                setEditing(false);
              }}
            >
              Abbrechen
            </Button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3 p-5">
      <div className="flex gap-2">
        <Button size="sm" icon={<Pencil className="h-3.5 w-3.5" />} onClick={() => setEditing(true)}>
          Bearbeiten
        </Button>
        <Button size="sm" variant="ghost" icon={<Copy className="h-3.5 w-3.5" />} onClick={copy}>
          Kopieren
        </Button>
      </div>
      {project.briefing ? (
        <div className="rounded-2xl bg-snow/[0.04] p-4 text-[13.5px] leading-relaxed whitespace-pre-wrap text-snow/85">
          <Linked text={project.briefing} />
        </div>
      ) : (
        <Empty title="Noch kein Briefing" />
      )}
    </div>
  );
}
