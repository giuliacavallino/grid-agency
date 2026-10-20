"use client";

import { useState } from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowRight, ChevronDown } from "lucide-react";
import { faq } from "@/lib/content";
import { CalendlyLink } from "./CalendlyProvider";

/** FAQ als Akkordeon: eine Frage pro Karte, die erste ist offen. Antworten
 * bestehen aus Fließtext, optionalen Stichpunkten und einem optionalen
 * weiterführenden Link. */
export function FaqView() {
  const [open, setOpen] = useState<string | null>(faq[0]?.slug ?? null);

  return (
    <div>
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        <p className="text-xs font-medium uppercase tracking-[0.25em] text-dune">
          FAQ
        </p>
        <h1 className="mt-2 text-3xl font-medium tracking-tight text-snow">
          Häufige <span className="text-scroll-gradient">Fragen</span>.
        </h1>
        <p className="mt-4 max-w-2xl text-sm font-light leading-relaxed text-snow/65">
          Was du vor einer Zusammenarbeit mit GRID wissen willst: vom ersten
          Beitrag über Plattformen und Content-Formate bis zur Frage, wann
          sich Social Media rechnet.
        </p>
      </motion.div>

      <div className="mt-8 space-y-3">
        {faq.map((item, i) => {
          const isOpen = open === item.slug;
          return (
            <motion.div
              key={item.slug}
              initial={{ opacity: 0, y: 18 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.45, delay: i * 0.05 }}
              className="card-rainbow overflow-hidden rounded-2xl border border-snow/10"
            >
              <button
                type="button"
                onClick={() => setOpen(isOpen ? null : item.slug)}
                aria-expanded={isOpen}
                className="flex w-full items-start justify-between gap-4 p-5 text-left sm:p-6"
              >
                <h2 className="card-rainbow-title text-lg font-medium tracking-tight text-snow">
                  {item.question}
                </h2>
                <ChevronDown
                  className={`mt-1 h-5 w-5 shrink-0 text-snow/50 transition-transform duration-300 ${
                    isOpen ? "rotate-180" : ""
                  }`}
                  strokeWidth={2}
                />
              </button>

              <AnimatePresence initial={false}>
                {isOpen && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
                    className="overflow-hidden"
                  >
                    <div className="border-t border-snow/10 px-5 pb-6 pt-5 sm:px-6">
                      {item.intro && (
                        <p className="max-w-3xl text-sm font-light leading-relaxed text-snow/75">
                          {item.intro}
                        </p>
                      )}
                      {item.points && (
                        <ul className="mt-4 space-y-2.5">
                          {item.points.map((point) => (
                            <li
                              key={point.title}
                              className="flex gap-2.5 text-sm font-light leading-relaxed text-snow/70"
                            >
                              <span className="mt-[0.55em] h-1.5 w-1.5 shrink-0 rounded-full bg-dune" />
                              <span>
                                <span className="font-medium text-snow">
                                  {point.title}:
                                </span>{" "}
                                {point.text}
                              </span>
                            </li>
                          ))}
                        </ul>
                      )}
                      {item.outro && (
                        <p className="mt-4 max-w-3xl text-sm font-light leading-relaxed text-snow/75">
                          {item.outro}
                        </p>
                      )}
                      {item.link && (
                        <Link
                          href={item.link.href}
                          className="mt-4 inline-flex items-center gap-1.5 text-sm font-medium text-dune underline-offset-4 hover:underline"
                        >
                          {item.link.label}
                          <ArrowRight className="h-4 w-4" strokeWidth={2} />
                        </Link>
                      )}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          );
        })}
      </div>

      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.5, delay: 0.5 }}
        className="mt-10 rounded-2xl bg-snow/[0.05] p-6 text-center"
      >
        <p className="text-base font-medium text-snow">
          Deine Frage ist nicht dabei?
        </p>
        <p className="mt-1 text-sm font-light text-snow/65">
          Dann klären wir sie im Erstgespräch, unverbindlich und in 30 Minuten.
        </p>
        <CalendlyLink className="btn-rainbow mt-4 inline-flex items-center gap-2 rounded-full bg-snow px-6 py-3 text-sm font-medium text-sky active:scale-[0.97]">
          Jetzt Erstgespräch buchen
        </CalendlyLink>
      </motion.div>
    </div>
  );
}
