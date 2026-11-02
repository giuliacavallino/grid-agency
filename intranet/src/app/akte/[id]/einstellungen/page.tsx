import type { Metadata } from "next";
import { Channels } from "@/components/marketing/channels";

export const metadata: Metadata = { title: "Kanäle" };

export default function Page() {
  return <Channels />;
}
