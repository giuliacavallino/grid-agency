import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { PageShell } from "@/components/app/PageShell";
import { PageHeader } from "@/components/ui/PageHeader";

export const metadata: Metadata = {
  title: "Seite nicht gefunden | GRID Agency",
};

/** 404 im GRID-Look statt der englischen Standardseite. */
export default function NotFound() {
  return (
    <PageShell>
      <div className="flex min-h-[50dvh] flex-col justify-center">
        <PageHeader
          eyebrow="404"
          title={
            <>
              Diese Seite hat sich <span className="text-aurora">weggescrollt</span>.
            </>
          }
          text="Den Link gibt es nicht (mehr). Auf der Startseite findest du alles, was du suchst."
        >
          <div className="mt-8 flex flex-wrap gap-2">
            <Link href="/" className="btn btn-primary px-6 py-3.5 text-sm">
              Zur Startseite
              <ArrowRight className="h-4 w-4" strokeWidth={2} />
            </Link>
            <Link href="/projekte" className="btn btn-glass px-6 py-3.5 text-sm">
              Projekte ansehen
            </Link>
          </div>
        </PageHeader>
      </div>
    </PageShell>
  );
}
