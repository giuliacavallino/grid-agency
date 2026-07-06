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

export function TabBar({ active }: { active: ViewId }) {
  return (
    <motion.nav
      initial={{ y: 80, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.5, delay: 0.15, ease: [0.16, 1, 0.3, 1] }}
      className="fixed bottom-0 z-40 w-full max-w-[560px] border-t border-snow/10 bg-sky/85 pb-[env(safe-area-inset-bottom)] backdrop-blur-lg"
      aria-label="Hauptnavigation"
    >
      <div className="flex h-16 items-stretch justify-around">
        {tabs.map((tab) => {
          const isActive = active === tab.id;
          const Icon = tab.icon;
          return (
            <a
              key={tab.id}
              href={`#${tab.id}`}
              className="relative flex flex-1 flex-col items-center justify-center gap-1"
              aria-current={isActive ? "page" : undefined}
            >
              {isActive && (
                <motion.span
                  layoutId="tab-indicator"
                  className="absolute top-0 h-0.5 w-10 rounded-full bg-snow"
                  transition={{ type: "spring", stiffness: 400, damping: 32 }}
                />
              )}
              <Icon
                className={`h-6 w-6 transition-colors ${
                  isActive ? "text-snow" : "text-snow/45"
                }`}
                strokeWidth={isActive ? 2.2 : 1.8}
              />
              <span
                className={`text-[10px] font-light transition-colors ${
                  isActive ? "text-snow" : "text-snow/45"
                }`}
              >
                {tab.label}
              </span>
            </a>
          );
        })}
      </div>
    </motion.nav>
  );
}
