"use client";

import { useEffect, useState } from "react";
import { TopBar } from "./TopBar";
import { TabBar } from "./TabBar";
import { BootIntro } from "./BootIntro";

export type ViewId = "profil" | "feed" | "reels" | "dm";

export function AppShell({ children }: { children: React.ReactNode }) {
  const [activeView, setActiveView] = useState<ViewId>("profil");

  useEffect(() => {
    const sections = ["profil", "feed", "reels", "dm"]
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
