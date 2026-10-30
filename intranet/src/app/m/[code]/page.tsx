import type { Metadata } from "next";
import { MeetRoom } from "@/components/meet/room";

export const metadata: Metadata = {
  title: { absolute: "Video-Call · GRID AGENCY" },
  robots: { index: false, follow: false },
  referrer: "no-referrer",
};

/** Öffentlicher Video-Call (meet.grid-agency.de/…), Zugang über den Link */
export default async function MeetPage({ params }: PageProps<"/m/[code]">) {
  const { code } = await params;
  return <MeetRoom code={code} />;
}
