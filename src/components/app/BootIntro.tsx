"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";

const EASE = [0.16, 1, 0.3, 1] as const;

export function BootIntro() {
  const [dismissed, setDismissed] = useState(false);
  const [mounted, setMounted] = useState(false);
  const reduce = useReducedMotion();

  // Only decide on the client — sessionStorage is unavailable during SSR.
  const alreadySeen =
    typeof window !== "undefined" &&
    sessionStorage.getItem("grid-boot") === "1";
  const show = mounted && !dismissed && !alreadySeen;

  function dismiss() {
    sessionStorage.setItem("grid-boot", "1");
    setDismissed(true);
  }

  useEffect(() => {
    // Mount gate keeps SSR and first client render identical (no hydration
    // mismatch); the intro is intentionally client-only.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!show) return;
    const total = reduce ? 900 : 3400;
    const timer = window.setTimeout(dismiss, total);
    return () => window.clearTimeout(timer);
  }, [show, reduce]);

  return (
    <AnimatePresence>
      {show && (
        <motion.div
          key="boot"
          onClick={dismiss}
          initial={{ opacity: 1 }}
          exit={{ opacity: 0, scale: 1.06 }}
          transition={{ duration: 0.6, ease: EASE }}
          className="fixed inset-0 z-[60] flex cursor-pointer flex-col items-center justify-center bg-sky"
          aria-label="Intro — tippen zum Überspringen"
        >
          {/* Snow pattern on Sky, breathing in softly behind the mark. */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 0.13 }}
            transition={{ duration: 1.6, ease: "easeOut" }}
            className="grid-pattern-bg pointer-events-none absolute inset-0"
          />

          {/* Aurora glow in den Kundenfarben, wie im Hero. */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 2, ease: "easeOut" }}
            className="aurora pointer-events-none absolute inset-0"
          />

          {/* The real GO monogram, wiping in left to right as if drawn;
              danach läuft der Aurora-Verlauf durch die Ringe. */}
          <motion.div
            initial={{
              clipPath: "inset(0 100% 0 0)",
              opacity: 0.4,
              scale: 0.94,
            }}
            animate={{ clipPath: "inset(0 0% 0 0)", opacity: 1, scale: 1 }}
            transition={{ duration: 1.5, ease: EASE }}
            className="relative z-10"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/brand/grid_monogram_snow.png"
              alt=""
              className="w-44 lg:w-60"
            />
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 1.5, duration: 0.8 }}
              className="absolute inset-0 animate-[rainbow-slide_2.4s_linear_infinite] bg-[linear-gradient(92deg,#ffd400,#f7b790,#e02e38,#4d9fff,#ffd400)] bg-[length:200%_100%] [-webkit-mask:url('/brand/grid_monogram_snow.png')_center/contain_no-repeat] [mask:url('/brand/grid_monogram_snow.png')_center/contain_no-repeat]"
            />
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 12, letterSpacing: "0.05em" }}
            animate={{ opacity: 1, y: 0, letterSpacing: "0.35em" }}
            transition={{ delay: 1.4, duration: 0.7, ease: EASE }}
            className="relative z-10 mt-8 text-lg font-medium text-snow lg:text-xl"
          >
            GRID
          </motion.div>

          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 2.0, duration: 0.6 }}
            className="relative z-10 mt-3 max-w-[20rem] px-6 text-center text-[11px] font-light uppercase leading-relaxed tracking-[0.3em] text-snow/45 lg:max-w-none"
          >
            Willkommen bei deiner Lieblings Social Media Agentur
          </motion.p>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
