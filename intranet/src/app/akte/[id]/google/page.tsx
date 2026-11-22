import type { Metadata } from "next";
import { AkteGoogle } from "@/components/akte/google";

export const metadata: Metadata = { title: "Google" };

export default function Page() {
  return <AkteGoogle />;
}
