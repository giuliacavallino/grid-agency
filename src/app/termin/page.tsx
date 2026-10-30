import type { Metadata } from "next";
import { PageShell } from "@/components/app/PageShell";
import { BookingWidget } from "@/components/app/BookingWidget";
import { PageHeader } from "@/components/ui/PageHeader";

export const metadata: Metadata = {
  title: "Termin buchen | GRID Agency",
  description: "Buch dir ein kostenloses Erstgespräch mit GRID Agency: 30 Minuten per Video-Call, direkt im Kalender.",
  referrer: "no-referrer",
  robots: { index: false, follow: false },
};

/** Terminbuchung aus Einladungsmails: mit Link (?l=…) vorausgefüllt fürs
 * Erstgespräch, mit &art=kickoff für den Kick-off nach der Unterschrift. */
export default async function TerminPage({ searchParams }: PageProps<"/termin">) {
  const params = await searchParams;
  const token = typeof params.l === "string" ? params.l : null;
  const kind = params.art === "kickoff" && token ? "kickoff" : "erstgespraech";
  return (
    <PageShell>
      <div className="mx-auto max-w-2xl">
        <PageHeader
          eyebrow={kind === "kickoff" ? "Kick-off" : "Erstgespräch"}
          title={
            kind === "kickoff" ? (
              <>
                Lass uns <span className="text-aurora">starten</span>.
              </>
            ) : (
              <>
                Boost your <span className="text-aurora">Socials</span>.
              </>
            )
          }
          text={
            kind === "kickoff"
              ? "Such dir einen Termin für den Kick-off aus. Wir gehen Ziele, Zugänge, Content-Plan und Abläufe durch."
              : "Erzähl uns, was du vorhast, und wir zeigen dir, wie wir dich unterstützen können."
          }
        />
        <div className="rise glass mt-8 rounded-[1.75rem] p-5 sm:p-7">
          <BookingWidget kind={kind} token={token} />
        </div>
      </div>
    </PageShell>
  );
}
