"use client";

import { useState } from "react";
import { Bot, Check, MessageSquareText, Send } from "lucide-react";
import { api } from "@/lib/api";
import { POST_FORMATS, type SocialPost } from "@/lib/marketing";
import { Badge, Button, Textarea, useToast } from "@/components/ui";

// Freigabe eines Agent-Entwurfs (Tage-Autopilot): Anlass und Idee des Agenten,
// Verlauf der Wünsche, „Freigeben“ plant den Post ein, „Änderung wünschen“
// lässt Claude Caption und Canva-Grafiken überarbeiten.

export function ReviewPanel({
  post,
  approving,
  onApprove,
  onRevised,
}: {
  post: SocialPost;
  approving: boolean;
  onApprove: () => void;
  onRevised: (post: SocialPost) => void;
}) {
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const notes = post.review ?? [];
  const last = [...notes].reverse().find((n) => n.kind === "agent");

  async function send() {
    if (!text.trim()) return toast("Bitte kurz beschreiben, was anders sein soll", "error");
    setBusy(true);
    try {
      const saved = await api<SocialPost>(`/api/marketing/posts/${post.id}/revise`, { method: "POST", body: JSON.stringify({ feedback: text }) });
      onRevised(saved);
      setText("");
      setOpen(false);
      toast("Überarbeitet: neue Caption und Grafiken");
    } catch (error) {
      toast(error instanceof Error ? error.message : "Überarbeiten fehlgeschlagen", "error");
    }
    setBusy(false);
  }

  return (
    <section className="rounded-2xl border border-snow/[0.1] bg-snow/[0.035] p-3.5">
      <div className="flex flex-wrap items-start gap-3">
        <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-snow/[0.08]">
          <Bot className="h-4 w-4" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="flex flex-wrap items-center gap-1.5 text-[13.5px] font-semibold">
            Vorschlag vom Agenten
            <Badge>{POST_FORMATS[post.format ?? "feed"].label}</Badge>
          </p>
          {last && <p className="mt-0.5 text-[12.5px] leading-relaxed text-snow/65">{last.text}</p>}
        </div>
        {post.status === "draft" && (
          <div className="flex flex-wrap gap-2">
            <Button size="sm" variant={open ? "secondary" : "ghost"} icon={<MessageSquareText className="h-4 w-4" />} aria-expanded={open} disabled={busy || approving} onClick={() => setOpen((v) => !v)}>
              Änderung wünschen
            </Button>
            <Button size="sm" variant="primary" icon={<Check className="h-4 w-4" />} loading={approving} loadingText="Wird freigegeben …" disabled={busy} onClick={onApprove} title="Zum Termin einplanen">
              Freigeben
            </Button>
          </div>
        )}
      </div>

      {notes.some((n) => n.kind === "wunsch") && (
        <ul className="mt-3 flex flex-col gap-1.5 border-t border-snow/[0.08] pt-3 text-[12.5px]">
          {notes
            .filter((n) => n.kind === "wunsch")
            .map((n) => (
              <li key={n.at} className="text-snow/65">
                <span className="font-medium text-snow/80">{n.by.split("@")[0]}</span> · {new Date(n.at).toLocaleString("de-DE", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}: {n.text}
              </li>
            ))}
        </ul>
      )}

      {open && (
        <div className="mt-3 flex flex-col gap-2 border-t border-snow/[0.08] pt-3">
          <Textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={3}
            autoFocus
            placeholder="z. B. „Weniger Emojis, Croissant statt Brot zeigen, Headline kürzer“"
            aria-label="Änderungswunsch"
            className="w-full text-[13.5px]"
            onKeyDown={(e) => {
              if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) send();
            }}
          />
          <div className="flex items-center justify-between gap-2">
            <p className="text-[11.5px] text-snow/45">Claude überarbeitet Caption und Grafiken, neue Designs landen im Canva-Kundenordner.</p>
            <Button size="sm" variant="primary" icon={<Send className="h-4 w-4" />} loading={busy} loadingText="Wird überarbeitet … (1–2 Min.)" onClick={send}>
              Senden
            </Button>
          </div>
        </div>
      )}
    </section>
  );
}
