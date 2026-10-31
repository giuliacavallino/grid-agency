"use client";

import { useState } from "react";
import { Check, Copy, ExternalLink, Plus, Trash2 } from "lucide-react";
import { api } from "@/lib/api";
import { cn as clsx } from "@/lib/cn";
import { revalidate, useResource } from "@/lib/data";
import { INVITATION_LIMIT, type Outreach, type OutreachKind } from "@/lib/marketing";
import { Badge, Button, Dialog, Empty, IconButton, Input, Spinner, Textarea, useToast } from "@/components/ui";
import { PageBar } from "@/components/sales/shell";
import { useCurrentWorkspace, WorkspaceSwitcher } from "./workspace";

// Marketing → Outreach: Nachrichten und Kontaktanfragen für LinkedIn. Der
// Agent (oder das Team) legt Entwürfe an. LinkedIn erlaubt das Senden per API
// nur ausgewählten Partnern; automatisches Senden über Drittanbieter verstößt
// gegen die Nutzervereinbarung. Darum: Text kopieren, Profil öffnen, auf
// LinkedIn einfügen, als gesendet markieren.

const KIND: Record<OutreachKind, string> = { message: "Nachricht", invitation: "Kontaktanfrage" };
const TABS: { id: Outreach["status"]; label: string }[] = [
  { id: "draft", label: "Entwürfe" },
  { id: "sent", label: "Gesendet" },
  { id: "discarded", label: "Verworfen" },
];

export function OutreachPage() {
  const toast = useToast();
  const { workspace } = useCurrentWorkspace();
  const url = workspace ? `/api/marketing/outreach?workspace=${workspace.id}` : null;
  const items = useResource<Outreach[]>(url);
  const [tab, setTab] = useState<Outreach["status"]>("draft");
  const [busy, setBusy] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  if (!workspace) {
    return (
      <div className="grid h-full place-items-center">
        <Spinner />
      </div>
    );
  }
  const list = (items.data ?? []).filter((o) => o.status === tab);

  async function update(item: Outreach, patch: Partial<Pick<Outreach, "text" | "status">>) {
    setBusy(item.id);
    try {
      await api(`/api/marketing/outreach/${item.id}`, { method: "PATCH", body: JSON.stringify(patch) });
      if (url) revalidate(url);
    } catch (error) {
      toast(error instanceof Error ? error.message : "Speichern fehlgeschlagen", "error");
    }
    setBusy(null);
  }

  async function remove(item: Outreach) {
    setBusy(item.id);
    try {
      await api(`/api/marketing/outreach/${item.id}`, { method: "DELETE" });
      if (url) revalidate(url);
    } catch (error) {
      toast(error instanceof Error ? error.message : "Löschen fehlgeschlagen", "error");
    }
    setBusy(null);
  }

  /** Text kopieren und das Profil öffnen: dort „Nachricht“ bzw. „Vernetzen“ → einfügen */
  async function open(item: Outreach) {
    try {
      if (item.text) await navigator.clipboard.writeText(item.text);
      toast(item.text ? "Text kopiert, auf LinkedIn einfügen" : "Profil geöffnet");
    } catch {
      toast("Kopieren nicht möglich", "error");
    }
    window.open(item.profile_url, "_blank", "noopener");
  }

  return (
    <div className="flex h-full flex-col">
      <PageBar title="Outreach" meta={workspace.name}>
        <WorkspaceSwitcher />
        <Button size="sm" className="h-9" icon={<Plus className="h-4 w-4" />} onClick={() => setCreating(true)}>
          Entwurf
        </Button>
      </PageBar>
      <div className="min-h-0 flex-1 overflow-y-auto pb-10">
        <p className="max-w-3xl px-4 pt-4 text-[13px] leading-relaxed text-snow/60 md:px-6">
          Der Agent schreibt Nachrichten und Kontaktanfragen als Entwurf. Senden geht über <strong className="font-medium text-snow/80">Kopieren & öffnen</strong>:
          Text wird kopiert, das Profil öffnet sich, dort „Nachricht“ oder „Vernetzen“ wählen und einfügen. LinkedIn gibt das Senden per Schnittstelle nicht frei;
          Automatisierung über Drittanbieter kann zur Sperre des Profils führen.
        </p>
        <div className="flex gap-1.5 px-4 pt-5 pb-2 md:px-6" role="tablist">
          {TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              role="tab"
              aria-selected={tab === t.id}
              onClick={() => setTab(t.id)}
              className={clsx("h-8 rounded-full px-3 text-[13px] transition-colors", tab === t.id ? "bg-snow text-sky" : "bg-snow/[0.06] text-snow/70 hover:bg-snow/[0.12]")}
            >
              {t.label}
              {t.id === "draft" && items.data ? ` (${items.data.filter((o) => o.status === "draft").length})` : ""}
            </button>
          ))}
        </div>
        {items.loading && !items.data ? (
          <div className="grid place-items-center py-16">
            <Spinner />
          </div>
        ) : !list.length ? (
          <Empty title="Nichts hier" text={tab === "draft" ? "Der Agent legt Entwürfe über POST /api/marketing/outreach an." : undefined} />
        ) : (
          <ul className="border-t border-snow/[0.06]">
            {list.map((item) => (
              <OutreachLine key={item.id} item={item} busy={busy === item.id} onOpen={() => open(item)} onUpdate={(patch) => update(item, patch)} onRemove={() => remove(item)} />
            ))}
          </ul>
        )}
      </div>
      <CreateDialog open={creating} workspaceId={workspace.id} onClose={() => setCreating(false)} onDone={() => url && revalidate(url)} />
    </div>
  );
}

