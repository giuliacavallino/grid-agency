"use client";

import { useState } from "react";
import { Plus, Trash2, UserPlus } from "lucide-react";
import { GRANTABLE_AREAS, type Member, type Role } from "@/lib/access";
import { api } from "@/lib/api";
import { AREAS } from "@/lib/areas";
import { useAuth } from "@/lib/auth";
import { mutate, revalidate, useResource } from "@/lib/data";
import { cn as clsx } from "@/lib/cn";
import { Button, Dialog, Empty, Field, IconButton, Input, Select, Spinner, useToast } from "@/components/ui";
import { PersonAvatar } from "@/components/person";
import { PageBar } from "@/components/sales/shell";

const URL_USERS = "/api/admin/users";
const areaLabel = (id: string) => AREAS.find((a) => a.id === id)?.title ?? id;

async function saveMember(email: string, patch: Partial<Member>) {
  const saved = await api<Member>(`${URL_USERS}/${encodeURIComponent(email)}`, { method: "PATCH", body: JSON.stringify(patch) });
  mutate<Member[]>(URL_USERS, (list) => list.map((m) => (m.email === email ? saved : m)));
  // Eigene Rechte und Teamliste neu laden
  revalidate("/api/me");
  revalidate("/api/team");
  return saved;
}

/** Admin → Benutzer & Rechte: wer ins Intranet darf und welche Bereiche sieht. */
export function Members() {
  const users = useResource<Member[]>(URL_USERS);
  const [creating, setCreating] = useState(false);

  return (
    <div className="flex h-full flex-col">
      <PageBar title="Benutzer & Rechte" meta={users.data && `${users.data.filter((m) => m.active).length} aktiv`}>
        <Button variant="primary" size="sm" className="h-9" icon={<UserPlus className="h-4 w-4" />} onClick={() => setCreating(true)}>
          Person freischalten
        </Button>
      </PageBar>
      {users.error ? (
        <Empty title="Benutzer konnten nicht geladen werden" text={users.error.message} />
      ) : users.loading ? (
        <div className="grid flex-1 place-items-center">
          <Spinner />
        </div>
      ) : (
        <div className="min-h-0 flex-1 overflow-y-auto pb-10">
          <p className="max-w-3xl px-4 pt-4 text-[13px] leading-relaxed text-snow/60 md:px-6">
            Angemeldet wird immer mit dem Microsoft-Konto von GRID. Hier legst du fest, wer ins Intranet darf und welche Bereiche er sieht.
            <strong className="font-medium text-snow/80"> Admin</strong> sieht alles, auch Passwörter, Benutzer und Firmendaten.
          </p>
          <ul className="mt-4 border-t border-snow/[0.06]">
            {(users.data ?? []).map((member) => (
              <li key={member.email}>
                <MemberRow member={member} />
              </li>
            ))}
          </ul>
        </div>
      )}
      <NewMemberDialog open={creating} onClose={() => setCreating(false)} />
    </div>
  );
}

