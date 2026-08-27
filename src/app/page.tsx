import { AppShell } from "@/components/app/AppShell";
import { HeroSection } from "@/components/app/HeroSection";
import { NewestCollab } from "@/components/app/NewestCollab";
import { TeamSection } from "@/components/app/TeamSection";
import { ServicesSection } from "@/components/app/ServicesSection";
import { CaseStudiesSection } from "@/components/app/CaseStudiesSection";
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

      <section id="leistungen" className="scroll-mt-20">
        <ServicesSection />
      </section>

      <section id="cases" className="scroll-mt-20 border-t border-snow/10">
        <CaseStudiesSection />
      </section>

      <section id="team" className="scroll-mt-20 border-t border-snow/10">
        <TeamSection />
      </section>

      <section id="dm" className="scroll-mt-20 border-t border-snow/10">
        <DmSection />
      </section>
    </AppShell>
  );
}
