"use client";

import { forwardRef, useImperativeHandle, useRef } from "react";
import {
  AlignCenter,
  AlignLeft,
  AlignRight,
  Bold,
  Eraser,
  Highlighter,
  Image as ImageIcon,
  IndentDecrease,
  IndentIncrease,
  Italic,
  Link2,
  Link2Off,
  List,
  ListOrdered,
  Palette,
  Redo2,
  Strikethrough,
  Underline,
  Undo2,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/cn";

// Text-Editor wie in Outlook: Schrift, Größe, Formatierung, Listen,
// Ausrichtung, Links und Bilder. Arbeitet mit contentEditable und liefert HTML.

const FONTS = ["Aptos", "Arial", "Calibri", "Georgia", "Helvetica", "Roboto", "Times New Roman", "Verdana"];
// execCommand("fontSize") kennt nur die Stufen 1–7
const SIZES: [string, string][] = [
  ["2", "10 pt"],
  ["3", "12 pt"],
  ["4", "14 pt"],
  ["5", "18 pt"],
  ["6", "24 pt"],
];

export type RichEditorHandle = { html: () => string; text: () => string; insertHtml: (html: string) => void; focus: () => void };

type Tool = { icon: LucideIcon; label: string; run: () => void };

export const RichEditor = forwardRef<RichEditorHandle, { placeholder?: string; initialHtml?: string; className?: string; autoFocus?: boolean; onChange?: () => void }>(
  function RichEditor({ placeholder, initialHtml = "", className, autoFocus, onChange }, ref) {
    const area = useRef<HTMLDivElement>(null);
    const colorInput = useRef<HTMLInputElement>(null);
    const highlightInput = useRef<HTMLInputElement>(null);
    const imageInput = useRef<HTMLInputElement>(null);

    useImperativeHandle(ref, () => ({
      html: () => area.current?.innerHTML ?? "",
      text: () => area.current?.innerText ?? "",
      insertHtml: (html) => {
        area.current?.focus();
        document.execCommand("insertHTML", false, html);
        onChange?.();
      },
      focus: () => area.current?.focus(),
    }));

    function exec(command: string, value?: string) {
      area.current?.focus();
      document.execCommand(command, false, value);
      onChange?.();
    }

    const groups: Tool[][] = [
      [
        { icon: Bold, label: "Fett", run: () => exec("bold") },
        { icon: Italic, label: "Kursiv", run: () => exec("italic") },
        { icon: Underline, label: "Unterstrichen", run: () => exec("underline") },
        { icon: Strikethrough, label: "Durchgestrichen", run: () => exec("strikeThrough") },
        { icon: Palette, label: "Schriftfarbe", run: () => colorInput.current?.click() },
        { icon: Highlighter, label: "Hervorheben", run: () => highlightInput.current?.click() },
      ],
      [
        { icon: List, label: "Aufzählung", run: () => exec("insertUnorderedList") },
        { icon: ListOrdered, label: "Nummerierung", run: () => exec("insertOrderedList") },
        { icon: IndentDecrease, label: "Einzug verkleinern", run: () => exec("outdent") },
        { icon: IndentIncrease, label: "Einzug vergrößern", run: () => exec("indent") },
      ],
      [
        { icon: AlignLeft, label: "Linksbündig", run: () => exec("justifyLeft") },
        { icon: AlignCenter, label: "Zentriert", run: () => exec("justifyCenter") },
        { icon: AlignRight, label: "Rechtsbündig", run: () => exec("justifyRight") },
      ],
      [
        {
          icon: Link2,
          label: "Link einfügen",
          run: () => {
            const url = window.prompt("Link (https://…)");
            if (url) exec("createLink", /^[a-z]+:/i.test(url) ? url : `https://${url}`);
          },
        },
        { icon: Link2Off, label: "Link entfernen", run: () => exec("unlink") },
        { icon: ImageIcon, label: "Bild einfügen", run: () => imageInput.current?.click() },
      ],
      [
        { icon: Eraser, label: "Formatierung entfernen", run: () => exec("removeFormat") },
        { icon: Undo2, label: "Rückgängig", run: () => exec("undo") },
        { icon: Redo2, label: "Wiederholen", run: () => exec("redo") },
      ],
    ];

    const select = "h-9 w-full rounded-xl border border-snow/10 bg-surface px-3 text-[14px] text-snow outline-none focus:border-snow/30";

    return (
      <div className={cn("flex flex-col overflow-hidden rounded-2xl border border-snow/[0.08] bg-panel", className)}>
        <div className="flex flex-col gap-1.5 border-b border-snow/[0.08] p-2">
          <select aria-label="Schriftart" defaultValue="Aptos" onChange={(e) => exec("fontName", e.target.value)} className={select}>
            {FONTS.map((font) => (
              <option key={font} value={font}>
                {font}
              </option>
            ))}
          </select>
          <select aria-label="Schriftgröße" defaultValue="3" onChange={(e) => exec("fontSize", e.target.value)} className={select}>
            {SIZES.map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
          <div role="toolbar" aria-label="Formatierung" className="flex flex-wrap items-center gap-0.5 px-1 pt-0.5">
            {groups.map((group, index) => (
              <div key={index} className={cn("flex items-center gap-0.5", index > 0 && "ml-1 border-l border-snow/10 pl-1.5")}>
                {group.map(({ icon: Icon, label, run }) => (
                  <button
                    key={label}
                    type="button"
                    title={label}
                    aria-label={label}
                    // Auswahl im Text behalten
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={run}
                    className="grid h-8 w-8 place-items-center rounded-lg text-snow/70 hover:bg-snow/[0.08] hover:text-snow"
                  >
                    <Icon className="h-4 w-4" strokeWidth={1.8} />
                  </button>
                ))}
              </div>
            ))}
          </div>
          <input ref={colorInput} type="color" className="sr-only" tabIndex={-1} aria-hidden onChange={(e) => exec("foreColor", e.target.value)} />
          <input ref={highlightInput} type="color" defaultValue="#fff59d" className="sr-only" tabIndex={-1} aria-hidden onChange={(e) => exec("hiliteColor", e.target.value)} />
          <input
            ref={imageInput}
            type="file"
            accept="image/png,image/jpeg,image/gif,image/webp"
            className="sr-only"
            tabIndex={-1}
            aria-hidden
            onChange={(e) => {
              const file = e.target.files?.[0];
              e.target.value = "";
              if (!file) return;
              // Bilder bis 1 MB direkt in die Mail einbetten
              if (file.size > 1024 * 1024) return window.alert("Bild bitte kleiner als 1 MB oder als Datei anhängen.");
              const reader = new FileReader();
              reader.onload = () => exec("insertImage", String(reader.result));
              reader.readAsDataURL(file);
            }}
          />
        </div>
        <div
          ref={area}
          role="textbox"
          aria-multiline
          aria-label={placeholder ?? "Text"}
          contentEditable
          suppressContentEditableWarning
          autoFocus={autoFocus}
          data-placeholder={placeholder}
          onInput={onChange}
          dangerouslySetInnerHTML={{ __html: initialHtml }}
          className="rich-editor min-h-40 flex-1 overflow-y-auto bg-white px-4 py-3 text-[14px] leading-relaxed text-[#1f1d1b] outline-none"
          style={{ fontFamily: "Aptos, Calibri, system-ui, sans-serif" }}
        />
      </div>
    );
  }
);
