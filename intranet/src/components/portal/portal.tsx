"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { CalendarClock, Check, ChevronDown, CircleAlert, Clock3, Images, LogOut, Mail, PlayCircle, Sparkles } from "lucide-react";
import { cn } from "@/lib/cn";
import { POST_FORMATS, PROVIDERS } from "@/lib/marketing";
import type { PortalPost, PortalQuota, PortalView } from "@/lib/portal";
import { isoWeekOf } from "@/lib/posting-plan";
import { ProductMark } from "@/components/logo";
import { ProviderMark } from "@/components/marketing/common";
import { Button, Input, Spinner } from "@/components/ui";

// Kundenportal: Login per Link, danach Postingplan-Fortschritt und alle
// eingeplanten Posts der Kundenwelt (nur lesen).

type State = { kind: "loading" } | { kind: "login"; error?: string } | { kind: "error"; message: string } | { kind: "ready"; view: PortalView };

export function Portal() {
  const [state, setState] = useState<State>({ kind: "loading" });
  const [ws, setWs] = useState<string | null>(null);

  const load = useCallback(async (workspace: string | null) => {
    const response = await fetch(`/api/portal/me${workspace ? `?ws=${encodeURIComponent(workspace)}` : ""}`, { cache: "no-store" });
    if (response.status === 401) {
      const invalid = new URLSearchParams(window.location.search).get("link") === "ungueltig";
      return setState({ kind: "login", error: invalid ? "Der Link ist abgelaufen oder wurde schon benutzt. Fordere einfach einen neuen an." : undefined });
    }
    const data = await response.json().catch(() => ({}));
    if (!response.ok) return setState({ kind: "error", message: data.error ?? "Das Portal konnte nicht geladen werden." });
    setState({ kind: "ready", view: data as PortalView });
  }, []);

  useEffect(() => {
    // Laden nach dem Mount; der Zustand kommt aus der Antwort
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load(ws).catch(() => setState({ kind: "error", message: "Keine Verbindung. Bitte später erneut versuchen." }));
  }, [load, ws]);

  if (state.kind === "loading") {
    return (
      <main className="grid min-h-dvh place-items-center bg-canvas">
        <Spinner />
      </main>
    );
  }
  if (state.kind === "login") return <Login error={state.error} />;
  if (state.kind === "error") {
    return (
      <main className="grid min-h-dvh place-items-center bg-canvas px-5">
        <p className="max-w-sm text-center text-[15px] text-snow/70">{state.message}</p>
      </main>
    );
  }
  return <Dashboard view={state.view} onWorkspace={setWs} />;
}

// ---------- Anmeldung ----------

function Login({ error }: { error?: string }) {
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [message, setMessage] = useState<string | null>(error ?? null);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setMessage(null);
    try {
      const response = await fetch("/api/portal/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email }) });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error ?? "Das hat nicht geklappt.");
      if (data.demo_url) window.location.href = data.demo_url;
      else setSent(true);
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Das hat nicht geklappt.");
    }
    setBusy(false);
  }

  return (
    <main className="flex min-h-dvh flex-col items-center justify-center bg-canvas px-5 py-12">
      <div className="w-full max-w-sm">
        <ProductMark product="Kundenportal" size="sm" priority className="mb-10" />
        {sent ? (
          <div className="rounded-3xl border border-snow/[0.08] bg-surface p-6 shadow-[0_4px_18px_var(--shadow-color)]">
            <Mail className="mb-3 h-6 w-6 text-snow/60" />
            <p className="text-[17px] font-medium">Schau in dein Postfach</p>
            <p className="mt-2 text-[14px] leading-relaxed text-snow/65">
              Wenn {email} für das Portal freigeschaltet ist, kommt gleich eine Mail mit deinem Anmeldelink. Er ist 30 Minuten gültig.
            </p>
            <button type="button" onClick={() => setSent(false)} className="mt-4 text-[13px] text-snow/55 underline-offset-4 hover:text-snow hover:underline">
              Andere Adresse verwenden
            </button>
          </div>
        ) : (
          <form onSubmit={submit} className="rounded-3xl border border-snow/[0.08] bg-surface p-6 shadow-[0_4px_18px_var(--shadow-color)]">
            <h1 className="text-[22px] font-medium tracking-tight">Anmelden</h1>
            <p className="mt-1.5 text-[14px] leading-relaxed text-snow/60">Sieh jederzeit, was wann für dich gepostet wird. Wir schicken dir einen Anmeldelink.</p>
            <label htmlFor="portal-email" className="mt-5 mb-1.5 block text-[13px] text-snow/60">
              E-Mail-Adresse
            </label>
            <Input id="portal-email" type="email" required autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="name@firma.de" className="h-11" />
            {message && (
              <p className="mt-3 flex items-start gap-2 text-[13px] text-error">
                <CircleAlert className="mt-0.5 h-4 w-4 shrink-0" /> {message}
              </p>
            )}
            <Button type="submit" variant="primary" className="mt-5 h-11 w-full" loading={busy} loadingText="Link wird gesendet …" disabled={!email.trim()}>
              Anmeldelink senden
            </Button>
          </form>
        )}
        <p className="mt-6 text-center text-[12px] text-snow/40">Kein Zugang? Melde dich bei deinem Ansprechpartner bei GRID.</p>
      </div>
    </main>
  );
}

