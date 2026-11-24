import { llmsTxt } from "@/lib/seo";

// Wird beim Build aus content.ts erzeugt, ändert sich mit jedem Deploy.
export const dynamic = "force-static";

export function GET() {
  return new Response(llmsTxt(true), { headers: { "Content-Type": "text/plain; charset=utf-8" } });
}
