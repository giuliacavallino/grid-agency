import { PageHeader } from "@/components/ui/PageHeader";

/** Kopf und Satzspiegel der Rechtstexte (Impressum, Datenschutz, AGB). */
export function LegalArticle({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <article>
      <PageHeader eyebrow="Rechtliches" title={title} />
      <div className="rise glass mt-10 max-w-4xl rounded-[2rem] p-6 sm:p-8 lg:mt-14 lg:p-12" style={{ "--d": "120ms" } as React.CSSProperties}>
        <div className="space-y-8 text-sm font-light leading-relaxed text-snow/70 lg:text-[0.9375rem]">{children}</div>
      </div>
    </article>
  );
}

export function LegalHeading({ id, children }: { id?: string; children: React.ReactNode }) {
  return (
    <h2 id={id} className="mb-2 scroll-mt-28 text-lg font-semibold tracking-tight text-snow">
      {children}
    </h2>
  );
}
