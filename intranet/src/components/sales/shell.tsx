"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { clsx } from "clsx";
import {
  BarChart3,
  BookOpenCheck,
  Briefcase,
  Building2,
  CalendarDays,
  ChevronLeft,
  Columns3,
  Handshake,
  Inbox,
  Landmark,
  Lock,
  LogOut,
  Menu,
  Package,
  ReceiptText,
  Settings,
  X,
  type LucideIcon,
} from "lucide-react";
import { useMe } from "@/components/access";
import { NotificationBell } from "@/components/notifications";
import { PersonAvatar } from "@/components/person";
import { TopBar } from "@/components/topbar";
import { Button, Popover } from "@/components/ui";
import { signOut } from "@/lib/auth";
import { hasArea } from "@/lib/access";
import { useRows } from "@/lib/data";

/** Zähler „neu“ an einem Menüpunkt (Leads, Bewerbungen, Rechnungen) */
type Counter = "leads" | "applications" | "invoices" | "proposals";

/** color: farbiger Punkt statt Icon (Kunden in Aufgaben); group: Zwischenüberschrift davor */
/** area: nur sichtbar, wer diesen Bereich darf (z. B. "admin" für Bank) */
/** bottom: unten über dem Profil (z. B. Einstellungen) */
/** avatar: eigenes Bild statt Icon (z. B. rundes Kundenprofilbild) */
export type NavItem = { href: string; label: string; icon?: LucideIcon; color?: string; avatar?: React.ReactNode; counter?: Counter; group?: string; area?: string; bottom?: boolean };

export const SALES_NAV: NavItem[] = [
  { href: "/sales", label: "Pipeline", icon: Columns3, counter: "leads" },
  { href: "/sales/posteingang", label: "Posteingang", icon: Inbox },
  { href: "/sales/kalender", label: "Termine", icon: CalendarDays },
  { href: "/sales/kunden", label: "Kunden", icon: Building2 },
  { href: "/sales/auftragsbuch", label: "Auftragsbuch", icon: BookOpenCheck },
  { href: "/sales/artikel", label: "Artikel", icon: Package },
  { href: "/sales/analytics", label: "Auswertung", icon: BarChart3 },
];

// /finance muss vorne stehen: der erste Eintrag ist die Wurzel (nur exakt aktiv)
export const FINANCE_NAV: NavItem[] = [
  { href: "/finance", label: "Eingangsrechnungen", icon: BookOpenCheck, counter: "invoices", group: "Arbeiten" },
  { href: "/finance/kunden", label: "Kunden", icon: Building2, area: "sales" },
  { href: "/finance/ausgangsrechnungen", label: "Rechnungen", icon: ReceiptText },
  { href: "/finance/serien", label: "Serien", icon: CalendarDays },
  { href: "/finance/bank", label: "Bank", icon: Landmark, area: "admin" },
  { href: "/finance/posteingang", label: "Postfach", icon: Inbox },
  { href: "/finance/einstellungen", label: "Einstellungen", icon: Settings, bottom: true },
];

export const PERSONAL_NAV: NavItem[] = [
  { href: "/personal", label: "Bewerber-Pipeline", icon: Columns3, counter: "applications", group: "Recruiting" },
  { href: "/personal/stellen", label: "Stellenanzeigen", icon: Briefcase },
  { href: "/personal/netzwerk", label: "Freelancer & Partner", icon: Handshake, group: "Netzwerk" },
];

export const MAIL_NAV: NavItem[] = [
  { href: "/mail", label: "Alle Postfächer", icon: Inbox },
  { href: "/mail/kalender", label: "Kalender", icon: CalendarDays },
];

function isActive(pathname: string, href: string, root: string) {
  return href === root ? pathname === root : pathname.startsWith(href);
}

const COUNTER_QUERY: Record<Counter, [string, string]> = {
  leads: ["leads", "status=offen"],
  applications: ["applications", "stage=neu"],
  invoices: ["invoices", "stage=neu"],
  proposals: ["meeting_tasks", "status=vorschlag"],
};

/** Anzahl neuer Einträge (Leads in „Neuer Lead“, neue Bewerbungen, neue
 * Rechnungen, offene Vorschläge aus Calls) */
function useNewCount(counter: Counter) {
  const [table, query] = COUNTER_QUERY[counter];
  const { data } = useRows<{ stage?: string }>(table, query);
  if (counter === "proposals") return data?.length ?? 0;
  return data?.filter((row) => row.stage === "neu").length ?? 0;
}

