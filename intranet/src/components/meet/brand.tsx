import Image from "next/image";
import { ArrowRight } from "lucide-react";
import { cn as clsx } from "@/lib/cn";
import { ProductMark } from "@/components/logo";

// Marken-Bausteine für meet.grid-agency.de: Wortmarke, Kundenlogos als
// Laufband, E-Book-Karte und Fußleiste. Bilder liegen unter /assets, weil
// der Proxy auf der meet-Domain nur das durchlässt.

const SITE = "https://grid-agency.de";

/** Kundenlogos (freigestellt), Höhe in px bei 112 px Quellhöhe */
const CLIENTS = [
  ["goldies", "Goldies"],
  ["frittenwerk", "Frittenwerk"],
  ["lovebirds", "lovebirds"],
  ["480gradi", "480 GRADI"],
  ["hasir", "Hasir"],
  ["coffi", "Coffi"],
  ["huck", "Huck"],
  ["green-protein", "Green Protein"],
  ["the-pioneer", "The Pioneer"],
  ["yousthetics", "yousthetics"],
  ["shiso", "Shiso"],
  ["capvin", "Capvin"],
  ["marre", "Marre"],
  ["stonex", "Stonex"],
  ["edrixx", "Edrixx"],
  ["kindly", "Kindly"],
  ["hauptstadtburger", "Hauptstadtburger"],
  ["sajent-club", "Sajent Club"],
] as const;

const WIDTH: Record<string, number> = {
  goldies: 275, frittenwerk: 731, lovebirds: 451, "480gradi": 154, hasir: 497, coffi: 298, huck: 306,
  "green-protein": 557, "the-pioneer": 957, yousthetics: 309, shiso: 239, capvin: 367, marre: 412,
  stonex: 511, edrixx: 209, kindly: 312, hauptstadtburger: 112, "sajent-club": 303,
};
const HEIGHT: Record<string, number> = { "the-pioneer": 140, "sajent-club": 140 };

/** Marke „GRID | MEET“ */
export function MeetMark({ size, className }: { size?: "sm" | "md"; className?: string }) {
  return <ProductMark product="Meet" size={size} priority className={className} />;
}

/** „Serving the coolest brands“: Kundenlogos als Laufband, einfarbig */
export function LogoMarquee({ className, label = true }: { className?: string; label?: boolean }) {
  return (
    <div className={clsx("min-w-0", className)}>
      {label && <p className="text-[11px] font-medium tracking-[0.28em] text-snow/45 uppercase">Serving the coolest brands</p>}
      <div className="meet-fade-x mt-3 overflow-hidden">
        <div className="meet-marquee flex w-max items-center" style={{ "--duration": `${CLIENTS.length * 2.6}s` } as React.CSSProperties}>
          {[...CLIENTS, ...CLIENTS].map(([file, name], i) => {
            const h = 22;
            const w = Math.round((WIDTH[file] / (HEIGHT[file] ?? 112)) * h);
            return (
              <Image
                key={`${file}-${i}`}
                src={`/assets/meet/clients/${file}.png`}
                alt={i < CLIENTS.length ? name : ""}
                width={w}
                height={h}
                className="mr-10 shrink-0 opacity-55 brightness-0 dark:invert"
                style={{ height: h, width: "auto" }}
              />
            );
          })}
        </div>
      </div>
    </div>
  );
}

/** Teaser für das kostenlose E-Book auf der Website */
export function EbookCard({ className }: { className?: string }) {
  return (
    <a
      href={`${SITE}/ebook`}
      target="_blank"
      rel="noopener"
      className={clsx(
        "group flex items-center gap-4 overflow-hidden rounded-2xl border border-snow/12 bg-surface/70 p-3 pr-4 backdrop-blur transition-colors hover:border-snow/25",
        className
      )}
    >
      <Image src="/assets/meet/ebook.jpg" alt="" width={56} height={79} className="h-[79px] w-14 shrink-0 -rotate-3 rounded-md shadow-lg transition-transform duration-300 group-hover:rotate-0" />
      <div className="min-w-0 flex-1">
        <p className="text-[10px] font-medium tracking-[0.22em] text-snow/50 uppercase">E-Book · kostenlos</p>
        <p className="mt-1 text-[15px] leading-tight font-semibold">
          Social Media <span className="text-aurora">2027</span>
        </p>
        <p className="mt-0.5 truncate text-xs text-snow/60">Trends, Formate, Strategien für Marken.</p>
      </div>
      <span className="hidden h-9 shrink-0 items-center gap-1.5 rounded-full bg-snow px-3.5 text-xs font-medium text-sky sm:inline-flex">
        Lesen <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
      </span>
    </a>
  );
}

export function MeetFooter() {
  return (
    <footer className="shrink-0 border-t border-snow/[0.08] bg-snow/[0.04]">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-x-6 gap-y-1 px-4 py-3 text-xs text-snow/60 md:px-6">
        <p>
          <span className="font-medium text-snow/85">GRID Agency</span> · Social-Media-Agentur
        </p>
        <nav className="flex gap-5">
          <a href={`${SITE}/impressum`} className="hover:text-snow">
            Impressum
          </a>
          <a href={`${SITE}/datenschutz#video-call`} className="hover:text-snow">
            Datenschutz
          </a>
        </nav>
      </div>
    </footer>
  );
}

/** Seitenrahmen wie die Raumseite: Marke oben, Inhalt mittig, Marken-Leiste
 * und Fußleiste unten */
export function MeetShell({ children, strip = true, center }: { children: React.ReactNode; strip?: boolean; center?: boolean }) {
  // Eine Seite ohne Scrollen: fest auf den Bildschirm, Inhalt mittig; die
  // Marken-Leiste nur, wenn genug Höhe da ist
  return (
    <div className="aurora fixed inset-0 flex flex-col overflow-hidden overscroll-none bg-sky text-snow">
      <header className="mx-auto flex h-16 w-full max-w-6xl shrink-0 items-center px-4 md:px-6">
        <MeetMark />
      </header>
      <main className={clsx("mx-auto flex min-h-0 w-full max-w-6xl flex-1 flex-col justify-center overflow-hidden px-4 md:px-6", center && "items-center")}>
        {children}
      </main>
      {strip && (
        <div className="mx-auto hidden w-full max-w-6xl shrink-0 grid-cols-[minmax(0,1fr)_minmax(0,26rem)] items-end gap-6 px-6 pt-4 pb-6 md:grid [@media(max-height:860px)]:hidden">
          <LogoMarquee />
          <EbookCard />
        </div>
      )}
      <MeetFooter />
    </div>
  );
}
