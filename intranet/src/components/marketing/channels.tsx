"use client";

import { useState } from "react";
import { Copy, FolderOpen, Link2, Trash2 } from "lucide-react";
import { api } from "@/lib/api";
import { revalidate } from "@/lib/data";
import { CONNECTORS, type ConnectProvider, type SocialAccount } from "@/lib/marketing";
import { Button, Dialog, Empty, IconButton, Spinner, useToast } from "@/components/ui";
import { PageBar } from "@/components/sales/shell";
import { AccountLine, ProviderMark, useConnectFeedback, useMarketingStatus } from "./common";
import { URL_WORKSPACES, useCurrentWorkspace, WorkspaceSwitcher } from "./workspace";

/** Marketing → Kanäle der aktuellen Kundenwelt: verbinden (selbst oder per
 * Link durch den Kunden), Status sehen, trennen */
export function Channels() {
  const toast = useToast();
  const { workspace } = useCurrentWorkspace();
  const status = useMarketingStatus();
  const [busy, setBusy] = useState<string | null>(null);
  const [link, setLink] = useState<{ url: string; expires_at: string } | null>(null);
  const [removing, setRemoving] = useState<SocialAccount | null>(null);
  useConnectFeedback(() => revalidate(URL_WORKSPACES));

  if (!workspace || !status.data) {
    return (
      <div className="grid h-full place-items-center">
        <Spinner />
      </div>
    );
  }
  const accounts = workspace.accounts.filter((a) => a.provider !== "canva");

  async function connect(provider: ConnectProvider) {
    setBusy(provider);
    try {
      const { url } = await api<{ url: string }>(`/api/marketing/connect/${provider}`, { method: "POST", body: JSON.stringify({ workspace_id: workspace!.id }) });
      window.location.assign(url);
    } catch (error) {
      toast(error instanceof Error ? error.message : "Verbinden fehlgeschlagen", "error");
      setBusy(null);
    }
  }

  async function createLink() {
    setBusy("link");
    try {
      setLink(await api<{ url: string; expires_at: string }>(`${URL_WORKSPACES}/${workspace!.id}/link`, { method: "POST" }));
    } catch (error) {
      toast(error instanceof Error ? error.message : "Link konnte nicht erstellt werden", "error");
    }
    setBusy(null);
  }

  async function openFolder() {
    setBusy("folder");
    // Fenster sofort öffnen, sonst blockt der Browser es nach dem Warten
    const tab = window.open("", "_blank");
    try {
      const { url } = await api<{ url: string }>(`${URL_WORKSPACES}/${workspace!.id}`, { method: "POST" });
      if (tab) tab.location.href = url;
      else window.location.assign(url);
      revalidate(URL_WORKSPACES);
    } catch (error) {
      tab?.close();
      toast(error instanceof Error ? error.message : "Ordner nicht erreichbar", "error");
    }
    setBusy(null);
  }

  async function remove() {
    if (!removing) return;
    setBusy("remove");
    try {
      await api(`/api/marketing/accounts/${removing.id}`, { method: "DELETE" });
      revalidate(URL_WORKSPACES);
      setRemoving(null);
    } catch (error) {
      toast(error instanceof Error ? error.message : "Trennen fehlgeschlagen", "error");
    }
    setBusy(null);
  }

  return (
    <div className="flex h-full flex-col">
      <PageBar title="Kanäle" meta={workspace.name}>
        <WorkspaceSwitcher />
        <Button size="sm" variant="ghost" className="h-9" icon={<FolderOpen className="h-4 w-4" />} loading={busy === "folder"} loadingText="Öffnet …" onClick={openFolder}>
          SharePoint
        </Button>
        {workspace.kind === "customer" && (
          <Button size="sm" className="h-9" icon={<Link2 className="h-4 w-4" />} loading={busy === "link"} loadingText="Wird erstellt …" onClick={createLink}>
            Link für Kunden
          </Button>
        )}
      </PageBar>
      <div className="min-h-0 flex-1 overflow-y-auto pb-10">
        {!status.data.vault && (
          <p className="mx-4 mt-4 max-w-3xl rounded-xl bg-snow/[0.06] px-3.5 py-2.5 text-[13px] text-snow/75 md:mx-6">
            VAULT_KEY fehlt in Vercel. Ohne ihn können keine Zugänge gespeichert werden.
          </p>
        )}
        {workspace.kind === "customer" && (
          <p className="max-w-3xl px-4 pt-4 text-[13px] leading-relaxed text-snow/60 md:px-6">
            Am einfachsten: <strong className="font-medium text-snow/80">Link für Kunden</strong> erstellen und schicken. Der Kunde meldet sich damit
            selbst bei Instagram/Facebook, LinkedIn oder TikTok an und erlaubt GRID das Posten. Pro Kunde müssen keine eigenen API-Rechte angelegt werden.
          </p>
        )}

        <h2 className="px-4 pt-6 pb-2 text-[15px] font-medium md:px-6">Verbinden</h2>
        <ul className="grid max-w-5xl gap-3 px-4 sm:grid-cols-3 md:px-6">
          {CONNECTORS.map((c) => {
            const ready = status.data!.configured[c.id];
            return (
              <li key={c.id} className="flex flex-col gap-3 rounded-2xl border border-snow/[0.08] bg-panel p-4">
                <div className="flex items-center gap-1.5">
                  {c.providers.map((p) => (
                    <ProviderMark key={p} provider={p} />
                  ))}
                  <span className="ml-1 text-[14.5px] font-medium">{c.label}</span>
                </div>
                <p className="flex-1 text-[12.5px] leading-snug text-snow/60">{ready ? c.text : `In Vercel fehlen ${status.data!.env[c.id]}.`}</p>
                <Button size="sm" loading={busy === c.id} loadingText="Weiterleiten …" disabled={!ready || busy !== null} onClick={() => connect(c.id)}>
                  Selbst verbinden
                </Button>
              </li>
            );
          })}
        </ul>

        <h2 className="px-4 pt-8 pb-2 text-[15px] font-medium md:px-6">Verbundene Konten</h2>
        {accounts.length === 0 ? (
          <Empty title="Noch keine Kanäle verbunden" text="Über „Link für Kunden“ oder „Selbst verbinden“ hinzufügen." />
        ) : (
          <div className="border-t border-snow/[0.06]">
            {accounts.map((account) => (
              <AccountLine key={account.id} account={account}>
                <IconButton label={`${account.name} trennen`} className="h-8 w-8 text-snow/50 hover:text-error" onClick={() => setRemoving(account)}>
                  <Trash2 className="h-4 w-4" />
                </IconButton>
              </AccountLine>
            ))}
          </div>
        )}
      </div>

      <LinkDialog link={link} name={workspace.name} onClose={() => setLink(null)} />
      <Dialog
        open={!!removing}
        onClose={() => setRemoving(null)}
        title="Kanal trennen?"
        footer={
          <>
            <Button variant="ghost" onClick={() => setRemoving(null)}>
              Abbrechen
            </Button>
            <Button variant="danger" loading={busy === "remove"} loadingText="Wird getrennt …" onClick={remove}>
              Trennen
            </Button>
          </>
        }
      >
        <p className="text-sm text-snow/60">Geplante Posts für „{removing?.name}“ schlagen danach fehl, bis der Kanal wieder verbunden ist.</p>
      </Dialog>
    </div>
  );
}