function NavCount({ counter, label }: { counter: Counter; label: string }) {
  const count = useNewCount(counter);
  if (!count) return null;
  return (
    <span className="grid h-6 min-w-6 place-items-center rounded-full px-1.5 text-[11.5px] font-semibold text-white tabular-nums" style={{ background: "#a5483a" }} aria-label={`${count} neu in ${label}`}>
      {count}
    </span>
  );
}

const itemClass = (active: boolean) =>
  clsx(
    "relative flex h-11 items-center gap-3 rounded-2xl px-3.5 text-[15px] transition-colors",
    active ? "bg-snow font-medium text-sky shadow-[0_6px_18px_var(--shadow-color)]" : "text-snow/75 hover:bg-snow/[0.06] hover:text-snow"
  );

function NavList({ nav, onNavigate }: { nav: NavItem[]; onNavigate?: () => void }) {
  const pathname = usePathname();
  const me = useMe();
  const root = nav[0].href;

  return (
    <ul className="flex flex-col gap-1">
      {nav
        .filter((item) => !item.bottom && (!item.area || hasArea(me.data, item.area)))
        .map(({ href, label, icon: Icon, color, avatar, counter, group }) => {
          const active = isActive(pathname, href, root);
          return (
            <li key={href}>
              {group && <p className="px-3.5 pt-5 pb-2 text-[11.5px] font-semibold tracking-[0.12em] text-snow/45 uppercase">{group}</p>}
              <Link href={href} onClick={onNavigate} aria-current={active ? "page" : undefined} className={itemClass(active)}>
                {avatar ? (
                  avatar
                ) : Icon ? (
                  <Icon className="h-[18px] w-[18px] shrink-0" strokeWidth={1.8} />
                ) : (
                  <span className="flex h-[18px] w-[18px] shrink-0 items-center justify-center">
                    <span className="h-2.5 w-2.5 rounded-full" style={{ background: color }} />
                  </span>
                )}
                <span className="flex-1 truncate">{label}</span>
                {counter && <NavCount counter={counter} label={label} />}
              </Link>
            </li>
          );
        })}
    </ul>
  );
}

