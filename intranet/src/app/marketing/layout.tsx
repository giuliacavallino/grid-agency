import type { Metadata } from "next";
import { RequireAuth } from "@/components/login";

export const metadata: Metadata = { title: "Marketing" };

/** Marketing ist jetzt die Kundenakte von GRID; alte Adressen leiten weiter */
export default function MarketingLayout({ children }: { children: React.ReactNode }) {
  return <RequireAuth area="marketing">{children}</RequireAuth>;
}
