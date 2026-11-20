import { Suspense } from "react";
import type { Metadata } from "next";
import { Pipeline } from "@/components/sales/pipeline";

export const metadata: Metadata = { title: "Pipeline" };

export default function PipelinePage() {
  // useSearchParams (?lead=) braucht beim Vorrendern eine Suspense-Grenze
  return (
    <Suspense>
      <Pipeline />
    </Suspense>
  );
}
