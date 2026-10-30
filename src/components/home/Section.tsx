/** Rahmen und Kopf einer Startseiten-Sektion: Kicker-Pille, Überschrift,
 * optional Unterzeile und Aktion rechts. */
export function Section({
  id,
  className = "",
  children,
}: {
  id?: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <section id={id} className={`relative py-20 lg:py-32 ${className}`}>
      <div className="mx-auto w-full max-w-frame px-5 lg:max-w-frame-wide lg:px-gutter">{children}</div>
    </section>
  );
}

export function SectionHead({
  eyebrow,
  title,
  text,
  action,
  center = false,
}: {
  eyebrow: string;
  title: React.ReactNode;
  text?: React.ReactNode;
  action?: React.ReactNode;
  center?: boolean;
}) {
  return (
    <div className={`reveal flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between ${center ? "items-center text-center lg:flex-col lg:items-center" : ""}`}>
      <div className={center ? "flex flex-col items-center" : ""}>
        <span className="eyebrow">{eyebrow}</span>
        <h2 className="mt-4 max-w-[20ch] text-[2.25rem] font-semibold leading-[1.02] tracking-[-0.03em] text-snow lg:text-[clamp(3rem,4.6vw,4.5rem)]">
          {title}
        </h2>
        {text && <p className="mt-4 max-w-xl text-base font-light leading-relaxed text-snow/65 lg:text-lg">{text}</p>}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}
