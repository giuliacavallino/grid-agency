import { AppShell } from "@/components/app/AppShell";
import { Hero } from "@/components/home/Hero";
import { LogoMarquee } from "@/components/home/LogoMarquee";
import { Services } from "@/components/home/Services";
import { Results } from "@/components/home/Results";
import { Cases } from "@/components/home/Cases";
import { Feed } from "@/components/home/Feed";
import { Projects } from "@/components/home/Projects";
import { Roadmap } from "@/components/home/Roadmap";
import { Team } from "@/components/home/Team";
import { Contact } from "@/components/home/Contact";
import { nextEvent } from "@/lib/events";

// Das nächste Event in der News-Pille des Heros; neue Events erscheinen nach
// spätestens einer Minute.
export const revalidate = 60;

export default async function Home() {
  return (
    <AppShell>
      <Hero event={await nextEvent()} />
      <LogoMarquee />
      <Services />
      <Results />
      <Cases />
      <Feed />
      <Projects />
      <Roadmap />
      <Team />
      <Contact />
    </AppShell>
  );
}