/** Unten in der Leiste: Einstellungen (falls vorhanden) und Profil */
function SidebarFooter({ nav, onNavigate }: { nav: NavItem[]; onNavigate?: () => void }) {
  const pathname = usePathname();
  const me = useMe();
  const [leaving, setLeaving] = useState(false);
  const bottom = nav.filter((item) => item.bottom && (!item.area || hasArea(me.data, item.area)));
  const name = me.data?.name || me.data?.email || "";
  return (
    <div className="mt-4 flex flex-col gap-1 border-t border-snow/[0.08] pt-3">
      {bottom.map(({ href, label, icon: Icon = Settings, area }) => (
        <Link key={href} href={href} onClick={onNavigate} aria-current={pathname.startsWith(href) ? "page" : undefined} className={itemClass(pathname.startsWith(href))}>
          <Icon className="h-[18px] w-[18px] shrink-0" strokeWidth={1.8} />
          <span className="flex-1 truncate">{label}</span>
          {area === "admin" && <Lock className="h-4 w-4 shrink-0 opacity-50" aria-label="Nur Admin" />}
        </Link>
      ))}
      <Popover
        align="left"
        side="top"
        trigger={({ toggle, open }) => (
          <button type="button" onClick={toggle} aria-expanded={open} className="mt-1 flex items-center gap-3 rounded-2xl px-2 py-2 text-left hover:bg-snow/[0.05]">
            <PersonAvatar name={name} email={me.data?.email} className="h-10 w-10 text-[13px]" />
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[14px] font-semibold">{name}</span>
              <span className="block text-[12.5px] text-snow/50">Profil verwalten</span>
            </span>
          </button>
        )}
      >
        {() => (
          <div className="w-64 p-1.5">
            <div className="px-2.5 pt-1.5 pb-3">
              <p className="font-medium">{name}</p>
              <p className="mt-0.5 text-[13px] break-all text-snow/55">{me.data?.email}</p>
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
    </div>
  );
}

function SidebarHead({ title }: { title: string }) {
  return (
    <div className="mb-3 px-1">
      <Link href="/" className="inline-flex h-8 items-center gap-1 rounded-full border border-snow/[0.1] bg-surface px-3 text-[13px] font-medium text-snow/75 shadow-[0_2px_8px_var(--shadow-color)] hover:text-snow">
        <ChevronLeft className="h-3.5 w-3.5" /> Hub
      </Link>
      <h1 className="mt-4 px-1.5 text-[28px] leading-none font-semibold tracking-tight text-snow/85">{title}</h1>
    </div>
  );
}

export function SalesShell({ children }: { children: React.ReactNode }) {
  return (
    <AreaShell title="Sales" nav={SALES_NAV}>
      {children}
    </AreaShell>
  );
}

/** Arbeitsfläche eines Bereichs (Sales, Finance, Personal, Mail …):
 * Seitenleiste links („‹ Hub“, Titel, Navigation, Einstellungen, Profil),
 * rechts Kopfzeile (Suche, Team, Zeit, Aufgaben, Glocke) und Inhalt. */
export function AreaShell({ title, nav, children }: { title: string; nav: NavItem[]; children: React.ReactNode }) {
  const [drawer, setDrawer] = useState(false);
  const pathname = usePathname();
  const current = nav.find((item) => isActive(pathname, item.href, nav[0].href));

  return (
    <div className="flex h-dvh overflow-hidden bg-canvas">
      {/* Desktop-Seitenleiste */}
      <aside className="hidden w-[272px] shrink-0 flex-col border-r border-snow/[0.06] bg-sky px-3 pt-4 pb-3 md:flex">
        <SidebarHead title={title} />
        <nav aria-label={title} className="-mx-1 flex-1 overflow-y-auto px-1 pt-2">
          <NavList nav={nav} />
        </nav>
        <SidebarFooter nav={nav} />
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        {/* Mobil: schmale Kopfzeile + Schublade */}
        <div className="flex h-14 shrink-0 items-center gap-2 border-b border-snow/[0.08] bg-sky px-2 pt-[env(safe-area-inset-top)] md:hidden">
          <button
            type="button"
            onClick={() => setDrawer(true)}
            aria-label="Menü öffnen"
            className="flex h-10 w-10 items-center justify-center rounded-lg text-snow/80 hover:bg-snow/10"
          >
            <Menu className="h-5 w-5" />
          </button>
          <span className="flex-1 truncate text-[16px] font-semibold">{current?.label ?? title}</span>
          <NotificationBell />
        </div>
        <TopBar className="hidden md:flex" />

        <main className="min-h-0 flex-1 overflow-hidden">{children}</main>
      </div>

      {drawer && (
        <div className="fixed inset-0 z-50 md:hidden">
          <div className="animate-fade absolute inset-0 bg-black/50" onClick={() => setDrawer(false)} />
          <aside className="animate-sheet absolute inset-y-0 left-0 flex w-76 max-w-[85vw] flex-col bg-sky px-3 pt-[calc(env(safe-area-inset-top)+14px)] pb-4 shadow-2xl">
            <button
              type="button"
              onClick={() => setDrawer(false)}
              aria-label="Menü schließen"
              className="absolute top-[calc(env(safe-area-inset-top)+12px)] right-3 flex h-9 w-9 items-center justify-center rounded-lg text-snow/70 hover:bg-snow/10"
            >
              <X className="h-5 w-5" />
            </button>
            <SidebarHead title={title} />
            <nav aria-label={title} className="flex-1 overflow-y-auto pt-2">
              <NavList nav={nav} onNavigate={() => setDrawer(false)} />
            </nav>
            <SidebarFooter nav={nav} onNavigate={() => setDrawer(false)} />
          </aside>
        </div>
      )}
    </div>
  );
}

/** Schmale Werkzeugleiste oben in jeder Bereichsseite: Titel links, Aktionen rechts. */
export function PageBar({
  title,
  meta,
  children,
}: {
  title: string;
  meta?: React.ReactNode;
  children?: React.ReactNode;
}) {
  return (
    <div className="flex min-h-14 shrink-0 flex-wrap items-center gap-x-3 gap-y-2 border-b border-snow/[0.08] px-4 py-2.5 md:px-5">
      <h1 className="hidden text-[17px] font-medium md:block">{title}</h1>
      {meta && <div className="hidden text-[13px] text-snow/50 md:block">{meta}</div>}
      <div className="flex min-w-0 flex-1 items-center justify-end gap-2">{children}</div>
    </div>
  );
}

export function FinanceShell({ children }: { children: React.ReactNode }) {
  return (
    <AreaShell title="Finance" nav={FINANCE_NAV}>
      {children}
    </AreaShell>
  );
}

export function PersonalShell({ children }: { children: React.ReactNode }) {
  return (
    <AreaShell title="Personal" nav={PERSONAL_NAV}>
      {children}
    </AreaShell>
  );
}

export const KALENDER_NAV: NavItem[] = [{ href: "/kalender", label: "Mein Kalender", icon: CalendarDays }];

export function KalenderShell({ children }: { children: React.ReactNode }) {
  return (
    <AreaShell title="Kalender" nav={KALENDER_NAV}>
      {children}
    </AreaShell>
  );
}

export function MailShell({ children }: { children: React.ReactNode }) {
  return (
    <AreaShell title="Mail" nav={MAIL_NAV}>
      {children}
    </AreaShell>
  );
}
