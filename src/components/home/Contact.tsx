"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { CalendarDays, MessageSquareText } from "lucide-react";
import { ContactForm } from "@/components/ContactForm";
import { BookingWidget } from "@/components/app/BookingWidget";
import { CONTACT_TAB_EVENT, popContactTab, type ContactTab } from "@/lib/scroll";

const tabs: { id: ContactTab; label: string; icon: typeof CalendarDays }[] = [
  { id: "termin", label: "Termin buchen", icon: CalendarDays },
  { id: "nachricht", label: "Nachricht", icon: MessageSquareText },
];

/** „Slide in die DMs“: Erstgespräch direkt in Giulias Kalender buchen oder
 * eine Nachricht schreiben. Beides landet als Lead in Sales → Pipeline. */
export function Contact() {
  const [tab, setTab] = useState<ContactTab>("termin");

  useEffect(() => {
    const stashed = popContactTab();
    // eslint-disable-next-line react-hooks/set-state-in-effect -- einmalig aus sessionStorage übernehmen
    if (stashed) setTab(stashed);
    const onSelect = (e: Event) => setTab((e as CustomEvent<ContactTab>).detail);
    window.addEventListener(CONTACT_TAB_EVENT, onSelect);
    return () => window.removeEventListener(CONTACT_TAB_EVENT, onSelect);
  }, []);

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
            30 Minuten mit Giulia, kostenlos und ehrlich: Wo steht dein Feed, was bringt ihn nach vorn. Lieber schreiben? Wir
            melden uns innerhalb von zwei Werktagen.
          </p>
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
          <div role="tablist" aria-label="Kontaktweg" className="grid grid-cols-2 gap-1 rounded-full bg-sky/50 p-1">
            {tabs.map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                type="button"
                role="tab"
                aria-selected={tab === id}
                aria-controls={`kontakt-${id}`}
                onClick={() => setTab(id)}
                className={`flex items-center justify-center gap-2 rounded-full py-2.5 text-sm font-medium transition-all ${
                  tab === id ? "bg-snow text-sky shadow-lg" : "text-snow/70 hover:text-snow"
                }`}
              >
                <Icon className="h-4 w-4" strokeWidth={2} />
                {label}
              </button>
            ))}
          </div>

          <div className="mt-6">
            {/* Beide bleiben gemountet, damit Eingaben beim Wechseln nicht verloren gehen */}
            <div id="kontakt-termin" role="tabpanel" hidden={tab !== "termin"}>
              <BookingWidget onUnavailable={() => setTab("nachricht")} />
            </div>
            <div id="kontakt-nachricht" role="tabpanel" hidden={tab !== "nachricht"}>
              <ContactForm />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
