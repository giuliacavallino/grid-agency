"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { clsx } from "clsx";
import { ArrowLeft, ArrowUpRight, LayoutGrid, LogOut, Menu } from "lucide-react";
import { AREAS, type Area } from "@/lib/areas";
import { hasArea } from "@/lib/access";
import { useMe } from "./access";
import { TeamsButton } from "./teams";
import { usePhoto } from "./person";
import { signOut, useAuth } from "@/lib/auth";
import { Logo } from "./logo";
import { Button, Popover } from "./ui";
import { KpiList, useKpis } from "./kpis";

/** Bereiche, die das angemeldete Konto sehen darf */
function useAreas() {
  const { data: me } = useMe();
  return AREAS.filter((area) => hasArea(me, area.id));
}

function AreaLink({ area, className, children }: { area: Area; className?: string; children: React.ReactNode }) {
  return area.external ? (
    <a href={area.href} target="_blank" rel="noopener" className={className}>
      {children}
    </a>
  ) : (
    <Link href={area.href} className={className}>
      {children}
    </Link>
  );
}

/** Konto-Avatar mit Menü (Name, E-Mail, Abmelden). */
export function AccountMenu({ align = "right" }: { align?: "left" | "right" }) {
  const auth = useAuth();
  const [leaving, setLeaving] = useState(false);
  if (auth.status !== "signed-in") return null;
  const { name, email } = auth.account;
  const letters = name.split(/\s+/).map((p) => p[0]).slice(0, 2).join("").toUpperCase();
  return <AccountPopover name={name} email={email} letters={letters} align={align} leaving={leaving} setLeaving={setLeaving} />;
}

function AccountPopover({
  name,
  email,
  letters,
  align,
  leaving,
  setLeaving,
}: {
  name: string;
  email: string;
  letters: string;
  align: "left" | "right";
  leaving: boolean;
  setLeaving: (value: boolean) => void;
}) {
  const photo = usePhoto(email);
  return (
    <Popover
      align={align}
      side={align === "left" ? "top" : "bottom"}
      trigger={({ toggle, open }) => (
        <button
          type="button"
          onClick={toggle}
          aria-expanded={open}
          aria-label="Konto"
          className="flex h-9 w-9 items-center justify-center overflow-hidden rounded-full bg-snow text-[13px] font-semibold text-sky transition-[transform,box-shadow] hover:shadow-[0_0_0_3px_color-mix(in_srgb,var(--color-snow)_22%,transparent)] active:scale-90"
        >
          {/* eslint-disable-next-line @next/next/no-img-element -- Blob-URL aus Microsoft Graph */}
          {photo ? <img src={photo} alt="" className="h-full w-full object-cover" /> : letters}
        </button>
      )}
    >
      {() => (
        <div className="w-64 p-1.5">
          <div className="px-2.5 pt-1.5 pb-3">
            <p className="font-medium">{name}</p>
            <p className="mt-0.5 break-all text-[13px] text-snow/55">{email}</p>
          </div>
          <Button
            className="w-full"
            icon={<LogOut className="h-4 w-4" />}
            loading={leaving}
            loadingText="Abmelden …"
            onClick={() => {
              setLeaving(true);
              signOut().catch(() => setLeaving(false));
            }}
          >
            Abmelden
          </Button>
        </div>
      )}
    </Popover>
  );
}

