"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Copy, Eye, EyeOff, ExternalLink, KeyRound, Lock, PanelRightOpen, Plus, Search, Trash2, Wand2 } from "lucide-react";
import { cn as clsx } from "@/lib/cn";
import { useIsAdmin } from "@/components/access";
import { useResource, useRows } from "@/lib/data";
import { formatDateTime, relativeTime } from "@/lib/format";
import type { TaskProject } from "@/lib/tasks";
import { generatePassword, type VaultItem, type VaultLogEntry } from "@/lib/vault";
import { Avatar, Button, Dialog, Empty, Field, IconButton, Input, Select, Sheet, Spinner, Textarea, useToast } from "@/components/ui";
import { PageBar } from "@/components/sales/shell";
import { copyPassword, createVaultItem, deleteVaultItem, revealPassword, updateVaultItem, useVault, type VaultPatch } from "./vault-data";

const INTERNAL = "intern";

const useIsManagement = useIsAdmin;

function host(url: string | null) {
  if (!url) return null;
  try {
    return new URL(url.startsWith("http") ? url : `https://${url}`).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

/** Gruppen: intern (nur GF), aktive Kunden, ehemalige Kunden */
function useGroups(items: VaultItem[] | undefined, projects: TaskProject[] | undefined) {
  return useMemo(() => {
    const byProject = new Map((projects ?? []).map((p) => [p.id, p]));
    const groups: { id: string; label: string; color?: string; archived?: boolean; items: VaultItem[] }[] = [];
    const internal = (items ?? []).filter((i) => i.internal);
    if (internal.length) groups.push({ id: INTERNAL, label: "Intern · nur Geschäftsführung", items: internal });
    const sorted = [...(projects ?? [])].sort((a, b) => Number(a.archived) - Number(b.archived) || a.position - b.position);
    for (const p of sorted) {
      const list = (items ?? []).filter((i) => !i.internal && i.project_id === p.id);
      if (list.length) groups.push({ id: p.id, label: p.name, color: p.color, archived: p.archived, items: list });
    }
    const rest = (items ?? []).filter((i) => !i.internal && (!i.project_id || !byProject.has(i.project_id)));
    if (rest.length) groups.push({ id: "ohne", label: "Ohne Kunde", items: rest });
    return groups;
  }, [items, projects]);
}

/** Admin → Passwörter: alle Zugänge je Kunde, interne nur für die GF. */
export function Vault() {
  const vault = useVault();
  const projects = useRows<TaskProject>("task_projects");
  const management = useIsManagement();
  const [query, setQuery] = useState("");
  const [openId, setOpenId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    const names = new Map((projects.data ?? []).map((p) => [p.id, p.name.toLowerCase()]));
    return (vault.data ?? []).filter(
      (i) => !q || [i.title, i.username, i.url, i.notes, names.get(i.project_id ?? "")].some((v) => v?.toLowerCase().includes(q))
    );
  }, [vault.data, projects.data, query]);
  const groups = useGroups(visible, projects.data);
  const error = vault.error ?? projects.error;

  return (
    <div className="flex h-full flex-col">
      <PageBar title="Passwörter" meta={vault.data && `${vault.data.length} Zugänge · verschlüsselt gespeichert`}>
        <div className="relative min-w-0 flex-1 md:max-w-64">
          <Search className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-snow/40" />
          <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Kunde, Dienst, Benutzer …" aria-label="Zugänge durchsuchen" className="h-9 w-full pl-9" />
        </div>
        <Button variant="primary" size="sm" className="h-9" icon={<Plus className="h-4 w-4" />} onClick={() => setCreating(true)}>
          Neuer Zugang
        </Button>
      </PageBar>

      {error ? (
        <Empty title="Passwörter konnten nicht geladen werden" text={error.message} />
      ) : vault.loading || projects.loading ? (
        <div className="grid flex-1 place-items-center">
          <Spinner />
        </div>
      ) : groups.length === 0 ? (
        <Empty icon={<KeyRound className="h-8 w-8" />} title={query ? "Nichts gefunden" : "Noch keine Zugänge"} />
      ) : (
        <div className="min-h-0 flex-1 overflow-y-auto pb-10">
          <VaultHeader />
          {groups.map((group) => (
            <section key={group.id} className="pt-5">
              <h2 className="flex h-9 items-center gap-2 px-3 text-[15px] font-semibold md:px-6">
                {group.id === INTERNAL ? <Lock className="h-4 w-4 text-snow/60" /> : <span className="h-2.5 w-2.5 rounded-full" style={{ background: group.color ?? "#afaaa0" }} />}
                {group.label}
                {group.archived && <span className="text-[12px] font-normal text-snow/55">ehemalig</span>}
                <span className="text-[13px] font-normal text-snow/55">{group.items.length}</span>
              </h2>
              <ul className="border-t border-snow/[0.06]">
                {group.items.map((item) => (
                  <li key={item.id}>
                    <VaultRow item={item} onOpen={setOpenId} />
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}

      <VaultSheet item={vault.data?.find((i) => i.id === openId)} projects={projects.data ?? []} management={management} onClose={() => setOpenId(null)} />
      <NewVaultDialog open={creating} projects={projects.data ?? []} management={management} onClose={() => setCreating(false)} onCreated={setOpenId} />
    </div>
  );
}

function VaultHeader() {
  return (
    <div className="sticky top-0 z-10 hidden h-9 items-center gap-2 border-b border-snow/[0.08] bg-canvas pr-12 pl-[60px] text-[12px] text-snow/55 md:flex">
      <span className="flex-1">Dienst</span>
      <span className="w-64">Benutzer / E-Mail</span>
      <span className="w-56">Passwort</span>
    </div>
  );
}

/** Eine Zeile: Dienst, Benutzer (kopierbar), Passwort (anzeigen/kopieren) */
export function VaultRow({ item, onOpen, compact = false }: { item: VaultItem; onOpen?: (id: string) => void; compact?: boolean }) {
  const toast = useToast();
  const domain = host(item.url);
  return (
    <div className={clsx("group flex min-h-12 flex-wrap items-center gap-x-2 gap-y-1 border-b border-snow/[0.06] py-1.5 pr-2 hover:bg-snow/[0.03]", compact ? "pl-1" : "pl-3 md:pl-6")}>
      <div className="flex min-w-0 flex-1 basis-48 items-center gap-3">
        <Avatar name={item.title} className="h-7 w-7 rounded-lg text-[10px]" />
        <div className="min-w-0">
          <p className="truncate text-[14px] font-medium">{item.title}</p>
          {domain && (
            <a href={item.url!.startsWith("http") ? item.url! : `https://${item.url}`} target="_blank" rel="noreferrer" className="flex items-center gap-1 truncate text-[12px] text-snow/55 hover:text-snow">
              {domain} <ExternalLink className="h-3 w-3" />
            </a>
          )}
        </div>
        {onOpen && (
          <IconButton label="Details öffnen" className="ml-auto h-8 w-8 text-snow/55 md:hidden" onClick={() => onOpen(item.id)}>
            <PanelRightOpen className="h-4 w-4" />
          </IconButton>
        )}
      </div>
      <div className={clsx("flex min-w-0 items-center gap-1", compact ? "basis-full sm:basis-auto" : "w-full md:w-64")}>
        {item.username ? (
          <>
            <span className="truncate text-[13px] text-snow/80">{item.username}</span>
            <IconButton
              label="Benutzer kopieren"
              className="h-7 w-7 shrink-0 text-snow/55"
              onClick={async () => {
                try {
                  await navigator.clipboard.writeText(item.username!);
                  toast("Benutzer kopiert");
                } catch {
                  toast("Kopieren nicht möglich", "error");
                }
              }}
            >
              <Copy className="h-3.5 w-3.5" />
            </IconButton>
          </>
        ) : (
          <span className="text-[13px] text-snow/45">–</span>
        )}
      </div>
      <PasswordCell item={item} className={compact ? "" : "w-full md:w-56"} />
      {onOpen && (
        <IconButton label="Details öffnen" className="hidden h-8 w-8 text-snow/55 md:inline-flex" onClick={() => onOpen(item.id)}>
          <PanelRightOpen className="h-4 w-4" />
        </IconButton>
      )}
    </div>
  );
}

const HIDE_AFTER_MS = 20_000;

/** Passwort verdeckt; Anzeigen blendet es 20 Sekunden ein, Kopieren legt es
 * in die Zwischenablage. Beides holt das Passwort vom Server und wird
 * protokolliert. */
function PasswordCell({ item, className }: { item: VaultItem; className?: string }) {
  const toast = useToast();
  const [shown, setShown] = useState<string | null>(null);
  const [busy, setBusy] = useState<"show" | "copy" | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  useEffect(() => () => clearTimeout(timer.current), []);

  if (!item.has_secret) return <span className={clsx("text-[13px] text-snow/45", className)}>kein Passwort</span>;

  async function toggle() {
    if (shown !== null) {
      clearTimeout(timer.current);
      return setShown(null);
    }
    setBusy("show");
    try {
      setShown(await revealPassword(item.id, "show"));
      timer.current = setTimeout(() => setShown(null), HIDE_AFTER_MS);
    } catch {
      toast("Passwort konnte nicht geladen werden", "error");
    }
    setBusy(null);
  }

  async function copy() {
    setBusy("copy");
    try {
      await copyPassword(item.id);
      toast("Passwort kopiert");
    } catch {
      toast("Kopieren nicht möglich", "error");
    }
    setBusy(null);
  }

  return (
    <div className={clsx("flex min-w-0 items-center gap-1", className)}>
      <span className={clsx("min-w-0 flex-1 truncate font-mono text-[13px]", shown === null ? "tracking-widest text-snow/55" : "text-snow")}>
        {shown ?? "••••••••••"}
      </span>
      <IconButton label={shown === null ? "Passwort anzeigen" : "Passwort verbergen"} className="h-7 w-7 shrink-0 text-snow/55" onClick={toggle} disabled={busy !== null} aria-busy={busy === "show" || undefined}>
        {busy === "show" ? <Spinner className="h-3.5 w-3.5" /> : shown === null ? <Eye className="h-3.5 w-3.5" /> : <EyeOff className="h-3.5 w-3.5" />}
      </IconButton>
      <IconButton label="Passwort kopieren" className="h-7 w-7 shrink-0 text-snow/55" onClick={copy} disabled={busy !== null} aria-busy={busy === "copy" || undefined}>
        {busy === "copy" ? <Spinner className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
      </IconButton>
    </div>
  );
}

function ProjectSelect({ value, onChange, projects, management, id }: { value: string; onChange: (value: string) => void; projects: TaskProject[]; management: boolean; id?: string }) {
  const active = projects.filter((p) => !p.archived).sort((a, b) => a.position - b.position);
  const archived = projects.filter((p) => p.archived).sort((a, b) => a.name.localeCompare(b.name));
  return (
    <Select id={id} value={value} onChange={(e) => onChange(e.target.value)}>
      {management && <option value={INTERNAL}>Intern (nur Geschäftsführung)</option>}
      <option value="">Ohne Kunde</option>
      <optgroup label="Kunden">
        {active.map((p) => (
          <option key={p.id} value={p.id}>
            {p.name}
          </option>
        ))}
      </optgroup>
      {archived.length > 0 && (
        <optgroup label="Ehemalige">
          {archived.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </optgroup>
      )}
    </Select>
  );
}

const scopeOf = (item: Pick<VaultItem, "internal" | "project_id">) => (item.internal ? INTERNAL : (item.project_id ?? ""));
const scopePatch = (value: string): VaultPatch => (value === INTERNAL ? { internal: true, project_id: null } : { internal: false, project_id: value || null });

function VaultSheet({ item, projects, management, onClose }: { item?: VaultItem; projects: TaskProject[]; management: boolean; onClose: () => void }) {
  return (
    <Sheet open={!!item} onClose={onClose} title={item?.title ?? "Zugang"} subtitle={item && (item.internal ? "Intern" : (projects.find((p) => p.id === item.project_id)?.name ?? "Ohne Kunde"))}>
      {item && <VaultDetail key={item.id} item={item} projects={projects} management={management} onClose={onClose} />}
    </Sheet>
  );
}

/** Bearbeiten ohne Speichern-Knopf: Felder speichern beim Verlassen,
 * ein neues Passwort beim Klick auf „Übernehmen“. */
function VaultDetail({ item, projects, management, onClose }: { item: VaultItem; projects: TaskProject[]; management: boolean; onClose: () => void }) {
  const toast = useToast();
  const [form, setForm] = useState({ title: item.title, username: item.username ?? "", url: item.url ?? "", notes: item.notes ?? "" });
  const [password, setPassword] = useState("");
  const [saving, setSaving] = useState(0);
  const [savingPassword, setSavingPassword] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const log = useResource<VaultLogEntry[]>(`/api/audit/vault?item=${item.id}`);

  const save = useCallback(
    async (patch: VaultPatch) => {
      setSaving((n) => n + 1);
      try {
        await updateVaultItem(item.id, patch);
      } catch (error) {
        toast(error instanceof Error ? error.message : "Speichern fehlgeschlagen", "error");
      }
      setSaving((n) => n - 1);
    },
    [item.id, toast]
  );

  const saveField = (key: keyof typeof form) => () => {
    const value = form[key].trim();
    if (key === "title" && !value) return setForm((f) => ({ ...f, title: item.title }));
    if (value !== (item[key] ?? "")) save({ [key]: value || null });
  };

  async function savePassword() {
    setSavingPassword(true);
    try {
      await updateVaultItem(item.id, { password });
      setPassword("");
      log.reload();
      toast("Passwort gespeichert");
    } catch {
      toast("Speichern fehlgeschlagen", "error");
    }
    setSavingPassword(false);
  }

  async function remove() {
    setDeleting(true);
    try {
      await deleteVaultItem(item.id);
      onClose();
    } catch {
      toast("Löschen fehlgeschlagen", "error");
      setDeleting(false);
    }
  }

  const set = (key: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setForm((f) => ({ ...f, [key]: e.target.value }));

  return (
    <div className="flex flex-col gap-5 p-5">
      <div className="rounded-2xl border border-snow/[0.08] bg-surface">
        <VaultRow item={item} compact />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Field label="Dienst">{(id) => <Input id={id} value={form.title} onChange={set("title")} onBlur={saveField("title")} />}</Field>
        <Field label="Kunde">
          {(id) => <ProjectSelect id={id} value={scopeOf(item)} onChange={(v) => save(scopePatch(v))} projects={projects} management={management} />}
        </Field>
        <Field label="Benutzer / E-Mail" className="col-span-2">
          {(id) => <Input id={id} value={form.username} onChange={set("username")} onBlur={saveField("username")} autoComplete="off" />}
        </Field>
        <Field label="Link" className="col-span-2">
          {(id) => <Input id={id} value={form.url} onChange={set("url")} onBlur={saveField("url")} placeholder="https://" />}
        </Field>
        <Field label={item.has_secret ? "Neues Passwort" : "Passwort"} className="col-span-2">
          {(id) => (
            <div className="flex gap-2">
              <Input id={id} value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="new-password" className="font-mono" placeholder={item.has_secret ? "Nur ausfüllen, um es zu ändern" : ""} />
              <IconButton label="Sicheres Passwort erzeugen" className="h-10 w-10 shrink-0" onClick={() => setPassword(generatePassword())}>
                <Wand2 className="h-4 w-4" />
              </IconButton>
              <Button onClick={savePassword} loading={savingPassword} loadingText="Wird gespeichert …" disabled={!password}>
                Übernehmen
              </Button>
            </div>
          )}
        </Field>
        <Field label="Notizen" className="col-span-2">
          {(id) => <Textarea id={id} rows={4} value={form.notes} onChange={set("notes")} onBlur={saveField("notes")} placeholder="z. B. 2FA geht an …, Wiederherstellungscodes …" />}
        </Field>
      </div>

      <div className="flex items-center gap-2 border-t border-snow/[0.08] pt-4">
        <p className="flex items-center gap-1.5 text-[12px] text-snow/55" aria-live="polite">
          {saving > 0 ? (
            <>
              <Spinner className="h-3.5 w-3.5" /> Wird gespeichert …
            </>
          ) : (
            "Änderungen werden automatisch gespeichert"
          )}
        </p>
        <Button variant="ghost" size="sm" className="ml-auto text-error" icon={<Trash2 className="h-4 w-4" />} onClick={() => setConfirmDelete(true)}>
          Löschen
        </Button>
      </div>

      <div>
        <p className="mb-2 text-xs font-medium text-snow/60">Verlauf</p>
        {log.loading ? (
          <Spinner className="h-4 w-4" />
        ) : (
          <ul className="flex flex-col gap-1.5 text-[12.5px] text-snow/65">
            {(log.data ?? []).slice(0, 12).map((entry) => (
              <li key={entry.id} className="flex gap-2" title={formatDateTime(entry.at)}>
                <span className="text-snow/80">{entry.user_email.split("@")[0]}</span>
                <span>{entry.action}</span>
                <span className="ml-auto text-snow/45">{relativeTime(entry.at)}</span>
              </li>
            ))}
            {!log.data?.length && <li className="text-snow/45">Noch nichts</li>}
          </ul>
        )}
      </div>

      <Dialog
        open={confirmDelete}
        onClose={() => setConfirmDelete(false)}
        title="Zugang löschen?"
        footer={
          <>
            <Button variant="ghost" onClick={() => setConfirmDelete(false)}>
              Abbrechen
            </Button>
            <Button variant="danger" loading={deleting} loadingText="Wird gelöscht …" onClick={remove}>
              Löschen
            </Button>
          </>
        }
      >
        <p className="text-sm text-snow/60">„{item.title}“ wird mit Passwort endgültig entfernt.</p>
      </Dialog>
    </div>
  );
}

export function NewVaultDialog({
  open,
  projects,
  management,
  projectId,
  onClose,
  onCreated,
}: {
  open: boolean;
  projects: TaskProject[];
  management: boolean;
  projectId?: string;
  onClose: () => void;
  onCreated?: (id: string) => void;
}) {
  const toast = useToast();
  const [scope, setScope] = useState(projectId ?? "");
  const [form, setForm] = useState({ title: "", username: "", password: "", url: "" });
  const [busy, setBusy] = useState(false);
  const set = (key: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) => setForm((f) => ({ ...f, [key]: e.target.value }));

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!form.title.trim()) return toast("Dienst fehlt", "error");
    setBusy(true);
    try {
      const item = await createVaultItem({
        ...scopePatch(scope),
        title: form.title.trim(),
        username: form.username.trim() || null,
        url: form.url.trim() || null,
        password: form.password || null,
      });
      setForm({ title: "", username: "", password: "", url: "" });
      onClose();
      onCreated?.(item.id);
    } catch (error) {
      toast(error instanceof Error ? error.message : "Anlegen fehlgeschlagen", "error");
    }
    setBusy(false);
  }

  return (
    <Dialog open={open} onClose={onClose} title="Neuer Zugang">
      <form onSubmit={submit} className="grid gap-3" autoComplete="off">
        <Field label="Kunde">{(id) => <ProjectSelect id={id} value={scope} onChange={setScope} projects={projects} management={management} />}</Field>
        <Field label="Dienst *">{(id) => <Input id={id} value={form.title} onChange={set("title")} placeholder="z. B. Instagram, TikTok, Meta Business" autoFocus />}</Field>
        <Field label="Benutzer / E-Mail">{(id) => <Input id={id} value={form.username} onChange={set("username")} />}</Field>
        <Field label="Passwort">
          {(id) => (
            <div className="flex gap-2">
              <Input id={id} value={form.password} onChange={set("password")} autoComplete="new-password" className="font-mono" />
              <IconButton label="Sicheres Passwort erzeugen" className="h-10 w-10 shrink-0" onClick={() => setForm((f) => ({ ...f, password: generatePassword() }))}>
                <Wand2 className="h-4 w-4" />
              </IconButton>
            </div>
          )}
        </Field>
        <Field label="Link">{(id) => <Input id={id} value={form.url} onChange={set("url")} placeholder="https://" />}</Field>
        <div className="mt-2 flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>
            Abbrechen
          </Button>
          <Button variant="primary" type="submit" loading={busy} loadingText="Wird angelegt …">
            Anlegen
          </Button>
        </div>
      </form>
    </Dialog>
  );
}

/** Zugänge eines Kunden, z. B. im Briefing in den Aufgaben */
export function ProjectVault({ projectId }: { projectId: string }) {
  const vault = useVault();
  const projects = useRows<TaskProject>("task_projects");
  const management = useIsManagement();
  const [creating, setCreating] = useState(false);
  const items = (vault.data ?? []).filter((i) => i.project_id === projectId && !i.internal);

  return (
    <div>
      <div className="mb-2 flex items-center gap-2">
        <p className="text-[13px] font-semibold">Zugänge</p>
        <span className="text-[12px] text-snow/55">{items.length}</span>
        <Button size="sm" variant="ghost" className="ml-auto" icon={<Plus className="h-3.5 w-3.5" />} onClick={() => setCreating(true)}>
          Zugang
        </Button>
      </div>
      {vault.error ? (
        <p className="text-[13px] text-error">{vault.error.message}</p>
      ) : vault.loading ? (
        <Spinner className="h-4 w-4" />
      ) : items.length ? (
        <div className="rounded-2xl border border-snow/[0.08] bg-surface">
          {items.map((item) => (
            <VaultRow key={item.id} item={item} compact />
          ))}
        </div>
      ) : (
        <p className="text-[13px] text-snow/55">Noch keine Zugänge hinterlegt.</p>
      )}
      <NewVaultDialog open={creating} projects={projects.data ?? []} management={management} projectId={projectId} onClose={() => setCreating(false)} />
    </div>
  );
}
