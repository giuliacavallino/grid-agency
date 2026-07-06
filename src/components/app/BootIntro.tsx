"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";

const DRAW = { duration: 1.4, ease: [0.16, 1, 0.3, 1] as const };

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
    const total = reduce ? 900 : 3200;
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
          transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
          className="fixed inset-0 z-[60] mx-auto flex max-w-[560px] cursor-pointer flex-col items-center justify-center bg-sky"
          aria-label="Intro — tippen zum Überspringen"
        >
          <div className="grid-pattern-bg pointer-events-none absolute inset-0 opacity-10" />

          <motion.svg
            width="132"
            height="132"
            viewBox="0 0 100 100"
            fill="none"
            className="relative z-10"
          >
            {/* Two interlocking rings approximating the GO monogram, drawing themselves */}
            <motion.circle
              cx="38"
              cy="50"
              r="26"
              stroke="var(--color-snow)"
              strokeWidth="4"
              strokeLinecap="round"
              initial={{ pathLength: 0, opacity: 0.2 }}
              animate={{ pathLength: 1, opacity: 1 }}
              transition={DRAW}
            />
            <motion.circle
              cx="62"
              cy="50"
              r="26"
              stroke="var(--color-dune)"
              strokeWidth="4"
              strokeLinecap="round"
              initial={{ pathLength: 0, opacity: 0.2 }}
              animate={{ pathLength: 1, opacity: 1 }}
              transition={{ ...DRAW, delay: 0.25 }}
            />
          </motion.svg>

          <motion.div
            initial={{ opacity: 0, y: 12, letterSpacing: "0.05em" }}
            animate={{ opacity: 1, y: 0, letterSpacing: "0.35em" }}
            transition={{ delay: 1.5, duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
            className="relative z-10 mt-6 text-lg font-medium text-snow"
          >
            GRID
          </motion.div>

          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 2.1, duration: 0.6 }}
            className="relative z-10 mt-2 text-[11px] font-light uppercase tracking-[0.3em] text-snow/45"
          >
            Willkommen in 2030
          </motion.p>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
