"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Building2, Check, ChevronDown, Search, Sparkles } from "lucide-react";
import { cn } from "@/lib/cn";
import type { Customer } from "@/lib/sales/types";
import { Popover } from "@/components/ui";

// Kundenauswahl mit Suche: Tippen filtert nach Name, Ansprechpartner, Mail
// und Kundennummer. Ohne Eingabe stehen oben Vorschläge (passend zu den
// eingeladenen Adressen bzw. dem Titel, sonst die zuletzt bearbeiteten).

type Option = Pick<Customer, "id" | "name" | "contact_name" | "email" | "customer_number" | "status" | "updated_at"> & { billing_email?: string | null };

const FREEMAIL = new Set(["gmail.com", "googlemail.com", "web.de", "gmx.de", "gmx.net", "t-online.de", "outlook.com", "hotmail.com", "icloud.com", "me.com", "yahoo.com", "yahoo.de"]);
const domainOf = (mail?: string | null) => (mail?.split("@")[1] ?? "").toLowerCase();

export function CustomerPicker({
  id,
  value,
  onChange,
  customers,
  emails = [],
  text = "",
  className,
}: {
  id?: string;
  value: string;
  onChange: (id: string) => void;
  customers: Option[];
  /** Eingeladene Adressen: gleiche Firmen-Domain wird vorgeschlagen */
  emails?: string[];
  /** Titel o. Ä.: enthaltene Kundennamen werden vorgeschlagen */
  text?: string;
  className?: string;
}) {
  const active = useMemo(() => customers.filter((c) => c.status !== "ehemalig" || c.id === value), [customers, value]);
  const selected = customers.find((c) => c.id === value);

  const suggestions = useMemo(() => {
    const domains = new Set(emails.map(domainOf).filter((d) => d && !FREEMAIL.has(d)));
    const lower = text.toLowerCase();
    const scored = active
      .map((c) => {
        let score = 0;
        if (emails.some((e) => e.toLowerCase() === c.email?.toLowerCase())) score += 3;
        if (domains.has(domainOf(c.email)) || domains.has(domainOf(c.billing_email))) score += 2;
        const short = c.name.replace(/\s+(GmbH|UG|AG|KG|Inc\.|Co\.|& Co\. KG|e\.K\.)\b.*$/i, "").toLowerCase();
        if (short.length > 2 && lower.includes(short)) score += 2;
        return { c, score };
      })
      .filter((x) => x.score > 0)
      .sort((a, b) => b.score - a.score)
      .map((x) => x.c);
    if (scored.length) return { label: "Passt zum Termin", list: scored.slice(0, 5) };
    const recent = [...active].sort((a, b) => (b.updated_at ?? "").localeCompare(a.updated_at ?? "")).slice(0, 5);
    return { label: "Zuletzt bearbeitet", list: recent };
  }, [active, emails, text]);

  return (
    <Popover
      align="left"
      trigger={({ toggle, open }) => (
        <button
          id={id}
          type="button"
          onClick={toggle}
          aria-expanded={open}
          aria-haspopup="listbox"
          className={cn(
            "flex h-11 w-full items-center gap-2 rounded-xl border border-snow/10 bg-surface px-3.5 text-left text-[14px] outline-none focus-visible:border-snow/35",
            open && "border-snow/35",
            className
          )}
        >
          <span className={cn("min-w-0 flex-1 truncate", !selected && "text-snow/60")}>{selected?.name ?? "Ohne Kunde"}</span>
          {!selected && suggestions.label === "Passt zum Termin" && (
            <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-snow/[0.07] px-2 py-0.5 text-[11.5px] font-medium text-snow/70">
              <Sparkles className="h-3 w-3" /> Vorschlag: {suggestions.list[0].name}
            </span>
          )}
          <ChevronDown className={cn("h-4 w-4 shrink-0 text-snow/50 transition-transform", open && "rotate-180")} />
        </button>
      )}
    >
      {(close) => (
        <PickerList
          customers={active}
          value={value}
          suggestions={suggestions}
          onPick={(next) => {
            onChange(next);
            close();
          }}
        />
      )}
    </Popover>
  );
}

