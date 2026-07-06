"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { animate, motion, useInView } from "framer-motion";
import { BadgeCheck, MapPin } from "lucide-react";
import { profileStats } from "@/lib/content";

function CountUp({ value, suffix }: { value: number; suffix: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true, margin: "-40px" });
  const [display, setDisplay] = useState(0);

  useEffect(() => {
    if (!inView) return;
    const controls = animate(0, value, {
      duration: 1.4,
      ease: [0.16, 1, 0.3, 1],
      onUpdate: (v) => setDisplay(Math.round(v)),
    });
    return () => controls.stop();
  }, [inView, value]);

  return (
    <span ref={ref}>
      {display.toLocaleString("de-DE")}
      {suffix}
    </span>
  );
}

export function ProfileHeader() {
  const [following, setFollowing] = useState(false);

  return (
    <div className="px-4 pt-6">
      <div className="flex items-center gap-6">
        <motion.div
          initial={{ scale: 0.6, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: "spring", stiffness: 200, damping: 18 }}
          className="relative h-24 w-24 shrink-0"
        >
          <div className="story-ring absolute inset-0 animate-[spin_6s_linear_infinite] rounded-full" />
          <div className="absolute inset-[3px] flex items-center justify-center rounded-full bg-sky">
            <Image
              src="/brand/grid_monogram_snow.png"
              alt="GRID Monogramm"
              width={52}
              height={29}
            />
          </div>
        </motion.div>

        <div className="flex flex-1 justify-around">
          {profileStats.map((stat) => (
            <div key={stat.label} className="text-center">
              <p className="text-lg font-medium text-snow">
                <CountUp value={stat.value} suffix={stat.suffix} />
              </p>
              <p className="text-[11px] font-light text-snow/55">
                {stat.label}
              </p>
            </div>
          ))}
        </div>
      </div>

      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.15, duration: 0.5 }}
        className="mt-4 space-y-1"
      >
        <p className="flex items-center gap-1.5 text-sm font-medium text-snow">
          GRID Agency
          <BadgeCheck className="h-4 w-4 text-dune" strokeWidth={2} />
        </p>
        <p className="text-sm font-light text-snow/70">
          DIE Social Media Agentur. Zwei Schritte voraus.
          <br />
          Willkommen in 2030. 🛰️
        </p>
        <p className="flex items-center gap-1 text-sm font-light text-dune">
          <MapPin className="h-3.5 w-3.5" strokeWidth={2} />
          Berlin &amp; Frankfurt · grid-agency.de
        </p>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.25, duration: 0.5 }}
        className="mt-4 flex gap-2"
      >
        <button
          onClick={() => setFollowing(!following)}
          className={`flex-1 rounded-full py-2 text-sm font-medium transition-all active:scale-[0.97] ${
            following ? "glass text-snow" : "bg-snow text-sky"
          }`}
        >
          {following ? "Gefolgt ✓" : "Folgen"}
        </button>
        <a
          href="#dm"
          className="glass flex-1 rounded-full py-2 text-center text-sm font-medium text-snow transition-all active:scale-[0.97]"
        >
          Nachricht
        </a>
      </motion.div>
    </div>
  );
}
