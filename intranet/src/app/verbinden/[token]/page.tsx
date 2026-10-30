import type { Metadata } from "next";
import { ConnectLink } from "@/components/marketing/connect-link";

export const metadata: Metadata = {
  title: { absolute: "Kanäle verbinden · GRID AGENCY" },
  robots: { index: false, follow: false },
  referrer: "no-referrer",
};

/** Öffentliche Seite für Kunden: Social-Media-Kanäle mit GRID verbinden */
export default async function ConnectPage({ params }: PageProps<"/verbinden/[token]">) {
  const { token } = await params;
  return <ConnectLink token={token} />;
}
