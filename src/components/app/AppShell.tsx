"use client";

import { useEffect, useState } from "react";
import { TopBar } from "./TopBar";
import { TabBar } from "./TabBar";
import { BootIntro } from "./BootIntro";
import { popScrollTarget, scrollToId } from "@/lib/scroll";

export type ViewId = "home" | "team" | "prozess" | "feed" | "dm";

export function AppShell({ children }: { children: React.ReactNode }) {
  const [activeView, setActiveView] = useState<ViewId>("home");

  // Always start at the top: no browser scroll restoration, no stale #hash.
  useEffect(() => {
    if ("scrollRestoration" in window.history) {
      window.history.scrollRestoration = "manual";
    }
    if (window.location.hash) {
      window.history.replaceState(null, "", window.location.pathname);
    }
    window.scrollTo(0, 0);

    // Subpages (menu, Referenzen, Events) stash a section id before
    // navigating home; honor it once the sections are on screen.
    const target = popScrollTarget();
    if (target) {
      requestAnimationFrame(() => scrollToId(target));
    }
  }, []);

  useEffect(() => {
    const sections = ["home", "team", "prozess", "feed", "dm"]
      .map((id) => document.getElementById(id))
      .filter(Boolean) as HTMLElement[];

    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
        if (visible) setActiveView(visible.target.id as ViewId);
      },
      { rootMargin: "-40% 0px -40% 0px", threshold: [0, 0.25, 0.5] }
    );

    sections.forEach((s) => observer.observe(s));
    return () => observer.disconnect();
  }, []);

  return (
    <div className="relative mx-auto min-h-dvh w-full max-w-[560px]">
      <BootIntro />
      <TopBar />
      <main className="pb-32 pt-20">{children}</main>
      <TabBar active={activeView} />
    </div>
  );
}
