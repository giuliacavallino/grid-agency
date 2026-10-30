import type { Metadata } from "next";
import { MeetLanding } from "@/components/meet/landing";

export const metadata: Metadata = {
  title: { absolute: "GRID Meet · Video-Calls von GRID AGENCY" },
  robots: { index: false, follow: false },
};

/** Startseite von meet.grid-agency.de */
export default function MeetHome() {
  return <MeetLanding />;
}
