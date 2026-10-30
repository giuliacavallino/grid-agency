"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { clsx } from "clsx";
import {
  BarChart3,
  BookOpenCheck,
  Briefcase,
  Building2,
  CalendarDays,
  ChevronsLeft,
  ChevronsRight,
  Columns3,
  Inbox,
  Landmark,
  LayoutGrid,
  Menu,
  Package,
  ReceiptText,
  Settings,
  X,
  type LucideIcon,
} from "lucide-react";
import { useMe } from "@/components/access";
import { AccountMenu } from "@/components/hub";
import { TeamsButton } from "@/components/teams";
import { Logo } from "@/components/logo";
import { hasArea } from "@/lib/access";
import { useRows } from "@/lib/data";

/** Zähler „neu“ an einem Menüpunkt (Leads, Bewerbungen, Rechnungen) */
type Counter = "leads" | "applications" | "invoices";

/** color: farbiger Punkt statt Icon (Kunden in Aufgaben); group: Zwischenüberschrift davor */
/** area: nur sichtbar, wer diesen Bereich darf (z. B. "admin" für Bank) */
export type NavItem = { href: string; label: string; icon?: LucideIcon; color?: string; counter?: Counter; group?: string; area?: string };

export const SALES_NAV: NavItem[] = [
  { href: "/sales", label: "Pipeline", icon: Columns3, counter: "leads" },
  { href: "/sales/posteingang", label: "Posteingang", icon: Inbox },
  { href: "/sales/kalender", label: "Kalender", icon: CalendarDays },
  { href: "/sales/kunden", label: "Kunden", icon: Building2 },
  { href: "/sales/auftragsbuch", label: "Auftragsbuch", icon: BookOpenCheck },
  { href: "/sales/artikel", label: "Artikel", icon: Package },
  { href: "/sales/analytics", label: "Analytics", icon: BarChart3 },
];

export const FINANCE_NAV: NavItem[] = [
  { href: "/finance", label: "Eingangsrechnungen", icon: Columns3, counter: "invoices" },
  { href: "/finance/ausgangsrechnungen", label: "Ausgangsrechnungen", icon: ReceiptText },
  { href: "/finance/bank", label: "Bank", icon: Landmark, area: "admin" },
  { href: "/finance/posteingang", label: "Posteingang", icon: Inbox },
  { href: "/finance/einstellungen", label: "Einstellungen", icon: Settings },
];

export const PERSONAL_NAV: NavItem[] = [
  { href: "/personal", label: "Bewerbungen", icon: Columns3, counter: "applications" },
  { href: "/personal/stellen", label: "Stellen", icon: Briefcase },
];

export const MAIL_NAV: NavItem[] = [
  { href: "/mail", label: "Posteingang", icon: Inbox },
  { href: "/mail/kalender", label: "Kalender", icon: CalendarDays },
];

const STORAGE_KEY = "intranet:sidebar-collapsed";

function isActive(pathname: string, href: string, root: string) {
  return href === root ? pathname === root : pathname.startsWith(href);
}

const COUNTER_QUERY: Record<Counter, [string, string]> = {
  leads: ["leads", "status=offen"],
  applications: ["applications", "stage=neu"],
  invoices: ["invoices", "stage=neu"],
};

/** Anzahl neuer Einträge (Leads in „Neuer Lead“, neue Bewerbungen, neue Rechnungen) */
function useNewCount(counter: Counter) {
  const [table, query] = COUNTER_QUERY[counter];
  const { data } = useRows<{ stage: string }>(table, query);
  return data?.filter((row) => row.stage === "neu").length ?? 0;
}

function NavCount({ counter, collapsed, label }: { counter: Counter; collapsed: boolean; label: string }) {
  const count = useNewCount(counter);
  if (!count) return null;
  return collapsed ? (
    <span className="absolute top-1.5 right-2 h-2 w-2 rounded-full bg-[#fa7e1e]" aria-label={`${count} neu in ${label}`} />
  ) : (
    <span className="rounded-full bg-snow/12 px-1.5 text-[11px] font-medium text-snow/80">{count}</span>
  );
}