// ---------- Übersicht ----------

const dayKey = (iso: string) => new Date(iso).toLocaleDateString("sv-SE", { timeZone: "Europe/Berlin" });
const weekKey = (iso: string) => {
  const { year, week } = isoWeekOf(dayKey(iso));
  return `${year}-${String(week).padStart(2, "0")}`;
};

function Dashboard({ view, onWorkspace }: { view: PortalView; onWorkspace: (id: string) => void }) {
  const [busy, setBusy] = useState(false);
  const [now] = useState(() => Date.now());
  const { workspace } = view;
  const upcoming = view.posts.filter((p) => Date.parse(p.at) >= now - 3_600_000 || p.status !== "online");
  const past = view.posts.filter((p) => !upcoming.includes(p)).reverse();

  async function logout() {
    setBusy(true);
    await fetch("/api/portal/logout", { method: "POST" }).catch(() => null);
    window.location.href = "/portal";
  }

  return (
    <main className="min-h-dvh bg-canvas pb-16">
      <header className="sticky top-0 z-20 border-b border-snow/[0.06] bg-canvas/85 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-5xl items-center gap-3 px-4 md:px-6">
          <ProductMark product="Kundenportal" size="sm" priority className="hidden sm:inline-flex" />
          <div className="ml-auto flex min-w-0 items-center gap-2">
            {view.workspaces.length > 1 ? (
              <label className="relative flex items-center">
                <span className="sr-only">Kundenwelt</span>
                <select
                  value={workspace.id}
                  onChange={(e) => onWorkspace(e.target.value)}
                  className="h-10 appearance-none rounded-full border border-snow/10 bg-surface pr-9 pl-4 text-[14px] font-medium"
                >
                  {view.workspaces.map((w) => (
                    <option key={w.id} value={w.id}>
                      {w.name}
                    </option>
                  ))}
                </select>
                <ChevronDown className="pointer-events-none absolute right-3 h-4 w-4 text-snow/50" />
              </label>
            ) : null}
            <Button size="sm" variant="ghost" className="h-10" icon={<LogOut className="h-4 w-4" />} loading={busy} loadingText="Abmelden …" onClick={logout}>
              <span className="hidden sm:inline">Abmelden</span>
            </Button>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-5xl px-4 md:px-6">
        <section className="flex items-center gap-4 pt-8 pb-6">
          <WorkspaceAvatar name={workspace.name} color={workspace.color} url={workspace.avatar_url ?? workspace.logo_url} />
          <div className="min-w-0">
            <p className="text-[12px] tracking-[0.2em] text-snow/45 uppercase">Social Media mit GRID</p>
            <h1 className="truncate text-[26px] font-medium tracking-tight md:text-[32px]">{workspace.name}</h1>
          </div>
        </section>

        {!workspace.planning ? (
          <Note text="Für diese Kundenwelt planen wir aktuell keine Social-Media-Posts (z. B. reine Google-Betreuung)." />
        ) : (
          <>
            {view.plan && <PlanCards plan={view.plan} />}
            <h2 className="mt-10 mb-3 flex items-center gap-2 text-[17px] font-medium">
              <CalendarClock className="h-5 w-5 text-snow/55" /> Was als Nächstes kommt
            </h2>
            {upcoming.length ? <Timeline posts={upcoming} /> : <Note text="Gerade ist nichts eingeplant. Neue Posts erscheinen hier, sobald wir sie einplanen." />}
            {past.length > 0 && (
              <>
                <h2 className="mt-10 mb-3 flex items-center gap-2 text-[17px] font-medium">
                  <Check className="h-5 w-5 text-snow/55" /> Zuletzt veröffentlicht
                </h2>
                <Timeline posts={past} />
              </>
            )}
          </>
        )}
        <p className="mt-12 text-center text-[12px] text-snow/40">Fragen oder Änderungswünsche? Schreib uns an hello@grid-agency.de</p>
      </div>
    </main>
  );
}

