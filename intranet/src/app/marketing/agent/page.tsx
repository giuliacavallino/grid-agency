import type { Metadata } from "next";
import { AgentApi } from "@/components/marketing/agent";

export const metadata: Metadata = { title: "Agent & API" };

export default function Page() {
  return <AgentApi />;
}
