"use client";

import { useCallback, useEffect, useRef, useState } from "react";
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
  const [saving, setSaving] = useState(0);
  const pending = useRef<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);

  // Speichert automatisch kurz nach dem Tippen, beim Verlassen und beim Schließen
  const flush = useCallback(async () => {
    clearTimeout(timer.current);
    if (pending.current === null) return;
    const value = pending.current.trim() || null;
    pending.current = null;
    setSaving((n) => n + 1);
    try {
      await updateRow<TaskProject>("task_projects", project.id, { briefing: value });
    } catch {
      toast("Speichern fehlgeschlagen", "error");
    }
    setSaving((n) => n - 1);
  }, [project.id, toast]);

  useEffect(() => () => void flush(), [flush]);

  function change(value: string) {
    setText(value);
    pending.current = value;
    clearTimeout(timer.current);
    timer.current = setTimeout(flush, 800);
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
          onChange={(e) => change(e.target.value)}
          onBlur={flush}
          autoFocus
          aria-label="Briefing"
          placeholder={"Über den Kunden, Ansprechpartner, Zugänge, Postingplan …"}
          className="min-h-[50dvh] flex-1 font-mono text-[13px]"
        />
        <div className="flex items-center gap-3">
          <Button
            variant="primary"
            loading={saving > 0}
            loadingText="Wird gespeichert …"
            onClick={async () => {
              await flush();
              setEditing(false);
            }}
          >
            Fertig
          </Button>
          <p className="text-[12px] text-snow/45">Wird automatisch gespeichert</p>
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
