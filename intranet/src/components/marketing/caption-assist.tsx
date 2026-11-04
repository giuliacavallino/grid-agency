"use client";

import { useState } from "react";
import { Check, Hash, Minimize2, PenLine, Smile, Sparkles, Wand2, X } from "lucide-react";
import { api } from "@/lib/api";
import { cn as clsx } from "@/lib/cn";
import { PROVIDERS, type PostProvider } from "@/lib/marketing";
import { Button, IconButton, Input, useToast } from "@/components/ui";
import { ProviderMark } from "./common";

// KI-Assistent neben der Caption: schreibt, verbessert, kürzt, passt an eine
// Plattform an, setzt Emojis oder schlägt Hashtags vor – in der CI des Kunden.

type Action = "write" | "improve" | "shorten" | "adapt" | "hashtags" | "emojis";
type Result = { variants: string[]; hashtags?: string[] };

const ACTIONS: { action: Exclude<Action, "adapt">; label: string; busy: string; icon: React.ReactNode; needsText?: boolean }[] = [
  { action: "write", label: "Caption schreiben", busy: "Schreibt …", icon: <PenLine className="h-3.5 w-3.5" /> },
  { action: "improve", label: "Verbessern", busy: "Verbessert …", icon: <Wand2 className="h-3.5 w-3.5" />, needsText: true },
  { action: "shorten", label: "Kürzer", busy: "Kürzt …", icon: <Minimize2 className="h-3.5 w-3.5" />, needsText: true },
  { action: "emojis", label: "Emojis dezent", busy: "Ergänzt …", icon: <Smile className="h-3.5 w-3.5" />, needsText: true },
  { action: "hashtags", label: "Hashtags vorschlagen", busy: "Sucht …", icon: <Hash className="h-3.5 w-3.5" /> },
];

