"use client";

import { useEffect, useState } from "react";
import { CircleCheck, Lock } from "lucide-react";
import { CONNECTORS, PROVIDERS, type ConnectProvider, type Provider } from "@/lib/marketing";
import { Logo } from "@/components/logo";
import { Button, Spinner } from "@/components/ui";
import { ProviderMark } from "./common";

type View = {
  workspace: { name: string; color: string; secondary_color: string | null; logo_url: string | null };
  accounts: { provider: Provider; name: string; handle: string | null; avatar_url: string | null; status: string }[];
  configured: Record<Exclude<ConnectProvider, "canva">, boolean>;
};

// Öffentliche Seite für Kunden (intranet.grid-agency.de/verbinden/…): Der
// Kunde meldet sich bei seinen Plattformen an und erlaubt GRID das Posten.
// Ohne Intranet-Login; Zugang über den Link aus „Link für Kunden“.

export function ConnectLink({ token }: { token: string }) {
  const [view, setView] = useState<View | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const connected = params.get("connected");
    const failed = params.get("error");
    // eslint-disable-next-line react-hooks/set-state-in-effect -- Rückmeldung aus der Adresse gibt es nur im Browser
    if (connected) setNotice({ ok: true, text: "Verbunden, danke! Ihr könnt weitere Kanäle verbinden oder die Seite schließen." });
    else if (failed) setNotice({ ok: false, text: failed });
    if (connected || failed) window.history.replaceState(null, "", window.location.pathname);
    fetch(`/api/social/link/${encodeURIComponent(token)}`, { cache: "no-store" })
      .then(async (response) => {
        const data = await response.json();
        if (!response.ok) throw new Error(data.error ?? "Link ungültig");
        setView(data);
      })
      .catch((e: Error) => setError(e.message));
  }, [token]);

  async function connect(provider: ConnectProvider) {
    setBusy(provider);
    try {
      const response = await fetch(`/api/social/link/${encodeURIComponent(token)}/connect/${provider}`, { method: "POST" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Verbinden fehlgeschlagen");
      window.location.assign(data.url);
    } catch (e) {
      setNotice({ ok: false, text: e instanceof Error ? e.message : "Verbinden fehlgeschlagen" });
      setBusy(null);
    }
  }

  return (
    <div className="relative min-h-dvh overflow-x-clip bg-sky text-snow">
      <div aria-hidden className="pointer-events-none fixed inset-0">
        <div className="login-aurora aurora absolute -inset-[10%]" />
      </div>
      <header className="relative px-3 pt-3 md:px-6">
        <div className="glass mx-auto flex h-14 max-w-3xl items-center rounded-full px-5">
          <a href="https://grid-agency.de" className="logo-rainbow" aria-label="GRID Agency">
            <Logo className="h-5" priority />
          </a>
        </div>
      </header>
      <main className="relative mx-auto max-w-3xl px-4 pt-10 pb-16 md:px-6">
        {error ? (
          <div className="glass rounded-3xl p-6">
            <h1 className="text-xl font-medium">Link nicht mehr gültig</h1>
            <p className="mt-2 text-[14px] text-snow/65">{error}</p>
          </div>
        ) : !view ? (
          <div className="grid place-items-center py-20">
            <Spinner />
          </div>
        ) : (
          <>
            <div className="mb-4 h-1.5 w-24 rounded-full" style={{ background: `linear-gradient(90deg, ${view.workspace.color}, ${view.workspace.secondary_color ?? view.workspace.color})` }} aria-hidden />
            <p className="flex items-center gap-3 text-[11px] font-medium tracking-[0.3em] text-snow/55 uppercase">
              {view.workspace.logo_url && (
                // eslint-disable-next-line @next/next/no-img-element -- Logo des Kunden
                <img src={view.workspace.logo_url} alt="" className="h-9 w-9 rounded-lg bg-white object-contain" />
              )}
              {view.workspace.name} × GRID
            </p>
            <h1 className="mt-2 text-[clamp(28px,6vw,40px)] leading-tight font-medium tracking-tight">Kanäle verbinden</h1>
            <p className="mt-3 max-w-xl text-[15px] leading-relaxed text-snow/70">
              Meldet euch bei euren Plattformen an und erlaubt GRID, für euch zu posten. Euer Passwort bleibt bei der Plattform; ihr könnt den Zugang
              jederzeit in den Einstellungen der Plattform wieder entziehen.
            </p>
            {notice && (
              <p className={`mt-5 rounded-2xl px-4 py-3 text-[14px] ${notice.ok ? "bg-[#30a46c]/15" : "bg-error/15 text-error"}`} role="status">
                {notice.text}
              </p>
            )}
            <ul className="mt-6 grid gap-3">
              {CONNECTORS.map((c) => {
                const id = c.id as Exclude<ConnectProvider, "canva">;
                const done = view.accounts.filter((a) => c.providers.includes(a.provider));
                return (
                  <li key={c.id} className="glass flex flex-wrap items-center gap-4 rounded-3xl p-5">
                    <span className="flex gap-1.5">
                      {c.providers.map((p) => (
                        <ProviderMark key={p} provider={p} className="h-8 min-w-8 text-[12px]" />
                      ))}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-[16px] font-medium">{c.label}</p>
                      <p className="text-[13px] text-snow/60">
                        {done.length
                          ? done.map((a) => `${PROVIDERS[a.provider].label}: ${a.handle ?? a.name}`).join(" · ")
                          : c.id === "meta"
                            ? "Facebook-Login; dabei die Seite und das Instagram-Konto auswählen"
                            : c.id === "linkedin"
                              ? "Mit dem Konto anmelden, das Admin der Unternehmensseite ist"
                              : "Mit eurem TikTok-Konto anmelden"}
                      </p>
                    </div>
                    {done.length > 0 && <CircleCheck className="h-5 w-5 text-[#30a46c]" aria-label="Verbunden" />}
                    <Button
                      variant={done.length ? "secondary" : "primary"}
                      loading={busy === c.id}
                      loadingText="Weiterleiten …"
                      disabled={!view.configured[id] || busy !== null}
                      onClick={() => connect(c.id)}
                    >
                      {done.length ? "Erneut verbinden" : "Verbinden"}
                    </Button>
                  </li>
                );
              })}
            </ul>
            <p className="mt-6 flex items-center gap-2 text-[12.5px] text-snow/50">
              <Lock className="h-3.5 w-3.5" /> Die Zugänge werden verschlüsselt gespeichert und nur für eure Posts genutzt.
            </p>
          </>
        )}
      </main>
    </div>
  );
}
