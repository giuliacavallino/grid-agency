"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Copy, Pencil } from "lucide-react";
import { updateRow } from "@/lib/data";
import type { TaskProject } from "@/lib/tasks";
import { accentText } from "@/lib/theme";
import { Button, Empty, Sheet, Textarea, useToast } from "@/components/ui";
import { ProjectVault } from "@/components/admin/vault";

const LINK_PATTERN = /(https?:\/\/[^\s]+|[\w.+-]+@[\w-]+\.[\w.-]+)/g;
const LINK_CLASS = "break-all underline-offset-2 hover:underline";
const LINK_STYLE = { color: accentText("#3e7bfa") };

/** Text mit klickbaren Links und Mail-Adressen */
function Linked({ text }: { text: string }) {
  return text.split(LINK_PATTERN).map((part, i) =>
    i % 2 === 0 ? (
      part
    ) : part.includes("@") && !part.startsWith("http") ? (
      <a key={i} href={`mailto:${part}`} className={LINK_CLASS} style={LINK_STYLE}>
        {part}
      </a>
    ) : (
      <a key={i} href={part} target="_blank" rel="noreferrer" className={LINK_CLASS} style={LINK_STYLE}>
        {part}
      </a>
    )
  );
}

/** Kurze Zeile wie „Zugänge:“, „Instagram“ oder „Postingplan“ gilt als
 * Überschrift und wird fett gesetzt. */
function isHeading(line: string) {
  const t = line.trim();
  if (!t || t.length > 40 || /https?:|@/.test(t) || t.startsWith("-")) return false;
  if (t.endsWith(":")) return true;
  return t.length <= 30 && t.split(" ").length <= 3 && /^\p{Lu}/u.test(t) && !/\d|:|[.,;!?)]$/.test(t);
}

/** Briefing formatiert wie in Asana: Absätze, fette Überschriften, Links */
function BriefingText({ text }: { text: string }) {
  const lines = text.split("\n");
  return (
    <div className="text-[14px] leading-relaxed text-snow/90">
      {lines.map((line, i) =>
        !line.trim() ? (
          <div key={i} className="h-3" />
        ) : isHeading(line) ? (
          <p key={i} className="mt-1 font-semibold text-snow">
            {line.trim()}
          </p>
        ) : (
          <p key={i} className="whitespace-pre-wrap">
            <Linked text={line} />
          </p>
        )
      )}
    </div>
  );
}

/** Projektbriefing eines Kunden: Zugänge, Ansprechpartner, Postingplan.
 * Nur für angemeldete Mitarbeitende sichtbar (wie alles im Intranet). */
export function BriefingSheet({ project, open, onClose }: { project: TaskProject; open: boolean; onClose: () => void }) {
  return (
    <Sheet open={open} onClose={onClose} title="Briefing & Zugänge" subtitle={project.name} width="max-w-2xl">
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
          className="min-h-[50dvh] flex-1 text-[14px]"
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
      <ProjectVault projectId={project.id} />
      <div className="mt-4 flex items-center gap-2">
        <p className="mr-auto text-[13px] font-semibold">Briefing</p>
        <Button size="sm" variant="ghost" icon={<Copy className="h-3.5 w-3.5" />} onClick={copy}>
          Kopieren
        </Button>
        <Button size="sm" icon={<Pencil className="h-3.5 w-3.5" />} onClick={() => setEditing(true)}>
          Bearbeiten
        </Button>
      </div>
      {project.briefing ? (
        <div className="rounded-2xl border border-snow/[0.08] bg-surface p-5">
          <BriefingText text={project.briefing} />
        </div>
      ) : (
        <Empty title="Noch kein Briefing" />
      )}
    </div>
  );
}
