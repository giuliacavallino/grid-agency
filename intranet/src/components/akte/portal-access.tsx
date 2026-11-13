"use client";

import { useState } from "react";
import { Copy, ExternalLink, KeyRound, Send, Trash2, UserPlus } from "lucide-react";
import { api } from "@/lib/api";
import { mutate, useResource } from "@/lib/data";
import { formatDate } from "@/lib/format";
import type { PortalUser } from "@/lib/portal";
import { Button, Field, Input, Spinner, useToast } from "@/components/ui";
import { useCurrentWorkspace } from "@/components/marketing/workspace";
import { AkteHeader } from "./header";

// Kundenzugang der Akte: wer im Kundenportal (/portal) Postingplan und
// eingeplante Posts dieser Kundenwelt sehen darf. Anmeldung per Link an die
// freigeschaltete Adresse; Einladung verschickt hello@.

const url = (id: string) => `/api/marketing/workspaces/${id}/portal`;

export function PortalAccess() {
  const { workspace } = useCurrentWorkspace();
  const users = useResource<PortalUser[]>(workspace ? url(workspace.id) : null);
  const toast = useToast();
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const portal = typeof window === "undefined" ? "/portal" : `${window.location.origin}/portal`;

  if (!workspace || !users.data) {
    return (
      <div className="grid h-full place-items-center">
        <Spinner />
      </div>
    );
  }
  const key = url(workspace.id);

  async function add(invite: boolean) {
    setBusy(invite ? "invite" : "add");
    try {
      const next = await api<PortalUser[]>(key, { method: "POST", body: JSON.stringify({ email, name, invite }) });
      mutate<PortalUser[]>(key, () => next);
      toast(invite ? `Einladung an ${email.trim()} gesendet` : `${email.trim()} freigeschaltet`);
      setEmail("");
      setName("");
    } catch (error) {
      toast(error instanceof Error ? error.message : "Das hat nicht geklappt", "error");
    }
    setBusy(null);
  }

  async function invite(user: PortalUser) {
    setBusy(`invite-${user.id}`);
    try {
      const next = await api<PortalUser[]>(key, { method: "POST", body: JSON.stringify({ email: user.email, name: user.name, invite: true }) });
      mutate<PortalUser[]>(key, () => next);
      toast(`Anmeldelink an ${user.email} gesendet`);
    } catch (error) {
      toast(error instanceof Error ? error.message : "Senden fehlgeschlagen", "error");
    }
    setBusy(null);
  }

  async function remove(user: PortalUser) {
    setBusy(`remove-${user.id}`);
    try {
      const next = await api<PortalUser[]>(`${key}?user=${user.id}`, { method: "DELETE" });
      mutate<PortalUser[]>(key, () => next);
      toast(`${user.email} hat keinen Zugang mehr`);
    } catch (error) {
      toast(error instanceof Error ? error.message : "Entfernen fehlgeschlagen", "error");
    }
    setBusy(null);
  }

  return (
    <div className="flex h-full flex-col">
      <AkteHeader title="Kundenzugang" meta="Wer im Kundenportal Postingplan und eingeplante Posts dieser Akte sieht">
        <Button size="sm" className="h-9" icon={<ExternalLink className="h-4 w-4" />} onClick={() => window.open("/portal", "_blank")}>
          Portal öffnen
        </Button>
      </AkteHeader>
      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="grid max-w-3xl gap-5 p-4 pb-12 md:p-7">
          <section className="flex items-start gap-4 rounded-2xl border border-snow/[0.08] bg-panel p-4">
            <KeyRound className="mt-0.5 h-5 w-5 text-snow/60" />
            <div className="min-w-0 flex-1 text-[13px] text-snow/65">
              <p className="text-[15px] font-semibold text-snow">So funktioniert der Zugang</p>
              <p className="mt-1">
                Freigeschaltete Personen melden sich unter <span className="font-medium text-snow">{portal}</span> mit ihrer E-Mail-Adresse an und bekommen einen Link. Sie sehen nur diese
                Kundenwelt, nur lesend: Soll und Stand laut Postingplan (z. B. „2 von 4 Beiträgen“) und alle eingeplanten und veröffentlichten Posts. Entwürfe mit Termin erscheinen als „In
                Abstimmung“.
              </p>
            </div>
            <Button size="sm" variant="ghost" icon={<Copy className="h-4 w-4" />} onClick={() => navigator.clipboard.writeText(portal).then(() => toast("Link kopiert"))}>
              Link
            </Button>
          </section>

          <section className="grid gap-3 rounded-2xl border border-snow/[0.08] bg-panel p-5">
            <p className="text-[14px] font-semibold">Person freischalten</p>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="E-Mail-Adresse">{(id) => <Input id={id} type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="name@kunde.de" className="h-10" />}</Field>
              <Field label="Name (optional)">{(id) => <Input id={id} value={name} onChange={(e) => setName(e.target.value)} className="h-10" />}</Field>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button variant="primary" size="sm" className="h-9" icon={<Send className="h-4 w-4" />} loading={busy === "invite"} loadingText="Einladung wird gesendet …" disabled={!email.trim() || busy !== null} onClick={() => add(true)}>
                Freischalten und einladen
              </Button>
              <Button size="sm" className="h-9" icon={<UserPlus className="h-4 w-4" />} loading={busy === "add"} loadingText="Wird gespeichert …" disabled={!email.trim() || busy !== null} onClick={() => add(false)}>
                Nur freischalten
              </Button>
            </div>
          </section>

          <section className="grid gap-2 rounded-2xl border border-snow/[0.08] bg-panel p-5">
            <p className="mb-1 text-[14px] font-semibold">Zugang haben ({users.data.length})</p>
            {!users.data.length && <p className="text-[13px] text-snow/55">Noch niemand. Die Kundin bzw. der Kunde sieht das Portal erst nach der Freischaltung.</p>}
            {users.data.map((user) => (
              <div key={user.id} className="flex flex-wrap items-center gap-3 rounded-xl bg-snow/[0.03] px-3 py-2.5">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[14px] font-medium">{user.name || user.email}</p>
                  <p className="truncate text-[12px] text-snow/50">
                    {user.name ? `${user.email} · ` : ""}
                    {user.last_login_at ? `zuletzt angemeldet ${formatDate(user.last_login_at)}` : user.invited_at ? `eingeladen ${formatDate(user.invited_at)}` : "noch nicht eingeladen"}
                  </p>
                </div>
                <Button size="sm" variant="ghost" icon={<Send className="h-4 w-4" />} loading={busy === `invite-${user.id}`} loadingText="Wird gesendet …" disabled={busy !== null} onClick={() => invite(user)}>
                  {user.invited_at ? "Erneut einladen" : "Einladen"}
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  className="text-error"
                  icon={<Trash2 className="h-4 w-4" />}
                  aria-label={`Zugang für ${user.email} entfernen`}
                  loading={busy === `remove-${user.id}`}
                  loadingText="…"
                  disabled={busy !== null}
                  onClick={() => remove(user)}
                />
              </div>
            ))}
          </section>
        </div>
      </div>
    </div>
  );
}