function LinkDialog({ link, name, onClose }: { link: { url: string; expires_at: string } | null; name: string; onClose: () => void }) {
  const toast = useToast();
  const text = link
    ? `Hallo! Damit wir eure Social-Media-Kanäle für euch bespielen können, verbindet sie bitte einmal über diesen Link mit GRID:\n${link.url}\n\nDer Link ist bis ${new Date(link.expires_at).toLocaleDateString("de-DE")} gültig. Ihr meldet euch dort ganz normal bei Instagram/Facebook, LinkedIn oder TikTok an und erlaubt GRID das Posten. Danke!`
    : "";
  const copy = async (value: string, label: string) => {
    try {
      await navigator.clipboard.writeText(value);
      toast(`${label} kopiert`);
    } catch {
      toast("Kopieren nicht möglich", "error");
    }
  };
  return (
    <Dialog open={!!link} onClose={onClose} title={`Link für ${name}`} width="max-w-xl">
      <p className="mb-3 text-[13px] text-snow/60">Gültig bis {link && new Date(link.expires_at).toLocaleDateString("de-DE")}. Wer den Link hat, kann Kanäle mit dieser Kundenwelt verbinden; also nur an den Kunden schicken.</p>
      <div className="flex gap-2">
        <input readOnly value={link?.url ?? ""} aria-label="Link" className="h-10 min-w-0 flex-1 rounded-xl border border-snow/12 bg-snow/[0.04] px-3 font-mono text-[12.5px]" onFocus={(e) => e.currentTarget.select()} />
        <Button icon={<Copy className="h-4 w-4" />} onClick={() => copy(link!.url, "Link")}>
          Kopieren
        </Button>
      </div>
      <p className="mt-4 mb-1.5 text-xs font-medium text-snow/60">Nachricht an den Kunden</p>
      <p className="rounded-xl bg-snow/[0.04] px-3 py-2.5 text-[13px] leading-relaxed whitespace-pre-wrap">{text}</p>
      <div className="mt-3 flex justify-end">
        <Button variant="primary" icon={<Copy className="h-4 w-4" />} onClick={() => copy(text, "Nachricht")}>
          Nachricht kopieren
        </Button>
      </div>
    </Dialog>
  );
}
