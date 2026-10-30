"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { clsx } from "clsx";
import { ArrowRight, Building2, Mail, MessageSquareText, Phone, Trash2, XCircle } from "lucide-react";
import { createRow, deleteRow, revalidate, updateRow, useRows } from "@/lib/data";
import { formatDateTime, relativeTime } from "@/lib/format";
import { SOURCES, STAGES, topPosition, type Activity, type Lead, type Stage } from "@/lib/sales/types";
import { Button, Dialog, Field, Input, Select, Sheet, Spinner, Textarea, useToast } from "@/components/ui";
import { SourceBadge } from "./source";
import { LeadActions, LostDialog } from "./lead-actions";

type Form = Record<
  "name" | "company" | "email" | "phone" | "value" | "budget" | "owner" | "next_step" | "next_step_at" | "source",
  string
>;

function toForm(lead: Lead): Form {
  return {
    name: lead.name ?? "",
    company: lead.company ?? "",
    email: lead.email ?? "",
    phone: lead.phone ?? "",
    value: lead.value?.toString() ?? "",
    budget: lead.budget ?? "",
    owner: lead.owner ?? "",
    next_step: lead.next_step ?? "",
    // datetime-local erwartet lokale Zeit ohne Zone
    next_step_at: lead.next_step_at ? toLocalInput(lead.next_step_at) : "",
    source: lead.source,
  };
}

function toLocalInput(value: string) {
  const d = new Date(value);
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().slice(0, 16);
}

function fromForm(form: Form): Partial<Lead> {
  return {
    name: form.name.trim(),
    company: form.company.trim() || null,
    email: form.email.trim() || null,
    phone: form.phone.trim() || null,
    value: form.value ? Number(form.value.replace(",", ".")) : null,
    budget: form.budget.trim() || null,
    owner: form.owner.trim() || null,
    next_step: form.next_step.trim() || null,
    next_step_at: form.next_step_at ? new Date(form.next_step_at).toISOString() : null,
    source: form.source as Lead["source"],
  };
}

const STAGE_LABEL = Object.fromEntries(STAGES.map((s) => [s.id, s.label])) as Record<Stage, string>;

export function LeadSheet({ id, onClose }: { id: string | null; onClose: () => void }) {
  const { data: leads } = useRows<Lead>("leads", "status=offen");
  const lead = leads?.find((l) => l.id === id) ?? null;
  return (
    <Sheet
      open={!!id}
      onClose={onClose}
      title={lead ? lead.company || lead.name : "Lead"}
      subtitle={
        lead && (
          <span className="flex items-center gap-2">
            <SourceBadge source={lead.source} />
            angelegt {relativeTime(lead.created_at)}
          </span>
        )
      }
    >
      {lead ? <LeadDetail key={lead.id} lead={lead} onClose={onClose} /> : <div className="grid h-40 place-items-center"><Spinner /></div>}
    </Sheet>
  );
}

