import Link from "next/link";
import { roadmap } from "@/lib/content";
import { ContactLink } from "@/components/ui/ContactLink";
import { Section, SectionHead } from "./Section";

/** So läuft die Zusammenarbeit: fünf Schritte als Zeitleiste. */
export function Roadmap() {
  return (
    <Section id="roadmap">
      <SectionHead
        eyebrow="So läuft's"
        title={
          <>
            Vom ersten Call zum <span className="text-aurora">Autopilot</span>.
          </>
        }
        text="Kein Agentur-Pingpong. Fünf klare Schritte, und ab Monat drei wird es richtig spürbar."
      />

      <ol className="relative mt-12 grid gap-4 lg:mt-16 lg:grid-cols-5">
        <span aria-hidden className="absolute left-[1.6rem] top-4 bottom-4 w-px bg-gradient-to-b from-sun via-pop to-grape opacity-50 lg:left-4 lg:right-4 lg:top-[1.6rem] lg:bottom-auto lg:h-px lg:w-auto lg:bg-gradient-to-r" />
        {roadmap.map((step, i) => (
          <li key={step.number} className="reveal relative flex gap-5 lg:flex-col lg:gap-0" style={{ "--d": `${i * 90}ms` } as React.CSSProperties}>
            <span className="glass relative z-10 flex h-[3.2rem] w-[3.2rem] shrink-0 items-center justify-center rounded-full text-sm font-semibold tabular-nums text-snow">
              {step.number}
            </span>
            <div className="glass flex-1 rounded-[1.5rem] p-5 lg:mt-5">
              <h3 className="text-lg font-semibold tracking-tight text-snow">{step.title}</h3>
              <p className="mt-2 text-sm font-light leading-relaxed text-snow/65">{step.text}</p>
            </div>
          </li>
        ))}
      </ol>

      <div className="reveal mt-10 flex flex-col items-center gap-3 text-center sm:flex-row sm:justify-center">
        <ContactLink tab="termin" className="btn btn-primary px-6 py-3.5 text-sm">
          Schritt 01: Termin sichern
        </ContactLink>
        <Link href="/faq" className="btn btn-glass px-6 py-3.5 text-sm">
          Noch Fragen? Zum FAQ
        </Link>
      </div>
    </Section>
  );
}
