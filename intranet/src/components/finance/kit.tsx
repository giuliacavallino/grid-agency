"use client";

import { ChevronDown, ChevronUp, Search } from "lucide-react";
import { cn } from "@/lib/cn";
import { accentFill, accentText } from "@/lib/theme";

// Bausteine der Finance-Seiten: graue Arbeitsfläche, große weiße Karten,
// Pillen-Filter, Such-Pille, Status-Chips und Tabellenköpfe.

/** Ganze Seite: scrollt als Ganzes, Inhalt mittig mit Rand */
export function Page({ children, className, wide }: { children: React.ReactNode; className?: string; wide?: boolean }) {
  return (
    <div className="h-full overflow-y-auto bg-sky">
      <div className={cn("mx-auto flex w-full flex-col gap-5 px-4 py-5 md:px-8 md:py-7", wide ? "max-w-[1680px]" : "max-w-[1440px]", className)}>{children}</div>
    </div>
  );
}

/** Kopf der Seite: Titel und Kurzinfo links, Aktionen rechts */
export function PageHead({ title, meta, children }: { title: string; meta?: React.ReactNode; children?: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-3">
      <div className="min-w-0 flex-1">
        <h1 className="text-[26px] leading-tight font-semibold tracking-tight">{title}</h1>
        {meta && <div className="mt-1 text-[13.5px] text-snow/55">{meta}</div>}
      </div>
      {children && <div className="flex flex-wrap items-center gap-2">{children}</div>}
    </div>
  );
}

export const cardClass = "rounded-3xl border border-snow/[0.06] bg-surface shadow-[0_10px_40px_var(--shadow-color)]";