function LeadDetail({ lead, onClose }: { lead: Lead; onClose: () => void }) {
  const toast = useToast();
  const [form, setForm] = useState<Form>(() => toForm(lead));
  const [saving, setSaving] = useState(false);
  const [stageBusy, setStageBusy] = useState<Stage | null>(null);
  const [confirm, setConfirm] = useState<"lost" | "delete" | null>(null);
  const dirty = JSON.stringify(form) !== JSON.stringify(toForm(lead));

  const set = (key: keyof Form) => (event: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm((f) => ({ ...f, [key]: event.target.value }));

  async function save() {
    if (!form.name.trim()) return toast("Name fehlt", "error");
    setSaving(true);
    try {
      await updateRow<Lead>("leads", lead.id, fromForm(form));
      toast("Gespeichert");
    } catch {
      toast("Speichern fehlgeschlagen", "error");
    }
    setSaving(false);
  }

  async function moveTo(stage: Stage) {
    if (stage === lead.stage) return;
    setStageBusy(stage);
    try {
      const row = await updateRow<Lead & { _customer?: { name: string } }>("leads", lead.id, {
        stage,
        position: topPosition(),
      });
      revalidate("/api/sales/lead_activities");
      if (row._customer) {
        toast(`Kunde „${row._customer.name}“ angelegt`);
        revalidate("/api/sales/customers");
      }
    } catch {
      toast("Phase konnte nicht geändert werden", "error");
    }
    setStageBusy(null);
  }

  return (
    <div className="flex flex-col gap-6 p-5">
      {/* Phase */}
      <div>
        <p className="mb-2 text-xs font-medium text-snow/60">Phase</p>
        <div className="grid grid-cols-4 gap-1 rounded-2xl bg-ink/60 p-1">
          {STAGES.map((stage, index) => {
            const reached = STAGES.findIndex((s) => s.id === lead.stage) >= index;
            return (
              <button
                key={stage.id}
                type="button"
                onClick={() => moveTo(stage.id)}
                disabled={stageBusy !== null}
                aria-pressed={lead.stage === stage.id}
                aria-busy={stageBusy === stage.id || undefined}
                className={clsx(
                  "relative rounded-xl px-1 py-2 text-[11px] leading-tight font-medium transition-colors disabled:cursor-progress",
                  lead.stage === stage.id
                    ? "bg-snow text-sky"
                    : reached
                      ? "bg-snow/12 text-snow/85 hover:bg-snow/20"
                      : "text-snow/45 hover:bg-snow/8 hover:text-snow/80"
                )}
              >
                {stageBusy === stage.id ? <Spinner className="mx-auto h-3.5 w-3.5 text-current" /> : stage.label}
              </button>
            );
          })}
        </div>
        <div className="mt-3">
          <LeadActions lead={lead} size="md" />
        </div>
        {lead.customer_id && (
          <Link
            href={`/sales/kunden?id=${lead.customer_id}`}
            className="mt-3 inline-flex items-center gap-2 text-sm text-success hover:underline"
          >
            <Building2 className="h-4 w-4" /> Zum Kunden <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        )}
      </div>

      {/* Kontakt + Deal */}
      <div className="grid grid-cols-2 gap-3">
        <Field label="Name *">{(id) => <Input id={id} value={form.name} onChange={set("name")} />}</Field>
        <Field label="Firma">{(id) => <Input id={id} value={form.company} onChange={set("company")} />}</Field>
        <Field label="E-Mail">{(id) => <Input id={id} type="email" value={form.email} onChange={set("email")} />}</Field>
        <Field label="Telefon">{(id) => <Input id={id} type="tel" value={form.phone} onChange={set("phone")} />}</Field>
        <Field label="Wert (€ pro Monat)">
          {(id) => <Input id={id} inputMode="decimal" value={form.value} onChange={set("value")} placeholder="z. B. 2490" />}
        </Field>
        <Field label="Quelle">
          {(id) => (
            <Select id={id} value={form.source} onChange={set("source")}>
              {SOURCES.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.label}
                </option>
              ))}
            </Select>
          )}
        </Field>
        <Field label="Nächster Schritt" className="col-span-2 sm:col-span-1">
          {(id) => <Input id={id} value={form.next_step} onChange={set("next_step")} placeholder="z. B. Angebot schicken" />}
        </Field>
        <Field label="Fällig am" className="col-span-2 sm:col-span-1">
          {(id) => <Input id={id} type="datetime-local" value={form.next_step_at} onChange={set("next_step_at")} />}
        </Field>
        <Field label="Budget laut Anfrage">{(id) => <Input id={id} value={form.budget} onChange={set("budget")} />}</Field>
        <Field label="Verantwortlich">{(id) => <Input id={id} value={form.owner} onChange={set("owner")} placeholder="name@grid-agency.de" />}</Field>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Button variant="primary" onClick={save} loading={saving} loadingText="Wird gespeichert …" disabled={!dirty}>
          Speichern
        </Button>
        {lead.email && (
          <Link
            href={`/sales/posteingang?to=${encodeURIComponent(lead.email)}`}
            className="inline-flex h-10 items-center gap-2 rounded-full border border-snow/15 bg-snow/[0.06] px-4 text-sm font-medium hover:bg-snow/12"
          >
            <Mail className="h-4 w-4" /> Mail schreiben
          </Link>
        )}
        {lead.phone && (
          <a
            href={`tel:${lead.phone}`}
            className="inline-flex h-10 items-center gap-2 rounded-full border border-snow/15 bg-snow/[0.06] px-4 text-sm font-medium hover:bg-snow/12"
          >
            <Phone className="h-4 w-4" /> Anrufen
          </a>
        )}
      </div>

      {lead.message && (
        <section>
          <p className="mb-2 flex items-center gap-2 text-xs font-medium text-snow/60">
            <MessageSquareText className="h-3.5 w-3.5" /> Ursprüngliche Anfrage
          </p>
          <p className="rounded-2xl bg-ink/60 p-4 text-sm leading-relaxed whitespace-pre-wrap text-snow/80">{lead.message}</p>
        </section>
      )}

      <Timeline leadId={lead.id} />

      <div className="flex flex-wrap gap-2 border-t border-snow/10 pt-5">
        <Button variant="ghost" icon={<XCircle className="h-4 w-4" />} onClick={() => setConfirm("lost")}>
          Als verloren markieren
        </Button>
        <Button variant="ghost" className="text-error/80 hover:text-error" icon={<Trash2 className="h-4 w-4" />} onClick={() => setConfirm("delete")}>
          Löschen
        </Button>
      </div>

      <LostDialog open={confirm === "lost"} lead={lead} onClose={() => setConfirm(null)} onDone={onClose} />
      <ConfirmDelete open={confirm === "delete"} lead={lead} onClose={() => setConfirm(null)} onDone={onClose} />
    </div>
  );
}

