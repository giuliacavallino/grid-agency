import type { Metadata } from "next";
import { Connections } from "@/components/akte/settings";

export const metadata: Metadata = { title: "Anbindungen" };

export default function Page() {
  return <Connections />;
}
