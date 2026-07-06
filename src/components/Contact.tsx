"use client";

import { motion } from "framer-motion";
import { ContactForm } from "./ContactForm";

const offices = [
  {
    city: "Berlin",
    address: "Linienstrasse 214, 10119 Berlin",
  },
  {
    city: "Frankfurt",
    address: "Eichendorffstrasse 32, 60320 Frankfurt am Main",
  },
];

export function Contact() {
  return (
    <section id="kontakt" className="py-24">
      <div className="mx-auto grid max-w-6xl gap-16 px-6 lg:grid-cols-2">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-80px" }}
          transition={{ duration: 0.6 }}
        >
          <p className="text-sm font-medium uppercase tracking-[0.2em] text-dune">
            Kontakt
          </p>
          <h2 className="mt-4 text-4xl font-medium tracking-tight text-snow md:text-5xl">
            Lass uns dein Social Media auf Autopilot bringen.
          </h2>
          <p className="mt-6 max-w-md text-sm font-light leading-relaxed text-snow/60">
            Schreib uns kurz, worum es geht — wir melden uns innerhalb von
            zwei Werktagen mit einem unverbindlichen Erstgespräch.
          </p>

          <div className="mt-12 grid gap-8 sm:grid-cols-2">
            {offices.map((office) => (
              <div key={office.city}>
                <p className="text-sm font-medium text-snow">{office.city}</p>
                <p className="mt-1 text-sm font-light text-snow/60">
                  {office.address}
                </p>
              </div>
            ))}
          </div>

          <div className="mt-8 space-y-1 text-sm font-light text-snow/60">
            <p>hello@grid-agency.de</p>
            <p>+49 1512 2910161</p>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-80px" }}
          transition={{ duration: 0.6, delay: 0.1 }}
          className="rounded-2xl border border-snow/10 bg-earth/10 p-8"
        >
          <ContactForm />
        </motion.div>
      </div>
    </section>
  );
}
