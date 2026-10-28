import { AppShell } from "@/components/app/AppShell";
import { HeroSection } from "@/components/app/HeroSection";
import { NewestCollab } from "@/components/app/NewestCollab";
import { TeamSection } from "@/components/app/TeamSection";
import { ServicesSection } from "@/components/app/ServicesSection";
import { CaseStudiesSection } from "@/components/app/CaseStudiesSection";
import { ProjekteTeaser } from "@/components/app/ProjekteTeaser";
import { RoadmapSection } from "@/components/app/RoadmapSection";
import { DmSection } from "@/components/app/DmSection";
import { PhotoStrip } from "@/components/app/PhotoStrip";

export default function Home() {
  return (
    <AppShell>
      <section id="home">
        <HeroSection />
      </section>

      <section className="border-t border-snow/10">
        <NewestCollab />
      </section>

      <section id="leistungen">
        <ServicesSection />
      </section>

      <section id="cases" className="border-t border-snow/10">
        <CaseStudiesSection />
      </section>

      <section id="projekte" className="border-t border-snow/10">
        <ProjekteTeaser />
      </section>

      <section className="border-t border-snow/10">
        <PhotoStrip />
      </section>

      <section id="roadmap" className="border-t border-snow/10">
        <RoadmapSection />
      </section>

      <section id="team" className="border-t border-snow/10">
        <TeamSection />
      </section>

      <section id="dm" className="border-t border-snow/10">
        <DmSection />
      </section>
    </AppShell>
  );
}
