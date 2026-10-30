import { SiteFooter } from "./SiteFooter";
import { TabBar } from "./TabBar";
import { TopBar } from "./TopBar";

/** Rahmen für alle Unterseiten (Projekte, Events, Jobs, FAQ, Rechtliches,
 * 404): dieselbe Kopfleiste, untere Navigation und derselbe Footer wie auf
 * der Startseite, auf derselben Breite. */
export function PageShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative flex min-h-dvh w-full flex-col overflow-x-clip">
      <div aria-hidden className="grid-lines pointer-events-none absolute inset-x-0 top-0 h-[40rem]" />
      <TopBar />
      <main className="relative mx-auto w-full max-w-frame flex-1 px-5 pb-16 pt-32 lg:max-w-frame-wide lg:px-gutter lg:pt-44">
        {children}
      </main>
      <SiteFooter />
      <TabBar />
    </div>
  );
}