function MemberRow({ member }: { member: Member }) {
  const toast = useToast();
  const auth = useAuth();
  const isSelf = auth.status === "signed-in" && auth.account.email.toLowerCase() === member.email;
  const [name, setName] = useState(member.name);
  const [busy, setBusy] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const admin = member.role === "admin";

  async function save(patch: Partial<Member>, key: string) {
    setBusy(key);
    try {
      await saveMember(member.email, patch);
    } catch (error) {
      toast(error instanceof Error ? error.message : "Speichern fehlgeschlagen", "error");
    }
    setBusy(null);
  }

  async function remove() {
    setBusy("delete");
    try {
      await api(`${URL_USERS}/${encodeURIComponent(member.email)}`, { method: "DELETE" });
      mutate<Member[]>(URL_USERS, (list) => list.filter((m) => m.email !== member.email));
      revalidate("/api/team");
      setConfirmDelete(false);
    } catch (error) {
      toast(error instanceof Error ? error.message : "Löschen fehlgeschlagen", "error");
    }
    setBusy(null);
  }

  const toggleArea = (area: string) =>
    save({ areas: member.areas.includes(area) ? member.areas.filter((a) => a !== area) : [...member.areas, area] }, area);

  return (
    <div className={clsx("flex flex-wrap items-center gap-x-4 gap-y-3 border-b border-snow/[0.06] px-4 py-4 md:px-6", !member.active && "opacity-60")}>
      <div className="flex min-w-0 flex-1 basis-64 items-center gap-3">
        <PersonAvatar name={member.name} email={member.email} className="h-10 w-10" />
        <div className="min-w-0 flex-1">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            onBlur={() => name.trim() && name.trim() !== member.name && save({ name: name.trim() }, "name")}
            onKeyDown={(e) => e.key === "Enter" && e.currentTarget.blur()}
            aria-label="Name"
            className="w-full rounded-md bg-transparent px-1 text-[15px] font-medium outline-none focus:bg-snow/[0.06] focus:ring-1 focus:ring-snow/20"
          />
          <p className="truncate px-1 text-[12.5px] text-snow/55">
            {member.email}
            {isSelf && " · du"}
          </p>
        </div>
      </div>

      <Select
        value={member.role}
        onChange={(e) => save({ role: e.target.value as Role }, "role")}
        aria-label="Rolle"
        aria-busy={busy === "role" || undefined}
        className="h-9 w-40"
      >
        <option value="admin">Admin</option>
        <option value="member">Mitarbeiter*in</option>
      </Select>

      <div className="flex basis-full flex-wrap gap-1.5 md:basis-auto md:max-w-xl">
        {admin ? (
          <span className="rounded-full bg-snow/[0.08] px-3 py-1.5 text-[12.5px] text-snow/70">Alle Bereiche inkl. Admin</span>
        ) : (
          GRANTABLE_AREAS.map((area) => {
            const on = member.areas.includes(area);
            return (
              <button
                key={area}
                type="button"
                onClick={() => toggleArea(area)}
                disabled={busy !== null}
                aria-pressed={on}
                aria-busy={busy === area || undefined}
                className={clsx(
                  "flex h-8 items-center gap-1.5 rounded-full border px-3 text-[12.5px] transition-colors disabled:cursor-progress",
                  on ? "border-snow bg-snow text-sky" : "border-snow/15 text-snow/60 hover:border-snow/35 hover:text-snow"
                )}
              >
                {busy === area && <Spinner className="h-3 w-3 text-current" />}
                {areaLabel(area)}
              </button>
            );
          })
        )}
      </div>

      <div className="ml-auto flex items-center gap-1">
        <label className="flex cursor-pointer items-center gap-2 text-[12.5px] text-snow/65">
          <input
            type="checkbox"
            checked={member.active}
            onChange={() => save({ active: !member.active }, "active")}
            disabled={busy !== null}
            className="h-4 w-4 accent-[#30a46c]"
          />
          Aktiv
        </label>
        <IconButton label={`${member.name} entfernen`} className="h-8 w-8 text-snow/50 hover:text-error" onClick={() => setConfirmDelete(true)}>
          <Trash2 className="h-4 w-4" />
        </IconButton>
      </div>

      <Dialog
        open={confirmDelete}
        onClose={() => setConfirmDelete(false)}
        title="Zugang entfernen?"
        footer={
          <>
            <Button variant="ghost" onClick={() => setConfirmDelete(false)}>
              Abbrechen
            </Button>
            <Button variant="danger" loading={busy === "delete"} loadingText="Wird entfernt …" onClick={remove}>
              Entfernen
            </Button>
          </>
        }
      >
        <p className="text-sm text-snow/60">
          {member.name} kann sich danach nicht mehr im Intranet anmelden. Das Microsoft-Konto bleibt bestehen. Zum vorübergehenden Sperren reicht „Aktiv“.
        </p>
      </Dialog>
    </div>
  );
}

function NewMemberDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const toast = useToast();
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [role, setRole] = useState<Role>("member");
  const [areas, setAreas] = useState<string[]>(["aufgaben"]);
  const [busy, setBusy] = useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    try {
      const member = await api<Member>(URL_USERS, { method: "POST", body: JSON.stringify({ email, name: name.trim(), role, areas }) });
      mutate<Member[]>(URL_USERS, (list) => [...list, member].sort((a, b) => a.name.localeCompare(b.name)));
      revalidate("/api/team");
      setEmail("");
      setName("");
      setRole("member");
      setAreas(["aufgaben"]);
      onClose();
      toast(`${member.name} ist freigeschaltet`);
    } catch (error) {
      toast(error instanceof Error ? error.message : "Anlegen fehlgeschlagen", "error");
    }
    setBusy(false);
  }

  return (
    <Dialog open={open} onClose={onClose} title="Person freischalten">
      <form onSubmit={submit} className="grid gap-4">
        <Field label="Microsoft-Konto (E-Mail) *" hint="Das Konto muss es in Microsoft 365 schon geben.">
          {(id) => <Input id={id} type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="vorname.nachname@grid-agency.de" autoFocus required />}
        </Field>
        <Field label="Name *">{(id) => <Input id={id} value={name} onChange={(e) => setName(e.target.value)} placeholder="Vorname Nachname" required />}</Field>
        <Field label="Rolle">
          {(id) => (
            <Select id={id} value={role} onChange={(e) => setRole(e.target.value as Role)}>
              <option value="member">Mitarbeiter*in</option>
              <option value="admin">Admin (sieht alles)</option>
            </Select>
          )}
        </Field>
        {role === "member" && (
          <div>
            <p className="mb-2 text-xs font-medium text-snow/60">Bereiche</p>
            <div className="flex flex-wrap gap-1.5">
              {GRANTABLE_AREAS.map((area) => {
                const on = areas.includes(area);
                return (
                  <button
                    key={area}
                    type="button"
                    aria-pressed={on}
                    onClick={() => setAreas((list) => (on ? list.filter((a) => a !== area) : [...list, area]))}
                    className={clsx(
                      "h-8 rounded-full border px-3 text-[12.5px] transition-colors",
                      on ? "border-snow bg-snow text-sky" : "border-snow/15 text-snow/60 hover:border-snow/35 hover:text-snow"
                    )}
                  >
                    {areaLabel(area)}
                  </button>
                );
              })}
            </div>
          </div>
        )}
        <div className="mt-2 flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>
            Abbrechen
          </Button>
          <Button variant="primary" type="submit" loading={busy} loadingText="Wird freigeschaltet …" icon={<Plus className="h-4 w-4" />}>
            Freischalten
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
