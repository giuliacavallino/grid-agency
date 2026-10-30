"use client";

import { Home, MessageCircle, TrendingUp, Users } from "lucide-react";
import { useRouter } from "next/navigation";
import { scrollToId, stashScrollTarget } from "@/lib/scroll";
import type { ViewId } from "./AppShell";

const tabs: { id: ViewId; label: string; icon: typeof Home }[] = [
  { id: "home", label: "Home", icon: Home },
  { id: "cases", label: "Cases", icon: TrendingUp },
  { id: "team", label: "Team", icon: Users },
  { id: "dm", label: "Kontakt", icon: MessageCircle },
];

function haptic(ms: number) {
  if (typeof navigator !== "undefined" && "vibrate" in navigator) navigator.vibrate(ms);
}

/** Untere Navigation (mobil) als Liquid-Glass-Leiste; die Lupe gleitet zur
 * sichtbaren Sektion. Ohne `active` steht sie auf einer Unterseite: keine
 * Lupe, ein Tipp führt zur Sektion auf der Startseite. */
export function TabBar({ active }: { active?: ViewId }) {
  const router = useRouter();
  const activeIdx = tabs.findIndex((t) => t.id === active);

  return (
    <nav
      aria-label="Hauptnavigation"
      className="rise pointer-events-none fixed inset-x-0 bottom-0 z-40 mx-auto w-full max-w-frame px-5 pb-[calc(env(safe-area-inset-bottom)+14px)] lg:hidden"
      style={{ "--d": "150ms" } as React.CSSProperties}
    >
      <div className="glass pointer-events-auto relative h-[4.25rem] overflow-hidden rounded-full p-1.5">
        {activeIdx >= 0 && (
          <span
            aria-hidden
            className="glass-lens absolute inset-y-1.5 left-1.5 w-[calc((100%-0.75rem)/4)] rounded-full transition-transform duration-500 ease-[var(--ease-spring)]"
            style={{ transform: `translateX(${activeIdx * 100}%)` }}
          />
        )}
        <div className="relative grid h-full grid-cols-4">
          {tabs.map((tab, i) => {
            const lit = activeIdx === i;
            const Icon = tab.icon;
            return (
              <a
                key={tab.id}
                href={active ? `#${tab.id}` : "/"}
                onClick={(e) => {
                  e.preventDefault();
                  haptic(8);
                  if (!active) {
                    stashScrollTarget(tab.id);
                    router.push("/");
                    return;
                  }
                  scrollToId(tab.id);
                }}
                className="flex flex-col items-center justify-center gap-0.5"
                aria-current={lit ? "page" : undefined}
              >
                <Icon
                  className={`h-6 w-6 transition-all duration-300 ${lit ? "scale-110 text-snow" : "text-snow/50"}`}
                  strokeWidth={lit ? 2.2 : 1.8}
                />
                <span className={`text-[0.625rem] font-light transition-opacity ${lit ? "text-snow" : "text-snow/50"}`}>{tab.label}</span>
              </a>
            );
          })}
        </div>
      </div>
    </nav>
  );
}
