import type { Metadata } from "next";
import { Booking } from "@/components/personal/booking";

export const metadata: Metadata = {
  title: { absolute: "Termin wählen · GRID AGENCY" },
  robots: { index: false, follow: false },
  referrer: "no-referrer",
};

/** Öffentliche Terminwahl für eingeladene Bewerber*innen (sign.grid-agency.de/t/…) */
export default async function TerminPage({ params }: PageProps<"/t/[token]">) {
  const { token } = await params;
  return <Booking token={token} />;
}