function NavList({ nav, collapsed, onNavigate }: { nav: NavItem[]; collapsed: boolean; onNavigate?: () => void }) {
  const pathname = usePathname();
  const me = useMe();
  const root = nav[0].href;

  return (
    <ul className="flex flex-col gap-0.5">
      {nav.filter((item) => !item.area || hasArea(me.data, item.area)).map(({ href, label, icon: Icon, color, counter, group }) => {
        const active = isActive(pathname, href, root);
        return (
          <li key={href}>
            {group && !collapsed && (
              <p className="px-3 pt-4 pb-1.5 text-[11px] font-medium tracking-wide text-snow/40 uppercase">{group}</p>
            )}
            <Link
              href={href}
              onClick={onNavigate}
              title={collapsed ? label : undefined}
              aria-current={active ? "page" : undefined}
              className={clsx(
                "relative flex h-10 items-center gap-3 rounded-xl text-[14px] transition-colors",
                collapsed ? "justify-center px-0" : "px-3",
                active ? "bg-snow/[0.12] font-medium text-snow" : "text-snow/65 hover:bg-snow/[0.06] hover:text-snow"
              )}
            >
              {Icon ? (
                <Icon className="h-[18px] w-[18px] shrink-0" strokeWidth={1.8} />
              ) : (
                <span className="flex h-[18px] w-[18px] shrink-0 items-center justify-center">
                  <span className="h-2.5 w-2.5 rounded-full" style={{ background: color }} />
                </span>
              )}
              {!collapsed && <span className="flex-1 truncate">{label}</span>}
              {counter && <NavCount counter={counter} collapsed={collapsed} label={label} />}
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

function Brand({ collapsed, title }: { collapsed: boolean; title: string }) {
  return (
    <Link href="/" className="group flex items-center gap-2.5 px-1" aria-label="Zur Übersicht">
      <span className="logo-rainbow">
        <Logo className={collapsed ? "h-[18px]" : "h-[22px]"} />
      </span>
      {!collapsed && <span className="pt-0.5 text-[10px] font-medium uppercase tracking-[0.3em] text-snow/55">{title}</span>}
    </Link>
  );
}

export function SalesShell({ children }: { children: React.ReactNode }) {
  return (
    <AreaShell title="Sales" nav={SALES_NAV}>
      {children}
    </AreaShell>
  );
}

/** Arbeitsfläche eines Bereichs (Sales, Finance, Personal, Mail):
 * Seitenleiste links, Inhalt füllt den Rest. */
export function AreaShell({ title, nav, children }: { title: string; nav: NavItem[]; children: React.ReactNode }) {
  const [collapsed, setCollapsed] = useState(false);
  const [drawer, setDrawer] = useState(false);
  const pathname = usePathname();
  const current = nav.find((item) => isActive(pathname, item.href, nav[0].href));

  useEffect(() => {
    try {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- gespeicherte Vorliebe erst im Browser lesen
      setCollapsed(localStorage.getItem(STORAGE_KEY) === "1");
    } catch {}
  }, []);

  const toggle = () => {
    setCollapsed((value) => {
      try {
        localStorage.setItem(STORAGE_KEY, value ? "0" : "1");
      } catch {}
      return !value;
    });
  };

  return (
    <div className="flex h-dvh overflow-hidden bg-canvas">
      {/* Desktop-Seitenleiste */}
      <aside
        className={clsx(
          "hidden shrink-0 flex-col border-r border-snow/[0.08] bg-sky py-4 transition-[width] duration-200 md:flex",
          collapsed ? "w-[68px] px-2.5" : "w-[232px] px-3"
        )}
      >
        <div className={clsx("mb-6 flex h-8 items-center", collapsed ? "justify-center" : "justify-between pl-1.5")}>
          <Brand collapsed={collapsed} title={title} />
        </div>
        <nav aria-label={title} className="flex-1 overflow-y-auto">
          <NavList nav={nav} collapsed={collapsed} />
        </nav>
        <div className="mt-4 flex flex-col gap-0.5 border-t border-snow/[0.08] pt-3">
          <TeamsButton
            label={!collapsed}
            className={clsx(
              "flex h-10 items-center gap-3 rounded-xl text-[14px] text-snow/65 hover:bg-snow/[0.06] hover:text-snow",
              collapsed ? "w-full justify-center" : "px-3"
            )}
          />
          <Link
            href="/"
            title={collapsed ? "Übersicht" : undefined}
            className={clsx(
              "flex h-10 items-center gap-3 rounded-xl text-[14px] text-snow/65 hover:bg-snow/[0.06] hover:text-snow",
              collapsed ? "justify-center" : "px-3"
            )}
          >
            <LayoutGrid className="h-[18px] w-[18px]" strokeWidth={1.8} />
            {!collapsed && "Übersicht"}
          </Link>
          <button
            type="button"
            onClick={toggle}
            className={clsx(
              "flex h-10 items-center gap-3 rounded-xl text-[14px] text-snow/65 hover:bg-snow/[0.06] hover:text-snow",
              collapsed ? "justify-center" : "px-3"
            )}
            aria-label={collapsed ? "Seitenleiste ausklappen" : "Seitenleiste einklappen"}
            title={collapsed ? "Ausklappen" : undefined}
          >
            {collapsed ? <ChevronsRight className="h-[18px] w-[18px]" /> : <ChevronsLeft className="h-[18px] w-[18px]" />}
            {!collapsed && "Einklappen"}
          </button>
          <div className={clsx("mt-2 flex", collapsed ? "justify-center" : "px-1.5")}>
            <AccountMenu align="left" />
          </div>
        </div>
      </aside>

      {/* Mobil: schmale Kopfzeile + Schublade */}
      <div className="flex min-w-0 flex-1 flex-col">
        <div className="flex h-12 shrink-0 items-center gap-2 border-b border-snow/[0.08] bg-sky px-2 pt-[env(safe-area-inset-top)] md:hidden">
          <button
            type="button"
            onClick={() => setDrawer(true)}
            aria-label="Menü öffnen"
            className="flex h-9 w-9 items-center justify-center rounded-lg text-snow/80 hover:bg-snow/10"
          >
            <Menu className="h-5 w-5" />
          </button>
          <span className="flex-1 truncate text-[15px] font-medium">{current?.label ?? title}</span>
          <TeamsButton className="h-9 w-9" />
          <AccountMenu />
        </div>

        <main className="min-h-0 flex-1 overflow-hidden">{children}</main>
      </div>

      {drawer && (
        <div className="fixed inset-0 z-50 md:hidden">
          <div className="animate-fade absolute inset-0 bg-black/50" onClick={() => setDrawer(false)} />
          <aside className="animate-sheet absolute inset-y-0 left-0 flex w-72 flex-col bg-sky px-3 pt-[calc(env(safe-area-inset-top)+16px)] pb-4 shadow-2xl">
            <div className="mb-6 flex items-center justify-between pl-1.5">
              <Brand collapsed={false} title={title} />
              <button
                type="button"
                onClick={() => setDrawer(false)}
                aria-label="Menü schließen"
                className="flex h-9 w-9 items-center justify-center rounded-lg text-snow/70 hover:bg-snow/10"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <NavList nav={nav} collapsed={false} onNavigate={() => setDrawer(false)} />
            <Link
              href="/"
              className="mt-auto flex h-10 items-center gap-3 rounded-xl px-3 text-[14px] text-snow/65 hover:bg-snow/[0.06]"
            >
              <LayoutGrid className="h-[18px] w-[18px]" strokeWidth={1.8} />
              Übersicht
            </Link>
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

export function MailShell({ children }: { children: React.ReactNode }) {
  return (
    <AreaShell title="Mail" nav={MAIL_NAV}>
      {children}
    </AreaShell>
  );
}
