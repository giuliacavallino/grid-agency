import type { Metadata } from "next";
import localFont from "next/font/local";
import "./globals.css";
import { RevealObserver } from "@/components/ui/RevealObserver";

const readex = localFont({
  src: "./fonts/ReadexPro-Variable.ttf",
  variable: "--font-readex",
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL("https://grid-agency.de"),
  title: "GRID Agency | Social Media Agentur Berlin & Frankfurt",
  description:
    "GRID ist eine Kommunikationsagentur mit Schwerpunkt auf sozialen Medien, digitalem Marketing und den neuen Trends im Verbraucherverhalten. Serving the coolest brands.",
  openGraph: {
    title: "GRID Agency | Social Media Agentur Berlin & Frankfurt",
    description:
      "Digitale Kommunikation innerhalb und außerhalb des Grids. Deine Nr. 1 Social-Media-Agentur in Berlin & Frankfurt.",
    url: "https://grid-agency.de",
    siteName: "GRID Agency",
    locale: "de_DE",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="de" className={`${readex.variable} h-full antialiased`} suppressHydrationWarning>
      <head>
        {/* Vor dem ersten Paint: Mit JS starten .reveal-Elemente unsichtbar
            und blenden beim Scrollen ein; ohne JS bleibt alles sichtbar. */}
        <script dangerouslySetInnerHTML={{ __html: "document.documentElement.classList.add('js')" }} />
      </head>
      <body className="flex min-h-full flex-col bg-sky font-sans text-snow">
        <div aria-hidden className="ambient" />
        {children}
        <RevealObserver />
      </body>
    </html>
  );
}
