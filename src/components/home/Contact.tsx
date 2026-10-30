import Image from "next/image";
import { ArrowRight, BadgeCheck, Clock, Video } from "lucide-react";
import { ContactForm } from "@/components/ContactForm";
import { ContactLink } from "@/components/ui/ContactLink";

/** „Slide in die DMs“: links das Erstgespräch (öffnet das Buchungs-Popup),
 * rechts die Nachricht. Beides landet als Lead in Sales → Pipeline. */
export function Contact() {
  return (
    <section id="dm" className="relative py-20 lg:py-32">
      <div aria-hidden className="aurora absolute inset-0 opacity-70" />
      <div className="relative mx-auto grid w-full max-w-frame grid-cols-1 gap-10 px-5 lg:max-w-frame-wide lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:gap-16 lg:px-gutter">
        <div className="reveal lg:pt-6">
          <span className="eyebrow">Kontakt</span>
          <h2 className="mt-4 text-[2.5rem] font-semibold leading-[1] tracking-[-0.035em] text-snow lg:text-[clamp(3.5rem,5.5vw,5.5rem)]">
            Slide in die <span className="text-aurora">DMs</span>.
          </h2>
          <p className="mt-5 max-w-md text-base font-light leading-relaxed text-snow/70 lg:text-lg">
            30 Minuten mit Giulia, kostenlos und ehrlich: Wo steht dein Feed, was bringt ihn nach vorn. Direkt im Kalender
            buchen, Einladung mit Link zum Video-Call inklusive.
          </p>
          <ul className="mt-6 space-y-2.5 text-sm font-light text-snow/80">
            <li className="flex items-center gap-3">
              <Clock className="h-4 w-4 text-snow/60" strokeWidth={1.8} />
              30 Minuten
            </li>
            <li className="flex items-center gap-3">
              <Video className="h-4 w-4 text-snow/60" strokeWidth={1.8} />
              Online per Video-Call
            </li>
            <li className="flex items-center gap-3">
              <BadgeCheck className="h-4 w-4 text-snow/60" strokeWidth={1.8} />
              Kostenlos und unverbindlich
            </li>
          </ul>
          <ContactLink tab="termin" className="btn btn-primary mt-8 py-2 pl-6 pr-2 text-[0.9375rem]">
            Erstgespräch buchen
            <span className="flex h-9 w-9 items-center justify-center rounded-full bg-sky text-snow">
              <ArrowRight className="h-4 w-4" strokeWidth={2.4} />
            </span>
          </ContactLink>
          <div className="mt-8 flex items-center gap-3">
            <span className="story-ring flex h-12 w-12 shrink-0 rounded-full p-[2px]">
              <Image src="/team/giulia-avatar.jpg" alt="" width={44} height={44} className="h-full w-full rounded-full border-2 border-sky object-cover" />
            </span>
            <div>
              <p className="text-sm font-medium text-snow">Giulia Cavallino</p>
              <p className="flex items-center gap-1.5 text-xs font-light text-snow/60">
                <span className="relative flex h-2 w-2">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#4ade80] opacity-60" />
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-[#4ade80]" />
                </span>
                Antwortet meist am selben Tag
              </p>
            </div>
          </div>
        </div>

        <div className="reveal glass rounded-[2rem] p-5 sm:p-7 lg:p-9" style={{ "--d": "100ms" } as React.CSSProperties}>
          <p className="text-xl font-semibold tracking-tight text-snow">Lieber schreiben?</p>
          <p className="mt-1 text-sm font-light text-snow/60">Wir melden uns innerhalb von zwei Werktagen.</p>
          <div className="mt-6">
            <ContactForm />
          </div>
        </div>
      </div>
    </section>
  );
}