function PickerList({
  customers,
  value,
  suggestions,
  onPick,
}: {
  customers: Option[];
  value: string;
  suggestions: { label: string; list: Option[] };
  onPick: (id: string) => void;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState("");
  const [cursor, setCursor] = useState(0);
  useEffect(() => input.current?.focus(), []);

  const q = query.trim().toLowerCase();
  // Erst echte Treffer, danach unscharfe (Buchstaben in Reihenfolge, z. B. „frwk“ → Frittenwerk)
  const fields = (c: Option) => [c.name, c.contact_name, c.email, c.customer_number].map((v) => v?.toLowerCase() ?? "");
  const exact = q ? customers.filter((c) => fields(c).some((v) => v.includes(q))) : [];
  const fuzzy = q.length > 1 ? customers.filter((c) => !exact.includes(c) && inOrder(c.name.toLowerCase(), q.replace(/\s+/g, ""))) : [];
  const matches = [...exact, ...fuzzy].slice(0, 30);
  // Reihenfolge der Einträge für die Pfeiltasten
  const rows: { id: string; name: string; detail?: string; group?: string }[] = q
    ? matches.map((c, i) => ({ id: c.id, name: c.name, detail: [c.customer_number, c.contact_name].filter(Boolean).join(" · "), group: i === 0 ? `${matches.length} Treffer` : undefined }))
    : [
        { id: "", name: "Ohne Kunde" },
        ...suggestions.list.map((c, i) => ({ id: c.id, name: c.name, detail: [c.customer_number, c.contact_name].filter(Boolean).join(" · "), group: i === 0 ? suggestions.label : undefined })),
      ];

  return (
    <div className="w-[min(420px,90vw)]">
      <div className="relative mb-1">
        <Search className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-snow/40" />
        <input
          ref={input}
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setCursor(0);
          }}
          onKeyDown={(e) => {
            if (e.key === "ArrowDown") {
              e.preventDefault();
              setCursor((i) => Math.min(i + 1, rows.length - 1));
            } else if (e.key === "ArrowUp") {
              e.preventDefault();
              setCursor((i) => Math.max(i - 1, 0));
            } else if (e.key === "Enter") {
              e.preventDefault();
              if (rows[cursor]) onPick(rows[cursor].id);
            }
          }}
          placeholder="Kunde suchen …"
          aria-label="Kunde suchen"
          className="h-10 w-full rounded-xl border border-snow/10 bg-surface pr-3 pl-9 text-[14px] outline-none placeholder:text-snow/40 focus:border-snow/30"
        />
      </div>
      <ul role="listbox" aria-label="Kunden" className="max-h-72 overflow-y-auto">
        {q && !matches.length && <li className="px-3 py-6 text-center text-[13px] text-snow/50">Kein Kunde gefunden</li>}
        {rows.map((row, index) => (
          <li key={row.id || "none"}>
            {row.group && <p className="px-3 pt-2 pb-1 text-[11px] font-medium tracking-wide text-snow/45 uppercase">{row.group}</p>}
            <button
              type="button"
              role="option"
              aria-selected={row.id === value}
              onMouseEnter={() => setCursor(index)}
              onClick={() => onPick(row.id)}
              className={cn("flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left", index === cursor ? "bg-snow/[0.08]" : "hover:bg-snow/[0.05]")}
            >
              {row.id ? <Building2 className="h-4 w-4 shrink-0 text-snow/50" /> : <span className="w-4 shrink-0" />}
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[14px]">{row.name}</span>
                {row.detail && <span className="block truncate text-[12px] text-snow/50">{row.detail}</span>}
              </span>
              {row.id === value && <Check className="h-4 w-4 shrink-0" />}
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Alle Zeichen von needle kommen in hay in derselben Reihenfolge vor */
function inOrder(hay: string, needle: string) {
  let i = 0;
  for (const char of hay) if (char === needle[i]) i++;
  return i === needle.length;
}
