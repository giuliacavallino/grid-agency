import type { Metadata } from "next";
import { Pipeline } from "@/components/sales/pipeline";

export const metadata: Metadata = { title: "Pipeline" };

export default function PipelinePage() {
  return <Pipeline />;
}
