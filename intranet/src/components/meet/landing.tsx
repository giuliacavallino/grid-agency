"use client";

import { useState } from "react";
import { Lock, Mic, PhoneOff, Video } from "lucide-react";
import { cn as clsx } from "@/lib/cn";
import { Button } from "@/components/ui";
import { MeetShell } from "./brand";

// Startseite von meet.grid-agency.de: animierte Call-Vorschau, Code oder
// Link eingeben, beitreten.

const CODE = /([a-z2-9]{3}-[a-z2-9]{4}-[a-z2-9]{3})/;

const TILES = [
  { initials: "GC", name: "Giulia", tone: "from-[#fa7e1e]/45", speaking: true },
  { initials: "SM", name: "Simon", tone: "from-[#4f5bd5]/45" },
  { initials: "LK", name: "Lea", tone: "from-[#d62976]/40" },
  { initials: "Du", name: "Du", tone: "from-snow/15" },
];

function CallPreview() {
  return (
    <div className="meet-hover mx-auto w-full max-w-sm" aria-hidden>
      <p className="mx-auto mb-3 flex w-fit items-center gap-1.5 rounded-full border border-snow/12 bg-surface/80 px-3.5 py-1.5 font-mono text-xs text-snow/70 shadow-sm backdrop-blur">
        <Lock className="h-3 w-3" /> meet.grid-agency.de/<span className="font-semibold text-snow">abc-defg-hjk</span>
      </p>
      <div className="rounded-3xl border border-snow/12 bg-ink/90 p-2.5 shadow-2xl">
        <div className="grid grid-cols-2 gap-2">
          {TILES.map((t) => (
            <div
              key={t.name}
              className={clsx(
                "relative grid aspect-[4/3] place-items-center rounded-2xl bg-gradient-to-br to-snow/[0.04] ring-2",
                t.tone,
                t.speaking ? "ring-success/80" : "ring-transparent"
              )}
            >
              <span className="grid h-10 w-10 place-items-center rounded-full bg-snow/85 text-sm font-semibold text-sky">{t.initials}</span>
              <span className="absolute bottom-1.5 left-2 text-[10px] text-snow/75">{t.name}</span>
              {t.speaking && (
                <span className="absolute top-2 right-2 flex h-3 items-end gap-0.5">
                  {[0, 0.2, 0.4].map((d) => (
                    <span key={d} className="meet-bar w-0.5 rounded-full bg-success" style={{ height: "100%", "--delay": `${d}s` } as React.CSSProperties} />
                  ))}
                </span>
              )}
            </div>
          ))}
        </div>
        <div className="mt-2.5 flex justify-center gap-2">
          <span className="grid h-8 w-8 place-items-center rounded-full bg-snow/10 text-snow/80"><Mic className="h-3.5 w-3.5" /></span>
          <span className="grid h-8 w-8 place-items-center rounded-full bg-snow/10 text-snow/80"><Video className="h-3.5 w-3.5" /></span>
          <span className="grid h-8 w-8 place-items-center rounded-full bg-error text-sky"><PhoneOff className="h-3.5 w-3.5" /></span>
        </div>
      </div>
    </div>
  );
}

export function MeetLanding() {
  const [value, setValue] = useState("");
  const [going, setGoing] = useState(false);
  const code = value.trim().toLowerCase().match(CODE)?.[1];

  return (
    <MeetShell>
      <div className="flex flex-col items-center py-8 text-center md:py-12">
        <CallPreview />
        <h1 className="rise-in mt-10 text-[2.6rem] leading-[1.02] font-semibold tracking-tight md:text-7xl">
          Ein Link. Und ihr seid <span className="text-aurora">live.</span>
        </h1>
        <p className="rise-in mt-4 max-w-lg text-base text-snow/65 md:text-lg" style={{ "--delay": "80ms" } as React.CSSProperties}>
          Video-Calls mit GRID direkt im Browser: ohne Konto, ohne Installation.
        </p>
        <form
          className="rise-in mt-7 flex w-full max-w-md items-center gap-2 rounded-full border border-snow/12 bg-surface/80 p-1.5 pl-5 shadow-lg backdrop-blur"
          style={{ "--delay": "160ms" } as React.CSSProperties}
          onSubmit={(e) => {
            e.preventDefault();
            if (!code) return;
            setGoing(true);
            window.location.assign(`/${code}`);
          }}
        >
          <label htmlFor="meet-code" className="sr-only">
            Code oder Link
          </label>
          <input
            id="meet-code"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder="Code oder Link, z. B. abc-defg-hjk"
            autoComplete="off"
            spellCheck={false}
            className="min-w-0 flex-1 bg-transparent text-[15px] text-snow outline-none placeholder:text-snow/40"
          />
          <Button type="submit" variant="primary" disabled={!code} loading={going} loadingText="Wird geöffnet …">
            Teilnehmen
          </Button>
        </form>
      </div>
    </MeetShell>
  );
}
