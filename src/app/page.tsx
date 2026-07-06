import { AppShell } from "@/components/app/AppShell";
import { ProfileHeader } from "@/components/app/ProfileHeader";
import { StoriesBar } from "@/components/app/StoriesBar";
import { FeedSection } from "@/components/app/FeedSection";
import { ReelsSection } from "@/components/app/ReelsSection";
import { DmSection } from "@/components/app/DmSection";

export default function Home() {
  return (
    <AppShell>
      <section id="profil" className="scroll-mt-14">
        <ProfileHeader />
        <StoriesBar />
      </section>

      <section id="feed" className="mt-6 scroll-mt-14 border-t border-snow/10">
        <FeedSection />
      </section>

      <section id="reels" className="scroll-mt-14 border-t border-snow/10">
        <ReelsSection />
      </section>

      <section id="dm" className="scroll-mt-14 border-t border-snow/10">
        <DmSection />
      </section>
    </AppShell>
  );
}
