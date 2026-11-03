"use client";

import { useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { graphFor, useAsync } from "@/lib/graph";
import { Empty, Spinner } from "@/components/ui";
import { Compose } from "./compose";
import { announceSent } from "./compose-window";
import type { ReplyMode } from "./reading-pane";

const REPLY_MODES: ReplyMode[] = ["reply", "replyAll", "forward"];

/** Verfassen im eigenen Fenster: neue Mail oder Antwort auf ?mailbox=&id= */
export function ComposeWindow({ mailboxes }: { mailboxes: string[] }) {
  const params = useSearchParams();
  const router = useRouter();
  const mode = params.get("mode") as ReplyMode | "new" | null;
  const mailbox = params.get("mailbox") ?? params.get("from") ?? mailboxes[0];
  const id = params.get("id");
  const reply = mode && REPLY_MODES.includes(mode as ReplyMode) && id ? (mode as ReplyMode) : null;
  const source = useAsync(reply ? `compose:${mailbox}:${id}` : null, () => graphFor(mailbox).message(id!));

  useEffect(() => {
    const title = { reply: "Antworten", replyAll: "Allen antworten", forward: "Weiterleiten" };
    document.title = reply ? `${title[reply]} – GRID Mail` : "Neue E-Mail – GRID Mail";
  }, [reply]);

  // Als Pop-up schließen, sonst zurück zum Posteingang
  function close() {
    if (window.opener) window.close();
    else router.push("/mail");
  }

  return (
    <main className="flex h-dvh flex-col bg-canvas">
      {reply && !source.data ? (
        <div className="grid flex-1 place-items-center">
          {source.error ? <Empty title="Nachricht nicht gefunden" text="Bitte im Posteingang erneut auf Antworten klicken." /> : <Spinner />}
        </div>
      ) : (
        <Compose
          state={reply && source.data ? { mode: reply, source: source.data } : { mode: "new", to: params.get("to") ?? undefined }}
          mailbox={mailbox}
          fromOptions={mailboxes}
          onClose={close}
          onSent={() => {
            announceSent();
            close();
          }}
        />
      )}
    </main>
  );
}