/** Hashtags ans Ende hängen: in die letzte Zeile, wenn die schon nur aus Hashtags besteht */
function appendTags(caption: string, tags: string[]) {
  const text = caption.trimEnd();
  if (!text) return tags.join(" ");
  const last = text.split("\n").pop() ?? "";
  return /^(#[\p{L}\p{N}_]+\s*)+$/u.test(last.trim()) ? `${text} ${tags.join(" ")}` : `${text}\n\n${tags.join(" ")}`;
}

const hasTag = (caption: string, tag: string) => new RegExp(`(^|\\s)${tag.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(?![\\p{L}\\p{N}_])`, "iu").test(caption);

export function CaptionAssist({
  workspaceId,
  workspaceName,
  caption,
  platforms,
  image,
  onCaption,
  onClose,
}: {
  workspaceId: string;
  workspaceName: string;
  caption: string;
  platforms: PostProvider[];
  /** Erstes Bild des Posts (Storage-Pfad) als Kontext fürs Schreiben */
  image?: string;
  onCaption: (next: string) => void;
  onClose: () => void;
}) {
  const toast = useToast();
  const [brief, setBrief] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [result, setResult] = useState<(Result & { label: string }) | null>(null);
  const [used, setUsed] = useState<number | null>(null);
  const empty = !caption.trim();

  async function run(action: Action, label: string, platform?: PostProvider) {
    const key = platform ? `adapt:${platform}` : action;
    setBusy(key);
    try {
      const data = await api<Result>("/api/marketing/assist", {
        method: "POST",
        body: JSON.stringify({ workspace_id: workspaceId, action, caption, brief, platforms, platform, image }),
      });
      setResult({ ...data, label });
      setUsed(null);
    } catch (error) {
      toast(error instanceof Error ? error.message : "Assistent nicht erreichbar", "error");
    }
    setBusy(null);
  }

  return (
    <section aria-label="KI-Assistent" className="mt-2 rounded-2xl border border-snow/[0.1] bg-snow/[0.03] p-3">
      <div className="mb-2 flex items-center gap-2">
        <Sparkles className="h-4 w-4 text-snow/70" aria-hidden />
        <p className="flex-1 text-[13px] font-medium">
          KI-Assistent <span className="font-normal text-snow/50">· in der CI von {workspaceName}</span>
        </p>
        <IconButton label="Assistent schließen" className="h-7 w-7" onClick={onClose}>
          <X className="h-3.5 w-3.5" />
        </IconButton>
      </div>

      <Input
        value={brief}
        onChange={(e) => setBrief(e.target.value)}
        maxLength={1000}
        placeholder="Idee oder Stichworte, z. B. „Neues Kürbisbrot ab Montag“"
        aria-label="Idee oder Stichworte"
        className="mb-2 h-9 text-[13px]"
        onKeyDown={(e) => {
          if (e.key === "Enter" && brief.trim() && !busy) {
            e.preventDefault();
            void run("write", "Caption schreiben");
          }
        }}
      />

      <div className="flex flex-wrap gap-1.5">
        {ACTIONS.map((a) => (
          <Button
            key={a.action}
            size="sm"
            className="h-7 gap-1.5 px-2.5 text-[12px]"
            icon={a.icon}
            loading={busy === a.action}
            loadingText={a.busy}
            disabled={busy !== null || (a.needsText && empty) || (a.action === "write" && empty && !brief.trim() && !image)}
            title={a.needsText && empty ? "Erst einen Text schreiben" : a.action === "write" && empty && !brief.trim() && !image ? "Kurz die Idee eingeben" : undefined}
            onClick={() => run(a.action, a.label)}
          >
            {a.label}
          </Button>
        ))}
        {platforms.map((p) => (
          <Button
            key={p}
            size="sm"
            className="h-7 gap-1.5 pr-2.5 pl-1 text-[12px]"
            icon={<ProviderMark provider={p} className="h-5 min-w-5 text-[9px]" />}
            loading={busy === `adapt:${p}`}
            loadingText="Passt an …"
            disabled={busy !== null || empty}
            title={empty ? "Erst einen Text schreiben" : undefined}
            onClick={() => run("adapt", `Für ${PROVIDERS[p].label}`, p)}
          >
            Für {PROVIDERS[p].label} anpassen
          </Button>
        ))}
      </div>

      {result && (
        <div className="mt-3 grid gap-2" aria-live="polite">
          <p className="text-[11.5px] font-medium text-snow/55">{result.label}</p>
          {result.hashtags?.length ? (
            <>
              <div className="flex flex-wrap gap-1.5">
                {result.hashtags.map((tag) => {
                  const on = hasTag(caption, tag);
                  return (
                    <button
                      key={tag}
                      type="button"
                      disabled={on}
                      aria-pressed={on}
                      onClick={() => onCaption(appendTags(caption, [tag]))}
                      title={on ? "Steht schon im Text" : "Anhängen"}
                      className={clsx(
                        "inline-flex h-7 items-center gap-1 rounded-full border px-2.5 text-[12px] transition-colors",
                        on ? "border-snow/30 bg-snow/[0.1] text-snow/60" : "border-snow/15 hover:border-snow/40 hover:bg-snow/[0.06]"
                      )}
                    >
                      {on && <Check className="h-3 w-3" aria-hidden />}
                      {tag}
                    </button>
                  );
                })}
              </div>
              <div>
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-7 px-2.5 text-[12px]"
                  disabled={result.hashtags.every((tag) => hasTag(caption, tag))}
                  onClick={() => onCaption(appendTags(caption, result.hashtags!.filter((tag) => !hasTag(caption, tag))))}
                >
                  Alle anhängen
                </Button>
              </div>
            </>
          ) : (
            result.variants.map((variant, index) => (
              <div key={index} className={clsx("rounded-xl border bg-canvas p-2.5", used === index ? "border-snow/40" : "border-snow/[0.08]")}>
                <p className="max-h-40 overflow-y-auto text-[13px] leading-relaxed whitespace-pre-wrap">{variant}</p>
                <div className="mt-2 flex items-center gap-1.5">
                  <span className="flex-1 text-[11px] text-snow/45 tabular-nums">{variant.length.toLocaleString("de-DE")} Zeichen</span>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-7 px-2.5 text-[12px]"
                    onClick={() => {
                      onCaption(empty ? variant : `${caption.trimEnd()}\n\n${variant}`);
                      setUsed(index);
                    }}
                  >
                    Anhängen
                  </Button>
                  <Button
                    size="sm"
                    variant="primary"
                    className="h-7 px-2.5 text-[12px]"
                    icon={used === index ? <Check className="h-3.5 w-3.5" /> : undefined}
                    onClick={() => {
                      onCaption(variant);
                      setUsed(index);
                    }}
                  >
                    {used === index ? "Übernommen" : "Übernehmen"}
                  </Button>
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </section>
  );
}
