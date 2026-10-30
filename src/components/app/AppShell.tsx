"use client";

import { useEffect, useState } from "react";
import { TopBar } from "./TopBar";
import { TabBar } from "./TabBar";
import { SiteFooter } from "./SiteFooter";
import { popScrollTarget, scrollToId } from "@/lib/scroll";

export type ViewId = "home" | "cases" | "team" | "dm";

/** Rahmen der Startseite: Kopfleiste, Inhalt, Footer und mobil die untere
 * Navigation, deren Lupe der gerade sichtbaren Sektion folgt. */
export function AppShell({ children }: { children: React.ReactNode }) {
  const [activeView, setActiveView] = useState<ViewId>("home");

  // Immer oben starten: keine Scroll-Wiederherstellung, kein alter #hash.
  useEffect(() => {
    if ("scrollRestoration" in window.history) {
      window.history.scrollRestoration = "manual";
    }
    if (window.location.hash) {
      window.history.replaceState(null, "", window.location.pathname);
    }
    window.scrollTo(0, 0);

    // Unterseiten (Menü, Kontakt-Links) merken sich die Ziel-Sektion vor
    // dem Wechsel auf die Startseite.
    const target = popScrollTarget();
    if (target) requestAnimationFrame(() => scrollToId(target));
  }, []);

  useEffect(() => {
    const sections = ["home", "cases", "team", "dm"]
      .map((id) => document.getElementById(id))
      .filter(Boolean) as HTMLElement[];
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
        if (visible) setActiveView(visible.target.id as ViewId);
      },
      { rootMargin: "-40% 0px -40% 0px", threshold: [0, 0.25, 0.5] },
    );
    sections.forEach((s) => observer.observe(s));
    return () => observer.disconnect();
  }, []);

  return (
    <div className="relative min-h-dvh w-full overflow-x-clip">
      <TopBar />
      <main>{children}</main>
      <SiteFooter />
      <TabBar active={activeView} />
    </div>
  );
}
