import type { Metadata } from "next";
import { Portal } from "@/components/portal/portal";

export const metadata: Metadata = {
  title: { absolute: "Kundenportal · GRID AGENCY" },
  robots: { index: false, follow: false },
  referrer: "no-referrer",
};

/** Kundenportal (öffentlich, eigene Anmeldung per Link) */
export default function PortalPage() {
  return <Portal />;
}
