import type { Metadata } from "next";
import { RequireAuth } from "@/components/login";

export const metadata: Metadata = { title: "Neue E-Mail" };

/** Eigenes Fenster zum Verfassen, ohne Seitenleiste */
export default function ComposeLayout({ children }: { children: React.ReactNode }) {
  return <RequireAuth area="mail">{children}</RequireAuth>;
}
