import type { Metadata } from "next";
import { PageShell } from "@/components/app/PageShell";
import { BookingWidget } from "@/components/BookingWidget";

export const metadata: Metadata = {
  title: "Termin buchen | GRID Agency",
  description: "Buch dir ein unverbindliches Erstgespräch mit GRID Agency: 30 Minuten per Teams, direkt im Kalender.",
  referrer: "no-referrer",
};

/** Terminbuchung als eigene Seite: ohne Link das Erstgespräch, mit
 * Einladungslink (?l=…) vorausgefüllt, mit &art=kickoff der Kick-off. */
export default async function TerminPage({ searchParams }: PageProps<"/termin">) {
  const params = await searchParams;
  const token = typeof params.l === "string" ? params.l : null;
  const kind = params.art === "kickoff" && token ? "kickoff" : "erstgespraech";
  return (
    <PageShell>
      <div className="mx-auto max-w-xl">
        <p className="text-[0.6875rem] font-medium uppercase tracking-[0.25em] text-dune">
          {kind === "kickoff" ? "Kick-off · 60 Minuten" : "Erstgespräch · 30 Minuten"}
        </p>
        <h1 className="mt-2 text-3xl font-medium tracking-tight text-snow lg:text-4xl">
          {kind === "kickoff" ? "Lass uns starten." : "Boost your Socials."}
        </h1>
        <p className="mt-3 text-sm font-light leading-relaxed text-snow/70">
          {kind === "kickoff"
            ? "Such dir einen Termin für den Kick-off aus. Wir gehen Ziele, Zugänge, Content-Plan und Abläufe durch."
            : "Unverbindlich und per Teams: Erzähl uns, was du vorhast, und wir zeigen dir, wie wir dich unterstützen können."}
        </p>
        <div className="mt-6 flex min-h-[28rem] flex-col overflow-hidden rounded-2xl bg-white">
          <BookingWidget kind={kind} token={token} />
        </div>
      </div>
    </PageShell>
  );
}
