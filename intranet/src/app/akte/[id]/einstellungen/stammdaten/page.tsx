import type { Metadata } from "next";
import { MasterData } from "@/components/akte/settings";

export const metadata: Metadata = { title: "Stammdaten" };

export default function Page() {
  return <MasterData />;
}
