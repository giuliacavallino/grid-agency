"use client";

import { Home, LayoutGrid, Clapperboard, MessageCircle } from "lucide-react";
import { motion } from "framer-motion";
import type { ViewId } from "./AppShell";

const tabs: { id: ViewId; label: string; icon: typeof Home }[] = [
  { id: "profil", label: "Profil", icon: Home },
  { id: "feed", label: "Feed", icon: LayoutGrid },
  { id: "reels", label: "Reels", icon: Clapperboard },
  { id: "dm", label: "DM", icon: MessageCircle },
];

const LENS_SPRING = { type: "spring" as const, stiffness: 380, damping: 32 };

function haptic() {
  if (typeof navigator !== "undefined" && "vibrate" in navigator) {
    navigator.vibrate(8);
  }
}

export function TabBar({ active }: { active: ViewId }) {
  return (
    <motion.nav
      initial={{ y: 96, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.6, delay: 0.15, ease: [0.16, 1, 0.3, 1] }}
      className="pointer-events-none fixed bottom-0 z-40 w-full max-w-[560px] px-5 pb-[calc(env(safe-area-inset-bottom)+16px)]"
      aria-label="Hauptnavigation"
    >
      <div className="glass pointer-events-auto relative mx-auto flex h-[68px] max-w-[400px] items-stretch justify-around overflow-hidden rounded-full px-2">
        {/* specular top highlight */}
        <span className="pointer-events-none absolute inset-x-6 top-0 h-px bg-gradient-to-r from-transparent via-snow/40 to-transparent" />

        {tabs.map((tab) => {
          const isActive = active === tab.id;
          const Icon = tab.icon;
          return (
            <a
              key={tab.id}
              href={`#${tab.id}`}
              onClick={haptic}
              className="relative flex flex-1 flex-col items-center justify-center gap-0.5"
              aria-current={isActive ? "page" : undefined}
            >
              {isActive && (
                <motion.span
                  layoutId="tab-lens"
                  transition={LENS_SPRING}
                  className="glass-lens absolute inset-x-1.5 inset-y-2 rounded-full"
                />
              )}
              <motion.span
                animate={{
                  scale: isActive ? 1.18 : 1,
                  y: isActive ? -1 : 0,
                }}
                transition={LENS_SPRING}
                className="relative"
              >
                <Icon
                  className={`h-6 w-6 transition-colors duration-300 ${
                    isActive ? "text-snow" : "text-snow/45"
                  }`}
                  strokeWidth={isActive ? 2.2 : 1.8}
                />
              </motion.span>
              <motion.span
                animate={{ opacity: isActive ? 1 : 0.45 }}
                transition={{ duration: 0.3 }}
                className="relative text-[10px] font-light text-snow"
              >
                {tab.label}
              </motion.span>
            </a>
          );
        })}
      </div>
    </motion.nav>
  );
}
