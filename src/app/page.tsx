import { AppShell } from "@/components/app/AppShell";
import { ProfileHeader } from "@/components/app/ProfileHeader";
import { StoriesBar } from "@/components/app/StoriesBar";
import { SectionPlaceholder } from "@/components/app/SectionPlaceholder";
import { DmSection } from "@/components/app/DmSection";

export default function Home() {
  return (
    <AppShell>
      <section id="profil" className="scroll-mt-14">
        <ProfileHeader />
        <StoriesBar />
      </section>

      <section id="feed" className="mt-6 scroll-mt-14 border-t border-snow/10">
        <SectionPlaceholder
          kicker="Feed"
          title="Serving the coolest brands."
          variant="feed"
        />
      </section>

      <section id="reels" className="scroll-mt-14 border-t border-snow/10">
        <SectionPlaceholder
          kicker="Reels"
          title="Vision 2030."
          variant="reels"
        />
      </section>

      <section id="dm" className="scroll-mt-14 border-t border-snow/10">
        <DmSection />
      </section>
    </AppShell>
  );
}
