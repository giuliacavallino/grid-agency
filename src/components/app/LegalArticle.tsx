/** Kopf und Satzspiegel der Rechtstexte (Impressum, Datenschutz, AGB). */
export function LegalArticle({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <article className="max-w-3xl">
      <p className="text-xs font-medium uppercase tracking-[0.25em] text-dune">
        Rechtliches
      </p>
      <h1 className="mb-8 mt-2 text-3xl font-medium tracking-tight text-snow lg:text-4xl">
        {title}
      </h1>
      <div className="space-y-8 text-sm font-light leading-relaxed text-snow/70 lg:text-[0.9375rem]">
        {children}
      </div>
    </article>
  );
}

export function LegalHeading({
  id,
  children,
}: {
  id?: string;
  children: React.ReactNode;
}) {
  return (
    <h2 id={id} className="mb-2 scroll-mt-24 text-base font-medium text-snow lg:scroll-mt-32">
      {children}
    </h2>
  );
}
