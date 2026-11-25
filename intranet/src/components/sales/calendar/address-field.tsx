"use client";

import { useRef } from "react";
import { X } from "lucide-react";
import { cn as clsx } from "@/lib/cn";
import { isEmail, parseAddresses } from "../mail/format";

// Empfängerfeld wie in Outlook: Enter, Tab, Komma oder Semikolon machen aus
// der getippten Adresse einen Chip, beliebig viele; Rücktaste löscht den
// letzten. Der Wert bleibt eine Liste als Text („a@x.de, b@y.de, …“), die
// aktuell getippte Adresse steht am Ende und zählt beim Speichern mit.

export function AddressField({ id, value, onChange, placeholder }: { id: string; value: string; onChange: (value: string) => void; placeholder?: string }) {
  const input = useRef<HTMLInputElement>(null);
  const cut = Math.max(value.lastIndexOf(","), value.lastIndexOf(";"));
  const chips = parseAddresses(cut >= 0 ? value.slice(0, cut) : "");
  const draft = cut >= 0 ? value.slice(cut + 1).trimStart() : value;
  const join = (list: string[], text = "") => (list.length ? `${list.join(", ")}, ${text}` : text);

  function commit() {
    const fresh = parseAddresses(draft);
    if (!fresh.length) return false;
    onChange(join([...chips, ...fresh.filter((a) => !chips.includes(a))]));
    return true;
  }

  return (
    <div
      className="flex min-h-11 w-full cursor-text flex-wrap items-center gap-1.5 rounded-xl border border-snow/10 bg-surface px-2.5 py-1.5 focus-within:border-snow/35"
      onClick={() => input.current?.focus()}
    >
      {chips.map((address) => (
        <span
          key={address}
          className={clsx(
            "inline-flex max-w-full items-center gap-1 rounded-full border py-0.5 pr-1 pl-2.5 text-[13px]",
            isEmail(address) ? "border-snow/15 bg-snow/[0.06]" : "border-error/50 bg-error/10 text-error"
          )}
          title={isEmail(address) ? address : "Keine gültige E-Mail-Adresse"}
        >
          <span className="truncate">{address}</span>
          <button
            type="button"
            aria-label={`${address} entfernen`}
            className="grid h-5 w-5 place-items-center rounded-full text-snow/50 hover:bg-snow/10 hover:text-snow"
            onClick={(e) => {
              e.stopPropagation();
              onChange(join(chips.filter((a) => a !== address), draft));
            }}
          >
            <X className="h-3 w-3" />
          </button>
        </span>
      ))}
      <input
        ref={input}
        id={id}
        type="text"
        inputMode="email"
        autoComplete="email"
        value={draft}
        placeholder={chips.length ? "" : placeholder}
        onChange={(e) => {
          const text = e.target.value;
          // Komma, Semikolon oder Leerzeichen nach einer Adresse: Chip
          if (/[,;\s]$/.test(text) && parseAddresses(text).length) onChange(join([...chips, ...parseAddresses(text).filter((a) => !chips.includes(a))]));
          else onChange(join(chips, text));
        }}
        onKeyDown={(e) => {
          if ((e.key === "Enter" || (e.key === "Tab" && draft.trim())) && commit()) e.preventDefault();
          else if (e.key === "Enter") e.preventDefault();
          else if (e.key === "Backspace" && !draft && chips.length) {
            e.preventDefault();
            onChange(join(chips.slice(0, -1)));
          }
        }}
        onBlur={commit}
        onPaste={(e) => {
          const text = e.clipboardData.getData("text");
          if (!/[,;\s]/.test(text.trim())) return;
          e.preventDefault();
          onChange(join([...chips, ...parseAddresses(`${draft}${text}`).filter((a) => !chips.includes(a))]));
        }}
        className="h-8 min-w-40 flex-1 bg-transparent px-1 text-[14px] text-snow outline-none placeholder:text-snow/35"
      />
    </div>
  );
}
