"use client";

import Image from "next/image";
import { motion } from "framer-motion";
import { BadgeCheck } from "lucide-react";
import { team } from "@/lib/content";
import { scrollToId } from "@/lib/scroll";

export function TeamSection() {
  return (
    <div className="px-5 py-12">
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: "-60px" }}
        transition={{ duration: 0.5 }}
      >
        <p className="text-xs font-medium uppercase tracking-[0.2em] text-dune">
          Team
        </p>
        <h2 className="mt-2 text-3xl font-medium tracking-tight text-snow">
          Die Person hinter
          <br />
          deinem <span className="text-scroll-gradient">Wachstum</span>.
        </h2>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 24 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: "-60px" }}
        transition={{ duration: 0.6, delay: 0.1, ease: [0.16, 1, 0.3, 1] }}
        className="glass mt-8 overflow-hidden rounded-3xl p-6"
      >
        <div className="flex items-center gap-5">
          <div className="relative h-24 w-24 shrink-0">
            <div className="story-ring absolute inset-0 animate-[spin_6s_linear_infinite] rounded-full" />
            <div className="absolute inset-[3px] overflow-hidden rounded-full bg-sky">
              <Image
                src="/team/giulia-avatar.jpg"
                alt={team.name}
                fill
                sizes="96px"
                className="object-cover"
              />
            </div>
          </div>
          <div>
            <p className="flex items-center gap-1.5 text-lg font-medium text-snow">
              {team.name}
              <BadgeCheck className="h-4.5 w-4.5 text-dune" strokeWidth={2} />
            </p>
            <p className="text-sm font-light text-dune">{team.role}</p>
          </div>
        </div>

        <p className="mt-5 text-sm font-light leading-relaxed text-snow/75">
          {team.bio}
        </p>

        <div className="mt-6 flex justify-between border-t border-snow/10 pt-5">
          {team.facts.map((fact) => (
            <div key={fact.label} className="text-center">
              <p className="text-lg font-medium text-snow">{fact.value}</p>
              <p className="mt-0.5 text-[11px] font-light text-snow/50">
                {fact.label}
              </p>
            </div>
          ))}
        </div>
      </motion.div>

      <motion.p
        initial={{ opacity: 0 }}
        whileInView={{ opacity: 1 }}
        viewport={{ once: true, margin: "-60px" }}
        transition={{ duration: 0.5, delay: 0.25 }}
        className="mt-6 text-center text-sm font-light text-snow/50"
      >
        Das Team wächst.{" "}
        <a
          href="#dm"
          onClick={(e) => {
            e.preventDefault();
            scrollToId("dm");
          }}
          className="font-medium text-dune underline-offset-4 hover:underline"
        >
          Bewirb dich per DM →
        </a>
      </motion.p>
    </div>
  );
}