function WorkspaceAvatar({ name, color, url }: { name: string; color: string; url: string | null }) {
  return url ? (
    // eslint-disable-next-line @next/next/no-img-element -- externe Adresse aus dem Storage
    <img src={url} alt="" className="h-16 w-16 shrink-0 rounded-full border border-snow/10 object-cover" />
  ) : (
    <span className="grid h-16 w-16 shrink-0 place-items-center rounded-full text-[22px] font-semibold text-white" style={{ background: color }}>
      {name.slice(0, 1)}
    </span>
  );
}

function Note({ text }: { text: string }) {
  return <p className="rounded-2xl border border-snow/[0.08] bg-surface px-5 py-4 text-[14px] text-snow/65">{text}</p>;
}

// ---------- Soll laut Postingplan ----------

function PlanCards({ plan }: { plan: NonNullable<PortalView["plan"]> }) {
  const before = plan.start && plan.windows[0] && plan.windows[0].to < plan.start;
  return (
    <section aria-label="Postingplan" className="grid gap-3 md:grid-cols-3">
      {plan.windows.map((window) => (
        <div key={window.key} className="rounded-3xl border border-snow/[0.07] bg-surface p-5 shadow-[0_4px_18px_var(--shadow-color)]">
          <p className="text-[12px] tracking-[0.16em] text-snow/50 uppercase">{window.label}</p>
          <div className="mt-3 grid gap-3.5">
            {window.quotas.map((quota) => (
              <QuotaRow key={quota.label + quota.rule} quota={quota} />
            ))}
          </div>
        </div>
      ))}
      {before && <p className="text-[12.5px] text-snow/50 md:col-span-3">Voller Umfang laut Vertrag ab {new Date(`${plan.start}T12:00:00Z`).toLocaleDateString("de-DE", { timeZone: "UTC" })}.</p>}
    </section>
  );
}

function QuotaRow({ quota }: { quota: PortalQuota }) {
  const target = quota.max && quota.max > quota.required ? `${quota.required}–${quota.max}` : String(quota.required);
  const met = quota.done >= quota.required;
  const pending = !met && quota.done + quota.open >= quota.required;
  const pct = Math.min(100, Math.round((quota.done / Math.max(1, quota.required)) * 100));
  const openPct = Math.min(100 - pct, Math.round((quota.open / Math.max(1, quota.required)) * 100));
  return (
    <div>
      <div className="flex items-baseline justify-between gap-2">
        <p className="text-[14px]">
          <span className="font-medium">{quota.label}</span> <span className="text-snow/45">{quota.rule}</span>
        </p>
        <p className="shrink-0 text-[14px] tabular-nums">
          <strong className="font-semibold">{quota.done}</strong>
          <span className="text-snow/50"> von {target}</span>
        </p>
      </div>
      <div className="mt-1.5 flex h-2 overflow-hidden rounded-full bg-snow/[0.08]" aria-hidden>
        <span className={cn("h-full", met ? "bg-success" : "bg-snow/70")} style={{ width: `${pct}%` }} />
        {openPct > 0 && <span className="h-full bg-snow/25" style={{ width: `${openPct}%` }} />}
      </div>
      <p className={cn("mt-1 text-[12px]", met ? "text-success" : "text-snow/50")}>
        {met ? "Erfüllt" : pending ? `${quota.open} in Abstimmung` : `Noch ${quota.required - quota.done - quota.open} offen${quota.open ? `, ${quota.open} in Abstimmung` : ""}`}
      </p>
    </div>
  );
}

// ---------- Posts ----------