function Timeline({ leadId }: { leadId: string }) {
  const { data: activities, loading } = useRows<Activity>("lead_activities", `lead_id=${leadId}`);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const toast = useToast();

  async function addNote() {
    if (!note.trim()) return;
    setBusy(true);
    try {
      await createRow<Activity>("lead_activities", { lead_id: leadId, kind: "notiz", body: note.trim() });
      revalidate(`/api/sales/lead_activities?lead_id=${leadId}`);
      setNote("");
    } catch {
      toast("Notiz konnte nicht gespeichert werden", "error");
    }
    setBusy(false);
  }

  const sorted = [...(activities ?? [])].sort((a, b) => b.created_at.localeCompare(a.created_at));

  return (
    <section>
      <p className="mb-2 text-xs font-medium text-snow/60">Verlauf</p>
      <div className="mb-4 flex flex-col gap-2">
        <Textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Notiz, Gesprächsergebnis, Absprache …"
          className="min-h-20"
          onKeyDown={(e) => {
            if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) addNote();
          }}
        />
        <Button size="sm" className="self-end" onClick={addNote} loading={busy} loadingText="Wird gespeichert …" disabled={!note.trim()}>
          Notiz speichern
        </Button>
      </div>
      {loading ? (
        <Spinner />
      ) : (
        <ol className="relative flex flex-col gap-4 border-l border-snow/12 pl-4">
          {sorted.map((a) => (
            <li key={a.id} className="relative">
              <span className="absolute top-1.5 -left-[21px] h-2 w-2 rounded-full bg-snow/40 ring-4 ring-panel" />
              <p className="text-[12px] text-snow/45">
                {formatDateTime(a.created_at)}
                {a.author && ` · ${a.author}`}
              </p>
              <p className="mt-0.5 text-sm whitespace-pre-wrap text-snow/85">
                {a.kind === "stage"
                  ? a.from_stage
                    ? `${STAGE_LABEL[a.from_stage]} → ${a.to_stage ? STAGE_LABEL[a.to_stage] : ""}`
                    : (a.body ?? "Lead angelegt")
                  : a.body}
              </p>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}

function ConfirmDelete({ open, lead, onClose, onDone }: { open: boolean; lead: Lead; onClose: () => void; onDone: () => void }) {
  const [busy, setBusy] = useState(false);
  const toast = useToast();
  async function submit() {
    setBusy(true);
    try {
      await deleteRow("leads", lead.id);
      toast("Lead gelöscht");
      onClose();
      onDone();
    } catch {
      toast("Löschen fehlgeschlagen", "error");
    }
    setBusy(false);
  }
  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Lead löschen?"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>Abbrechen</Button>
          <Button variant="danger" onClick={submit} loading={busy} loadingText="Wird gelöscht …">
            Endgültig löschen
          </Button>
        </>
      }
    >
      <p className="text-sm text-snow/60">
        {lead.company || lead.name} wird mit Verlauf gelöscht. Für Analytics besser „Als verloren markieren“ nutzen.
      </p>
    </Dialog>
  );
}

export function NewLeadDialog({
  open,
  onClose,
  onCreated,
  initial,
}: {
  open: boolean;
  onClose: () => void;
  onCreated?: (lead: Lead) => void;
  initial?: Partial<Lead>;
}) {
  const empty = { name: "", company: "", email: "", phone: "", value: "", source: "manuell", message: "" };
  const [form, setForm] = useState(empty);
  const [busy, setBusy] = useState(false);
  const toast = useToast();

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- Formular beim Öffnen vorbelegen
    if (open) setForm({ ...empty, ...Object.fromEntries(Object.entries(initial ?? {}).map(([k, v]) => [k, v == null ? "" : String(v)])) });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const set = (key: keyof typeof empty) => (event: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setForm((f) => ({ ...f, [key]: event.target.value }));

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!form.name.trim()) return toast("Bitte einen Namen eintragen", "error");
    setBusy(true);
    try {
      const lead = await createRow<Lead>("leads", {
        ...(initial ?? {}),
        name: form.name.trim(),
        company: form.company.trim() || null,
        email: form.email.trim() || null,
        phone: form.phone.trim() || null,
        value: form.value ? Number(form.value.replace(",", ".")) : null,
        source: form.source as Lead["source"],
        message: form.message.trim() || null,
        stage: "neu",
        position: topPosition(),
      });
      toast("Lead angelegt");
      onClose();
      onCreated?.(lead);
    } catch (error) {
      toast(error instanceof Error && /duplicate|unique/i.test(error.message) ? "Diesen Lead gibt es schon" : "Anlegen fehlgeschlagen", "error");
    }
    setBusy(false);
  }

  return (
    <Dialog open={open} onClose={onClose} title="Neuer Lead">
      <form onSubmit={submit} className="grid grid-cols-2 gap-3">
        <Field label="Name *">{(id) => <Input id={id} value={form.name} onChange={set("name")} autoFocus />}</Field>
        <Field label="Firma">{(id) => <Input id={id} value={form.company} onChange={set("company")} />}</Field>
        <Field label="E-Mail">{(id) => <Input id={id} type="email" value={form.email} onChange={set("email")} />}</Field>
        <Field label="Telefon">{(id) => <Input id={id} type="tel" value={form.phone} onChange={set("phone")} />}</Field>
        <Field label="Wert (€ pro Monat)">{(id) => <Input id={id} inputMode="decimal" value={form.value} onChange={set("value")} />}</Field>
        <Field label="Quelle">
          {(id) => (
            <Select id={id} value={form.source} onChange={set("source")}>
              {SOURCES.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.label}
                </option>
              ))}
            </Select>
          )}
        </Field>
        <Field label="Anfrage / Notiz" className="col-span-2">
          {(id) => <Textarea id={id} value={form.message} onChange={set("message")} />}
        </Field>
        <div className="col-span-2 flex justify-end gap-2 pt-2">
          <Button variant="ghost" onClick={onClose}>Abbrechen</Button>
          <Button type="submit" variant="primary" loading={busy} loadingText="Wird angelegt …">
            Lead anlegen
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