function OutreachLine({
  item,
  busy,
  onOpen,
  onUpdate,
  onRemove,
}: {
  item: Outreach;
  busy: boolean;
  onOpen: () => void;
  onUpdate: (patch: Partial<Pick<Outreach, "text" | "status">>) => void;
  onRemove: () => void;
}) {
  const [text, setText] = useState(item.text);
  const changed = text !== item.text;
  const tooLong = item.kind === "invitation" && text.length > INVITATION_LIMIT;
  return (
    <li className="border-b border-snow/[0.06] px-4 py-3.5 md:px-6">
      <div className="flex flex-wrap items-center gap-2">
        <Badge color={item.kind === "invitation" ? "#7fa8ff" : "#30a46c"}>{KIND[item.kind]}</Badge>
        <a href={item.profile_url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-[14px] font-medium hover:underline">
          {item.recipient} <ExternalLink className="h-3 w-3 text-snow/50" />
        </a>
        <span className="text-[12px] text-snow/50">
          {item.created_by === "agent" ? "vom Agenten" : item.created_by} · {new Date(item.sent_at ?? item.created_at).toLocaleDateString("de-DE")}
        </span>
        <div className="flex-1" />
        <IconButton label="Löschen" className="h-8 w-8 text-snow/50 hover:text-error" disabled={busy} onClick={onRemove}>
          <Trash2 className="h-4 w-4" />
        </IconButton>
      </div>
      {item.context && <p className="mt-1 text-[12.5px] text-snow/55">{item.context}</p>}
      {item.status === "draft" ? (
        <>
          <Textarea aria-label="Text" className="mt-2" value={text} onChange={(e) => setText(e.target.value)} rows={item.kind === "invitation" ? 3 : 5} />
          {item.kind === "invitation" && (
            <p className={clsx("mt-1 text-right text-[12px]", tooLong ? "text-error" : "text-snow/45")}>
              {text.length}/{INVITATION_LIMIT}
            </p>
          )}
          <div className="mt-2 flex flex-wrap gap-2">
            <Button size="sm" variant="primary" icon={<Copy className="h-4 w-4" />} disabled={changed || tooLong} onClick={onOpen}>
              Kopieren & öffnen
            </Button>
            {changed ? (
              <Button size="sm" loading={busy} loadingText="Wird gespeichert …" disabled={tooLong} onClick={() => onUpdate({ text })}>
                Speichern
              </Button>
            ) : (
              <Button size="sm" icon={<Check className="h-4 w-4" />} loading={busy} loadingText="Wird gespeichert …" onClick={() => onUpdate({ status: "sent" })}>
                Als gesendet markieren
              </Button>
            )}
            <Button size="sm" variant="ghost" disabled={busy} onClick={() => onUpdate({ status: "discarded" })}>
              Verwerfen
            </Button>
          </div>
        </>
      ) : (
        <>
          <p className="mt-2 text-[13.5px] leading-relaxed whitespace-pre-wrap text-snow/80">{item.text || "(ohne Notiz)"}</p>
          <Button size="sm" variant="ghost" className="mt-2" loading={busy} onClick={() => onUpdate({ status: "draft" })}>
            Zurück zu den Entwürfen
          </Button>
        </>
      )}
    </li>
  );
}

function CreateDialog({ open, workspaceId, onClose, onDone }: { open: boolean; workspaceId: string; onClose: () => void; onDone: () => void }) {
  const toast = useToast();
  const [kind, setKind] = useState<OutreachKind>("message");
  const [recipient, setRecipient] = useState("");
  const [profile, setProfile] = useState("");
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);

  async function save() {
    setBusy(true);
    try {
      await api("/api/marketing/outreach", { method: "POST", body: JSON.stringify({ workspace_id: workspaceId, kind, recipient, profile_url: profile, text }) });
      setRecipient("");
      setProfile("");
      setText("");
      onDone();
      onClose();
    } catch (error) {
      toast(error instanceof Error ? error.message : "Speichern fehlgeschlagen", "error");
    }
    setBusy(false);
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Neuer Entwurf"
      width="max-w-xl"
      footer={
        <Button variant="primary" loading={busy} loadingText="Wird gespeichert …" disabled={!recipient.trim() || !profile.trim()} onClick={save}>
          Speichern
        </Button>
      }
    >
      <div className="space-y-3">
        <div className="flex gap-1.5" role="radiogroup" aria-label="Art">
          {(Object.keys(KIND) as OutreachKind[]).map((k) => (
            <button
              key={k}
              type="button"
              role="radio"
              aria-checked={kind === k}
              onClick={() => setKind(k)}
              className={clsx("h-8 rounded-full px-3 text-[13px]", kind === k ? "bg-snow text-sky" : "bg-snow/[0.06] text-snow/70 hover:bg-snow/[0.12]")}
            >
              {KIND[k]}
            </button>
          ))}
        </div>
        <Input aria-label="Name" value={recipient} onChange={(e) => setRecipient(e.target.value)} placeholder="Name" />
        <Input aria-label="Profil" value={profile} onChange={(e) => setProfile(e.target.value)} placeholder="https://www.linkedin.com/in/…" />
        <Textarea
          aria-label="Text"
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={kind === "invitation" ? 3 : 6}
          maxLength={kind === "invitation" ? INVITATION_LIMIT : 8000}
          placeholder={kind === "invitation" ? `Notiz (optional, max. ${INVITATION_LIMIT} Zeichen)` : "Nachricht"}
        />
      </div>
    </Dialog>
  );
}
