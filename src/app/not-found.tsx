import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { LegalShell } from "@/components/app/LegalShell";

export const metadata: Metadata = {
  title: "Seite nicht gefunden | GRID Agency",
};

/** 404 im GRID-Look statt der englischen Standardseite. */
export default function NotFound() {
  return (
    <LegalShell title="404">
      <div className="flex min-h-[55dvh] flex-col justify-center">
        <p className="text-xs font-medium uppercase tracking-[0.25em] text-dune">
          404
        </p>
        <h1 className="mt-2 text-3xl font-medium tracking-tight text-snow">
          Diese Seite hat sich
          <br />
          <span className="text-scroll-gradient">weggescrollt</span>.
        </h1>
        <p className="mt-3 max-w-[26rem] text-sm font-light leading-relaxed text-snow/60">
          Den Link gibt es nicht (mehr). Auf der Startseite findest du alles,
          was du suchst.
        </p>
        <div className="mt-8 flex flex-wrap gap-2">
          <Link
            href="/"
            className="btn-rainbow inline-flex items-center gap-2 rounded-full bg-snow px-6 py-3 text-sm font-medium text-sky active:scale-[0.97]"
          >
            Zur Startseite
            <ArrowRight className="h-4 w-4" strokeWidth={2} />
          </Link>
          <Link
            href="/projekte"
            className="glass inline-flex items-center rounded-full px-6 py-3 text-sm font-medium text-snow active:scale-[0.97]"
          >
            Projekte ansehen
          </Link>
        </div>
      </div>
    </LegalShell>
  );
}
