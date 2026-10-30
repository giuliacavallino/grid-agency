import { BookingProvider } from "./BookingProvider";
import { SiteFooter } from "./SiteFooter";
import { TabBar } from "./TabBar";
import { TopBar } from "./TopBar";

/** Rahmen für alle Unterseiten (Projekte, Events, Jobs, FAQ, Rechtliches,
 * 404): dieselbe Kopfleiste, untere Navigation und derselbe Footer wie auf
 * der Startseite, auf derselben Breite. */
export function PageShell({ children }: { children: React.ReactNode }) {
  return (
    // Buchungs-Buttons auf Unterseiten (FAQ …) öffnen dasselbe Fenster
    // wie auf der Startseite statt eines neuen Tabs.
    <BookingProvider>
      <div className="relative flex min-h-dvh w-full flex-col overflow-x-clip">
        <TopBar />
        <main className="mx-auto w-full max-w-frame flex-1 px-5 pb-16 pt-28 lg:max-w-frame-wide lg:px-gutter lg:pt-36">
          {children}
        </main>
        {/* Mobil Platz für die untere Navigation lassen. */}
        <footer className="mx-auto w-full max-w-frame px-5 pb-[calc(env(safe-area-inset-bottom)+7rem)] lg:max-w-frame-wide lg:px-gutter lg:pb-10">
          <SiteFooter className="border-t border-snow/10 pt-6 lg:text-left" />
        </footer>
        <TabBar />
      </div>
    </BookingProvider>
  );
}
