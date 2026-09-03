import { AppShell } from "@/components/app/AppShell";
import { HeroSection } from "@/components/app/HeroSection";
import { NewestCollab } from "@/components/app/NewestCollab";
import { TeamSection } from "@/components/app/TeamSection";
import { ServicesSection } from "@/components/app/ServicesSection";
import { CaseStudiesSection } from "@/components/app/CaseStudiesSection";
import { ProjekteTeaser } from "@/components/app/ProjekteTeaser";
import { RoadmapSection } from "@/components/app/RoadmapSection";
import { DmSection } from "@/components/app/DmSection";
import { TextMarquee } from "@/components/app/TextMarquee";
import { PhotoStrip } from "@/components/app/PhotoStrip";

export default function Home() {
  return (
    <AppShell>
      <section id="home" className="scroll-mt-20">
        <HeroSection />
      </section>

      <section className="border-t border-snow/10">
        <NewestCollab />
      </section>

      <section className="border-t border-snow/10">
        <TextMarquee
          items={["Social Media", "Content Creation", "Performance Marketing", "Community Building", "Influencer Marketing", "Events"]}
        />
      </section>

      <section id="leistungen" className="scroll-mt-20">
        <ServicesSection />
      </section>

      <section id="cases" className="scroll-mt-20 border-t border-snow/10">
        <CaseStudiesSection />
      </section>

      <section id="projekte" className="scroll-mt-20 border-t border-snow/10">
        <ProjekteTeaser />
      </section>

      <section className="border-t border-snow/10">
        <PhotoStrip />
      </section>

      <section id="roadmap" className="scroll-mt-20 border-t border-snow/10">
        <RoadmapSection />
      </section>

      <section id="team" className="scroll-mt-20 border-t border-snow/10">
        <TeamSection />
      </section>

      <section className="border-t border-snow/10">
        <TextMarquee
          items={["Marken, die man nicht wegscrollen kann", "GRID Agency", "Berlin", "Frankfurt"]}
          duration={46}
        />
      </section>

      <section id="dm" className="scroll-mt-20 border-t border-snow/10">
        <DmSection />
      </section>
    </AppShell>
  );
}
