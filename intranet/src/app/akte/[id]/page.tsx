import type { Metadata } from "next";
import { AkteHome } from "@/components/akte/pages";

export const metadata: Metadata = { title: "Cockpit" };

export default function Page() {
  return <AkteHome />;
}
