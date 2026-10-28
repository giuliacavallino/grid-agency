"use client";

import { useState } from "react";
import { ArrowLeft, Send } from "lucide-react";
import { SHARED_MAILBOX } from "@/lib/config";
import { graph, type Message } from "@/lib/graph";
import { Button, IconButton, Input, Textarea, useToast } from "@/components/ui";
import { isEmail, parseAddresses, recipientList, recipientName } from "./format";

export type ComposeState =
  | { mode: "new"; to?: string }
  | { mode: "reply" | "replyAll" | "forward"; source: Message };

const PREFIX = { reply: "AW: ", replyAll: "AW: ", forward: "WG: " } as const;

/** Verfassen direkt im Lesebereich wie in Outlook: neue Mail, Antwort oder
 * Weiterleitung. Antworten hängen die Originalnachricht automatisch an. */
export function Compose({ state, onClose, onSent }: { state: ComposeState; onClose: () => void; onSent: () => void }) {
  const toast = useToast();
  const source = state.mode === "new" ? null : state.source;
  const [to, setTo] = useState(state.mode === "new" ? (state.to ?? "") : "");
  const [cc, setCc] = useState("");
  const [showCc, setShowCc] = useState(false);
  const [subject, setSubject] = useState(source ? `${PREFIX[state.mode as keyof typeof PREFIX]}${source.subject ?? ""}` : "");
  const [body, setBody] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Bei Antworten stehen Empfänger*innen fest
  const fixedTo =
    state.mode === "reply"
      ? recipientName(state.source.from)
      : state.mode === "replyAll"
        ? recipientList(
            [state.source.from, ...state.source.toRecipients, ...state.source.ccRecipients].filter(
              (r): r is NonNullable<typeof r> => !!r && r.emailAddress.address.toLowerCase() !== SHARED_MAILBOX
            )
          )
        : null;

  async function send() {
    setError(null);
    const toList = parseAddresses(to);
    const ccList = parseAddresses(cc);
    if (fixedTo === null) {
      if (!toList.length) return setError("Bitte mindestens eine Empfängeradresse eintragen.");
      const invalid = [...toList, ...ccList].find((a) => !isEmail(a));
      if (invalid) return setError(`„${invalid}“ ist keine gültige E-Mail-Adresse.`);
    }
    if (state.mode === "new" && !body.trim() && !subject.trim()) return setError("Die Nachricht ist leer.");

    setSending(true);
    try {
      if (state.mode === "new") await graph.send({ to: toList, cc: ccList, subject, body });
      else if (state.mode === "forward") await graph.forward(state.source.id, { to: toList, comment: body });
      else await graph.reply(state.source.id, { comment: body, all: state.mode === "replyAll" });
      toast("Gesendet");
      onSent();
    } catch {
      setError("Senden fehlgeschlagen. Hat dein Konto „Senden als“ für hello@?");
      setSending(false);
    }
  }

  const title = { new: "Neue E-Mail", reply: "Antworten", replyAll: "Allen antworten", forward: "Weiterleiten" }[state.mode];

  return (
    <form
      className="flex h-full flex-col"
      onSubmit={(event) => {
        event.preventDefault();
        send();
      }}
      onKeyDown={(event) => {
        if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) send();
      }}
    >
      <div className="flex items-center gap-2 border-b border-snow/[0.08] px-3 py-2.5 md:px-5">
        <IconButton label="Zurück" onClick={onClose} className="md:hidden">
          <ArrowLeft className="h-5 w-5" />
        </IconButton>
        <h2 className="flex-1 text-[15px] font-medium">{title}</h2>
        <Button variant="ghost" size="sm" onClick={onClose} disabled={sending}>
          Verwerfen
        </Button>
        <Button type="submit" variant="primary" size="sm" icon={<Send className="h-4 w-4" />} loading={sending} loadingText="Wird gesendet …">
          Senden
        </Button>
      </div>

      <div className="flex flex-col border-b border-snow/[0.08] text-sm">
        <Row label="Von">
          <span className="px-3 text-snow/60">{SHARED_MAILBOX}</span>
        </Row>
        <Row label="An">
          {fixedTo !== null ? (
            <span className="truncate px-3 text-snow/85">{fixedTo}</span>
          ) : (
            <Input
              value={to}
              onChange={(e) => setTo(e.target.value)}
              placeholder="name@firma.de"
              className="h-10 rounded-none border-0 bg-transparent focus:shadow-none"
              autoFocus={state.mode !== "new" || !state.to}
            />
          )}
          {fixedTo === null && !showCc && (
            <button type="button" onClick={() => setShowCc(true)} className="px-3 text-[13px] text-snow/55 hover:text-snow">
              Cc
            </button>
          )}
        </Row>
        {showCc && (
          <Row label="Cc">
            <Input value={cc} onChange={(e) => setCc(e.target.value)} className="h-10 rounded-none border-0 bg-transparent focus:shadow-none" />
          </Row>
        )}
        <Row label="Betreff">
          {state.mode === "new" ? (
            <Input
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="Betreff"
              className="h-10 rounded-none border-0 bg-transparent focus:shadow-none"
            />
          ) : (
            <span className="truncate px-3 text-snow/85">{subject}</span>
          )}
        </Row>
      </div>

      <Textarea
        value={body}
        onChange={(e) => setBody(e.target.value)}
        placeholder="Nachricht schreiben …"
        autoFocus={state.mode === "new" && !!state.to}
        className="min-h-0 flex-1 resize-none rounded-none border-0 bg-transparent px-5 py-4 text-[14px] focus:shadow-none"
        aria-label="Nachricht"
      />

      <div className="px-5 pb-4 text-[12px]">
        {error ? (
          <p role="alert" className="text-error">{error}</p>
        ) : (
          source && <p className="text-snow/45">Die ursprüngliche Nachricht von {recipientName(source.from)} wird angehängt.</p>
        )}
      </div>
    </form>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex min-h-10 items-center border-b border-snow/[0.06] last:border-b-0">
      <span className="w-20 shrink-0 pl-5 text-[13px] text-snow/50">{label}</span>
      <div className="flex min-w-0 flex-1 items-center">{children}</div>
    </div>
  );
}