/** Kopfleiste als schwebende Glas-Pill wie TopBar.tsx der Website. */
export function TopBar() {
  const pathname = usePathname();
  const areas = useAreas();
  const kpis = useKpis();
  return (
    <header className="pointer-events-none fixed inset-x-0 top-0 z-40 pt-[calc(env(safe-area-inset-top)+12px)] lg:pt-6">
      <div className="mx-auto w-full max-w-frame-lg px-5">
        <div className="glass pointer-events-auto relative flex h-13 items-center justify-between gap-4 rounded-full pr-2 pl-5 lg:h-[68px] lg:pr-3 lg:pl-7">
          <span className="pointer-events-none absolute inset-x-6 top-0 h-px bg-gradient-to-r from-transparent via-snow/40 to-transparent" />

          <Link href="/" aria-label="Zur Übersicht" className="group relative flex flex-col items-start">
            <span className="logo-rainbow transition-transform group-hover:scale-[1.08]">
              <Logo priority className="h-[26px] lg:h-[30px]" />
            </span>
            <span className="-mt-1.5 pl-[3px] text-[9px] font-medium uppercase tracking-[0.32em] text-snow/70 lg:text-[10px]">
              Intranet
            </span>
          </Link>

          {kpis && kpis.length > 0 && (
            <nav className="relative hidden min-w-0 lg:block" aria-label="Kennzahlen">
              <KpiList kpis={kpis} className="gap-1 xl:gap-3" />
            </nav>
          )}

          <div className="relative flex items-center gap-1.5">
            <TeamsButton className="h-9 w-9 rounded-full" />
            <AccountMenu />
            <div className="lg:hidden">
              <Popover
                trigger={({ toggle, open }) => (
                  <button
                    type="button"
                    onClick={toggle}
                    aria-expanded={open}
                    aria-label="Menü öffnen"
                    className="flex h-9 w-9 items-center justify-center rounded-full text-snow hover:bg-snow/10"
                  >
                    <Menu className="h-5 w-5" strokeWidth={1.8} />
                  </button>
                )}
              >
                {(close) => (
                  <ul className="grid w-72 gap-0.5 p-1">
                    {[{ id: "home", title: "Übersicht", icon: LayoutGrid, href: "/", text: "" } as Area, ...areas].map((area) => {
                      const Icon = area.icon;
                      const current = area.href === "/" ? pathname === "/" : pathname.startsWith(area.href);
                      return (
                        <li key={area.id}>
                          <span onClick={close}>
                            <AreaLink
                              area={area}
                              className={clsx(
                                "flex items-center gap-3 rounded-2xl px-3 py-2.5 text-[15px]",
                                current && !area.external ? "bg-snow/12 font-medium text-snow" : "text-snow/85 hover:bg-snow/8"
                              )}
                            >
                              <Icon className="h-5 w-5" strokeWidth={1.8} />
                              {area.title}
                              {area.external && <ArrowUpRight className="ml-auto h-4 w-4 opacity-50" />}
                            </AreaLink>
                          </span>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </Popover>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}

/** fit: alles auf einer Bildschirmhöhe, ohne Scrollen (Übersicht) */
function HubFrame({ children, fit = false }: { children: React.ReactNode; fit?: boolean }) {
  return (
    <div className={clsx("relative flex flex-col", fit ? "h-dvh overflow-hidden" : "min-h-dvh")}>
      <div className="pattern-bg pointer-events-none fixed inset-0 opacity-25" aria-hidden />
      <div className="pointer-events-none fixed inset-0 bg-gradient-to-b from-sky/85 via-sky/55 to-sky/80" aria-hidden />
      <TopBar />
      <main
        className={clsx(
          "relative mx-auto w-full max-w-frame-lg flex-1 px-5",
          fit
            ? "flex min-h-0 flex-col pt-[calc(env(safe-area-inset-top)+84px)] pb-4 lg:pt-[118px] lg:pb-6"
            : "pt-[calc(env(safe-area-inset-top)+100px)] pb-12 lg:pt-36"
        )}
      >
        {children}
      </main>
      <footer className={clsx("relative flex shrink-0 justify-center gap-4 px-5 text-[11px]", fit ? "pb-[calc(12px+env(safe-area-inset-bottom))]" : "pb-[calc(24px+env(safe-area-inset-bottom))]")}>
        {[
          ["https://grid-agency.de", "grid-agency.de"],
          ["https://grid-agency.de/impressum", "Impressum"],
          ["https://grid-agency.de/datenschutz", "Datenschutz"],
        ].map(([href, label]) => (
          <a key={href} href={href} className="text-snow/35 hover:text-snow/60">
            {label}
          </a>
        ))}
      </footer>
    </div>
  );
}

function greeting(hour: number) {
  if (hour < 5) return "Gute Nacht";
  if (hour < 11) return "Guten Morgen";
  if (hour < 18) return "Hallo";
  return "Guten Abend";
}

export function Hub() {
  const auth = useAuth();
  const areas = useAreas();
  const kpis = useKpis();
  const firstName = auth.status === "signed-in" ? auth.account.name.split(" ")[0] : "";
  // Datum und Tageszeit erst im Browser, damit Server und Client gleich rendern
  const [now, setNow] = useState<Date | null>(null);
  // eslint-disable-next-line react-hooks/set-state-in-effect -- Uhrzeit gibt es nur im Browser
  useEffect(() => setNow(new Date()), []);

  // Bei ungerader Anzahl wird die erste Kachel breit, damit die Reihen aufgehen
  const featured = areas.length % 2 === 1;
  const rows = { mobile: Math.ceil((areas.length + (featured ? 1 : 0)) / 2), desktop: Math.ceil((areas.length + (featured ? 1 : 0)) / 4) };

  return (
    <HubFrame fit>
      <div className="shrink-0">
        <p className="mb-1.5 h-4 text-[11px] font-medium uppercase tracking-[0.3em] text-snow/50">
          {now?.toLocaleDateString("de-DE", { weekday: "long", day: "numeric", month: "long" })}
        </p>
        <h1 className="text-[clamp(26px,min(6vw,5.5vh),44px)] leading-[1.1] font-medium tracking-tight">
          {now ? greeting(now.getHours()) : "Hallo"}, {firstName}
        </h1>
      </div>

      {kpis && kpis.length > 0 && (
        <div className="-mx-5 mt-3 shrink-0 overflow-x-auto px-5 lg:hidden">
          <KpiList kpis={kpis} className="glass w-max gap-0.5 rounded-2xl p-1" />
        </div>
      )}

      {/* Kacheln teilen sich die restliche Höhe: die Übersicht passt immer auf einen Bildschirm */}
      <ul
        className="mt-4 grid min-h-0 flex-1 grid-cols-2 gap-2.5 [grid-template-rows:var(--rows-m)] lg:mt-6 lg:grid-cols-4 lg:gap-4 lg:[grid-template-rows:var(--rows-d)] [max-height:var(--max-m)] lg:[max-height:var(--max-d)]"
        style={
          {
            "--rows-m": `repeat(${rows.mobile}, minmax(0, 1fr))`,
            "--rows-d": `repeat(${rows.desktop}, minmax(0, 1fr))`,
            "--max-m": `${rows.mobile * 170}px`,
            "--max-d": `${rows.desktop * 250}px`,
          } as React.CSSProperties
        }
      >
        {areas.map((area, index) => {
          const Icon = area.icon;
          const wide = featured && index === 0;
          return (
            <li key={area.id} className={clsx("min-h-0", wide && "col-span-2")}>
              <AreaLink
                area={area}
                className="glass group relative flex h-full flex-col overflow-hidden rounded-3xl p-3.5 transition-[transform,border-color,box-shadow] duration-250 hover:-translate-y-[3px] hover:border-snow/30 hover:shadow-[inset_0_1px_0_var(--glass-shine),0_14px_40px_var(--shadow-strong)] active:scale-[0.98] focus-visible:outline-2 focus-visible:outline-offset-3 focus-visible:outline-snow lg:p-[22px]"
              >
                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-[12px] border border-snow/12 bg-snow/10 transition-colors group-hover:bg-snow group-hover:text-sky lg:h-11 lg:w-11 lg:rounded-[14px]">
                  <Icon className="h-[19px] w-[19px] lg:h-[22px] lg:w-[22px]" strokeWidth={1.8} />
                </span>
                <ArrowUpRight className="absolute top-3.5 right-3.5 h-[18px] w-[18px] opacity-40 transition-[opacity,transform] group-hover:translate-x-0.5 group-hover:-translate-y-0.5 group-hover:opacity-100 lg:top-[22px] lg:right-[22px]" />
                <span className="mt-auto min-h-0 pt-2">
                  <span className={clsx("block font-medium tracking-tight", wide ? "text-[20px] lg:text-[22px]" : "text-base lg:text-lg")}>{area.title}</span>
                  <span className="mt-0.5 line-clamp-2 hidden text-[13px] leading-snug text-snow/55 sm:block [@media(max-height:640px)]:hidden">{area.text}</span>
                </span>
              </AreaLink>
            </li>
          );
        })}
      </ul>
    </HubFrame>
  );
}

/** Platzhalter für Bereiche, die noch gebaut werden. */
export function AreaPlaceholder({ id }: { id: string }) {
  const area = AREAS.find((a) => a.id === id)!;
  const Icon = area.icon;
  return (
    <HubFrame>
      <div className="flex items-center gap-4">
        <span className="grid h-14 w-14 place-items-center rounded-[18px] border border-snow/12 bg-snow/10">
          <Icon className="h-[26px] w-[26px]" strokeWidth={1.8} />
        </span>
        <div>
          <p className="mb-1 text-[11px] font-medium uppercase tracking-[0.3em] text-snow/50">Bereich</p>
          <h1 className="text-[clamp(30px,7vw,48px)] leading-[1.1] font-medium tracking-tight">{area.title}</h1>
        </div>
      </div>
      <section className="glass mt-8 max-w-[520px] rounded-[28px] px-6 py-7">
        <h2 className="mb-1.5 text-lg font-medium">Hier wird gerade gebaut</h2>
        <p className="mb-6 text-sm text-snow/60">{area.text}: Dieser Bereich des Intranets entsteht gerade.</p>
        <Link
          href="/"
          className="inline-flex h-11 items-center gap-2 rounded-full border border-snow/20 px-5 text-sm font-medium hover:bg-snow/8"
        >
          <ArrowLeft className="h-4 w-4" />
          Zur Übersicht
        </Link>
      </section>
    </HubFrame>
  );
}