const STATUS: Record<PortalPost["status"], { label: string; className: string; icon: typeof Check }> = {
  online: { label: "Online", className: "bg-success/15 text-success", icon: Check },
  geplant: { label: "Eingeplant", className: "bg-snow/[0.08] text-snow/80", icon: Clock3 },
  abstimmung: { label: "In Abstimmung", className: "bg-[#f5a524]/15 text-[#b56f00] dark:text-[#f5a524]", icon: Sparkles },
  fehler: { label: "Wird geprüft", className: "bg-error/12 text-error", icon: CircleAlert },
};

function Timeline({ posts }: { posts: PortalPost[] }) {
  const weeks = useMemo(() => {
    const map = new Map<string, PortalPost[]>();
    for (const post of posts) map.set(weekKey(post.at), [...(map.get(weekKey(post.at)) ?? []), post]);
    return [...map.entries()];
  }, [posts]);
  return (
    <div className="grid gap-6">
      {weeks.map(([key, items]) => (
        <section key={key}>
          <p className="mb-2 text-[12px] tracking-[0.16em] text-snow/45 uppercase">
            KW {Number(key.slice(5))} · {items.length} {items.length === 1 ? "Post" : "Posts"}
          </p>
          <div className="grid gap-2.5">
            {items.map((post) => (
              <PostRow key={post.id} post={post} />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}

function PostRow({ post }: { post: PortalPost }) {
  const [open, setOpen] = useState(false);
  const status = STATUS[post.status];
  const cover = post.media[0];
  const when = new Date(post.at);
  return (
    <article className="flex gap-4 rounded-2xl border border-snow/[0.07] bg-surface p-3 shadow-[0_2px_10px_var(--shadow-color)] sm:p-4">
      <div className="relative h-24 w-[76px] shrink-0 overflow-hidden rounded-xl bg-snow/[0.06] sm:h-32 sm:w-[102px]">
        {cover ? (
          cover.kind === "video" ? (
            <>
              <video src={cover.url} muted playsInline preload="metadata" className="h-full w-full object-cover" />
              <PlayCircle className="absolute top-1/2 left-1/2 h-7 w-7 -translate-x-1/2 -translate-y-1/2 text-white drop-shadow" />
            </>
          ) : (
            // eslint-disable-next-line @next/next/no-img-element -- Medien über /api/social/media
            <img src={cover.url} alt="" loading="lazy" className="h-full w-full object-cover" />
          )
        ) : (
          <span className="grid h-full place-items-center text-[11px] text-snow/40">Grafik folgt</span>
        )}
        {post.media.length > 1 && (
          <span className="absolute top-1.5 right-1.5 flex items-center gap-1 rounded-full bg-black/55 px-1.5 py-0.5 text-[10.5px] text-white">
            <Images className="h-3 w-3" /> {post.media.length}
          </span>
        )}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <p className="text-[14.5px] font-medium">
            {when.toLocaleDateString("de-DE", { weekday: "short", day: "2-digit", month: "2-digit", timeZone: "Europe/Berlin" })}
            <span className="text-snow/50"> · {when.toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit", timeZone: "Europe/Berlin" })} Uhr</span>
          </p>
          <span className={cn("inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11.5px] font-medium", status.className)}>
            <status.icon className="h-3 w-3" /> {status.label}
          </span>
          <span className="rounded-full border border-snow/10 px-2 py-0.5 text-[11.5px] text-snow/65">{POST_FORMATS[post.format].label}</span>
          <span className="ml-auto flex items-center gap-1">
            {post.providers.map((p) => (
              <span key={p} title={PROVIDERS[p].label}>
                <ProviderMark provider={p} />
              </span>
            ))}
          </span>
        </div>
        {post.caption ? (
          <button type="button" onClick={() => setOpen((v) => !v)} className="mt-1.5 block w-full text-left" aria-expanded={open}>
            <p className={cn("text-[13.5px] leading-relaxed whitespace-pre-line text-snow/75", !open && "line-clamp-3")}>{post.caption}</p>
            {post.caption.length > 180 && <span className="mt-1 inline-block text-[12px] text-snow/45">{open ? "Weniger" : "Ganzen Text lesen"}</span>}
          </button>
        ) : (
          <p className="mt-1.5 text-[13px] text-snow/45">Text folgt</p>
        )}
      </div>
    </article>
  );
}
