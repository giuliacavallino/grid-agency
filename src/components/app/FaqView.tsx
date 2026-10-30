import Link from "next/link";
import { ArrowRight, ChevronDown } from "lucide-react";
import { faq } from "@/lib/content";
import { ContactLink } from "@/components/ui/ContactLink";
import { PageHeader } from "@/components/ui/PageHeader";

/** FAQ als Akkordeon aus nativen <details>, die erste Frage ist offen. */
export function FaqView() {
  return (
    <div className="lg:grid lg:grid-cols-[minmax(0,4fr)_minmax(0,7fr)] lg:gap-16">
      <div className="lg:sticky lg:top-36 lg:self-start">
        <PageHeader
          eyebrow="FAQ"
          title={
            <>
              Häufige <span className="text-aurora">Fragen</span>.
            </>
          }
          text="Was du vor einer Zusammenarbeit mit GRID wissen willst: vom ersten Beitrag über Plattformen und Formate bis zur Frage, wann sich Social Media rechnet."
        />
        <div className="rise glass mt-8 hidden rounded-[1.75rem] p-6 lg:block" style={{ "--d": "200ms" } as React.CSSProperties}>
          <p className="text-base font-semibold text-snow">Deine Frage ist nicht dabei?</p>
          <p className="mt-1 text-sm font-light text-snow/65">Dann klären wir sie im Erstgespräch, kostenlos und in 30 Minuten.</p>
          <ContactLink tab="termin" className="btn btn-primary mt-5 px-6 py-3 text-sm">
            Erstgespräch buchen
          </ContactLink>
        </div>
      </div>

      <div className="mt-10 space-y-3 lg:mt-0">
        {faq.map((item, i) => (
          <details
            key={item.slug}
            id={item.slug}
            open={i === 0}
            className="reveal card-rainbow glass group overflow-hidden rounded-[1.5rem]"
            style={{ "--d": `${Math.min(i, 6) * 50}ms` } as React.CSSProperties}
          >
            <summary className="flex items-start justify-between gap-4 p-5 sm:p-6">
              <h2 className="card-rainbow-title text-lg font-semibold tracking-tight text-snow">{item.question}</h2>
              <span className="glass flex h-8 w-8 shrink-0 items-center justify-center rounded-full">
                <ChevronDown className="details-chevron h-4 w-4 text-snow transition-transform duration-300" strokeWidth={2} />
              </span>
            </summary>
            <div className="details-body border-t border-snow/10 px-5 pb-6 pt-5 sm:px-6">
              {item.intro && <p className="max-w-3xl text-sm font-light leading-relaxed text-snow/75">{item.intro}</p>}
              {item.points && (
                <ul className="mt-4 space-y-2.5">
                  {item.points.map((point) => (
                    <li key={point.title} className="flex gap-2.5 text-sm font-light leading-relaxed text-snow/70">
                      <span className="mt-[0.55em] h-1.5 w-1.5 shrink-0 rounded-full bg-pop" />
                      <span>
                        <span className="font-medium text-snow">{point.title}:</span> {point.text}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
              {item.outro && <p className="mt-4 max-w-3xl text-sm font-light leading-relaxed text-snow/75">{item.outro}</p>}
              {item.link && (
                <Link href={item.link.href} className="mt-4 inline-flex items-center gap-1.5 text-sm font-medium text-snow underline-offset-4 hover:underline">
                  {item.link.label}
                  <ArrowRight className="h-4 w-4" strokeWidth={2} />
                </Link>
              )}
            </div>
          </details>
        ))}

        <div className="reveal glass mt-6 rounded-[1.75rem] p-6 text-center lg:hidden">
          <p className="text-base font-semibold text-snow">Deine Frage ist nicht dabei?</p>
          <p className="mt-1 text-sm font-light text-snow/65">Dann klären wir sie im Erstgespräch, kostenlos und in 30 Minuten.</p>
          <ContactLink tab="termin" className="btn btn-primary mt-5 px-6 py-3 text-sm">
            Erstgespräch buchen
          </ContactLink>
        </div>
      </div>
    </div>
  );
}
