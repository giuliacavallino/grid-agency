/** Kopf jeder Unterseite: Kicker-Pille, große Überschrift, Unterzeile. */
export function PageHeader({
  eyebrow,
  title,
  text,
  children,
}: {
  eyebrow: string;
  title: React.ReactNode;
  text?: React.ReactNode;
  children?: React.ReactNode;
}) {
  return (
    <header className="rise relative max-w-4xl">
      <span className="eyebrow">{eyebrow}</span>
      <h1 className="mt-5 text-[2.5rem] font-semibold leading-[1] tracking-[-0.035em] text-snow lg:text-[clamp(3.5rem,6vw,6rem)]">{title}</h1>
      {text && <p className="mt-5 max-w-2xl text-base font-light leading-relaxed text-snow/65 lg:text-lg">{text}</p>}
      {children}
    </header>
  );
}