export function Card({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={cn(cardClass, className)}>{children}</div>;
}

/** Weiße Pille für Nebenaktionen neben dem dunklen Hauptknopf */
export const pillButton = "border-snow/[0.1] bg-surface shadow-[0_2px_10px_var(--shadow-color)] hover:bg-snow/[0.04]";

export type Segment<T extends string> = { id: T; label: string; count?: number; tone?: "error" };

/** Segmentierte Pillen-Auswahl; aktiv = dunkel gefüllt, Zähler als kleines Badge */
export function Segmented<T extends string>({
  value,
  onChange,
  options,
  label,
  className,
}: {
  value: T;
  onChange: (id: T) => void;
  options: Segment<T>[];
  label: string;
  className?: string;
}) {
  return (
    <div role="tablist" aria-label={label} className={cn("flex max-w-full shrink-0 gap-0.5 overflow-x-auto rounded-full border border-snow/[0.08] bg-surface p-1 shadow-[0_2px_10px_var(--shadow-color)]", className)}>
      {options.map((o) => {
        const active = o.id === value;
        return (
          <button
            key={o.id}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(o.id)}
            className={cn(
              "inline-flex h-8 shrink-0 items-center gap-1.5 rounded-full px-3.5 text-[13px] font-medium whitespace-nowrap transition-colors",
              active ? "bg-snow text-sky" : "text-snow/65 hover:bg-snow/[0.05] hover:text-snow"
            )}
          >
            {o.label}
            {o.count !== undefined && (
              <span
                className={cn(
                  "grid h-5 min-w-5 place-items-center rounded-full px-1.5 text-[11px] font-semibold tabular-nums",
                  active ? "bg-sky/20 text-sky" : o.tone === "error" && o.count ? "bg-error/12 text-error" : "bg-snow/[0.08] text-snow/60"
                )}
              >
                {o.count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

/** Suchfeld als weiße Pille mit Lupe */
export function SearchPill({
  value,
  onChange,
  placeholder,
  label,
  className,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  label: string;
  className?: string;
}) {
  return (
    <div className={cn("relative min-w-0", className)}>
      <Search className="pointer-events-none absolute top-1/2 left-4 h-4 w-4 -translate-y-1/2 text-snow/40" />
      <input
        type="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        aria-label={label}
        className="h-10 w-full rounded-full border border-snow/[0.08] bg-surface pr-4 pl-10 text-[13.5px] text-snow shadow-[0_2px_10px_var(--shadow-color)] outline-none placeholder:text-snow/40 focus:border-snow/30"
      />
    </div>
  );
}

export type ChipTone = "lavender" | "red" | "green" | "grey" | "amber" | "blue";

const TONE_COLOR: Partial<Record<ChipTone, string>> = { lavender: "#8b7cf6", amber: "#e7a33e", blue: "#5b8def" };

/** Kleiner Status-Chip als Pille */
export function Chip({ tone = "grey", children, className, title }: { tone?: ChipTone; children: React.ReactNode; className?: string; title?: string }) {
  const color = TONE_COLOR[tone];
  return (
    <span
      title={title}
      className={cn(
        "inline-flex h-6 shrink-0 items-center gap-1 rounded-full px-2.5 text-[12px] font-medium whitespace-nowrap",
        tone === "red" && "bg-error/12 text-error",
        tone === "green" && "bg-success/15 text-success",
        tone === "grey" && "bg-snow/[0.07] text-snow/60",
        className
      )}
      style={color ? { background: accentFill(color, 16), color: accentText(color) } : undefined}
    >
      {children}
    </span>
  );
}

/** Fehlender Wert, gelb hinterlegt („fehlt“, „Mail fehlt“) */
export function Missing({ children = "fehlt" }: { children?: React.ReactNode }) {
  return (
    <span className="inline-flex h-6 items-center rounded-md px-2 text-[12px] font-medium" style={{ background: accentFill("#f2c94c", 30), color: accentText("#a8820a") }}>
      {children}
    </span>
  );
}

/** Kopfzelle: klein, versal, gesperrt, grau */
export const thClass = "px-2.5 py-3.5 text-left text-[11px] font-semibold tracking-[0.1em] whitespace-nowrap text-snow/45 uppercase first:pl-6 last:pr-6";
export const tdClass = "px-2.5 py-3.5 first:pl-6 last:pr-6";
export const rowClass = "cursor-pointer border-t border-snow/[0.06] outline-none transition-colors hover:bg-snow/[0.025] focus-visible:bg-snow/[0.04]";

export type SortDir = 1 | -1;

/** Sortierbare Kopfzelle; Pfeil zeigt die aktive Richtung */
export function SortTh<K extends string>({
  id,
  sort,
  onSort,
  children,
  className,
}: {
  id: K;
  sort: { key: K; dir: SortDir };
  onSort: (key: K) => void;
  children: React.ReactNode;
  className?: string;
}) {
  const active = sort.key === id;
  const Icon = sort.dir === 1 ? ChevronUp : ChevronDown;
  return (
    <th className={cn(thClass, className)} aria-sort={active ? (sort.dir === 1 ? "ascending" : "descending") : undefined}>
      <button type="button" onClick={() => onSort(id)} className={cn("inline-flex items-center gap-1 uppercase hover:text-snow", active && "text-snow/75")}>
        {children}
        {active && <Icon className="h-3 w-3" strokeWidth={2.5} />}
      </button>
    </th>
  );
}

export function compare(a: string | number | null | undefined, b: string | number | null | undefined, dir: SortDir) {
  if (a === b) return 0;
  if (a === null || a === undefined || a === "") return 1;
  if (b === null || b === undefined || b === "") return -1;
  if (typeof a === "number" && typeof b === "number") return (a - b) * dir;
  return String(a).localeCompare(String(b), "de", { numeric: true }) * dir;
}

/** Kennzahl-Karte; tone „error“ = roter Rand und rote Zeile darunter */
export function Kpi({
  label,
  value,
  hint,
  tone,
  onClick,
}: {
  label: string;
  value: string;
  hint?: React.ReactNode;
  tone?: "error";
  onClick?: () => void;
}) {
  const Tag = onClick ? "button" : "div";
  return (
    <Tag
      type={onClick ? "button" : undefined}
      onClick={onClick}
      className={cn(cardClass, "flex flex-col px-6 py-5 text-left", tone === "error" && "border-error/45", onClick && "transition-transform hover:-translate-y-0.5")}
    >
      <span className="text-[13px] font-medium text-snow/55">{label}</span>
      <span className="mt-2 text-[26px] leading-none font-semibold tracking-tight tabular-nums">{value}</span>
      {hint && <span className={cn("mt-2.5 text-[12.5px]", tone === "error" ? "font-medium text-error" : "text-snow/50")}>{hint}</span>}
    </Tag>
  );
}
