import type { Metadata } from "next";
import { PortalAccess } from "@/components/akte/portal-access";

export const metadata: Metadata = { title: "Kundenzugang" };

export default function Page() {
  return <PortalAccess />;
}
