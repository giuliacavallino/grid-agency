import { AppShell } from "@/components/app/AppShell";
import { HeroSection } from "@/components/app/HeroSection";
import { NewestCollab } from "@/components/app/NewestCollab";
import { TeamSection } from "@/components/app/TeamSection";
import { ProcessSection } from "@/components/app/ProcessSection";
import { LiveFeedSection } from "@/components/app/LiveFeedSection";
import { DmSection } from "@/components/app/DmSection";

export default function Home() {
  return (
    <AppShell>
      <section id="home" className="scroll-mt-20">
        <HeroSection />
      </section>

      <section className="border-t border-snow/10">
        <NewestCollab />
      </section>

      <section id="team" className="scroll-mt-20 border-t border-snow/10">
        <TeamSection />
      </section>

      <section id="prozess" className="scroll-mt-20 border-t border-snow/10">
        <ProcessSection />
      </section>

      <section id="feed" className="scroll-mt-20 border-t border-snow/10">
        <LiveFeedSection />
      </section>

      <section id="dm" className="scroll-mt-20 border-t border-snow/10">
        <DmSection />
      </section>
    </AppShell>
  );
}
