import type { Metadata } from "next";
import { Signing } from "@/components/sign/signing";

export const metadata: Metadata = {
  title: { absolute: "Unterlagen unterschreiben · GRID AGENCY" },
  robots: { index: false, follow: false },
  referrer: "no-referrer",
};

/** Öffentliche Unterschriftsseite (sign.grid-agency.de/s/…) */
export default async function SignPage({ params }: PageProps<"/s/[token]">) {
  const { token } = await params;
  return <Signing token={token} />;
}
