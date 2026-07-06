import type { Metadata } from "next";
import localFont from "next/font/local";
import "./globals.css";

const readex = localFont({
  src: "./fonts/ReadexPro-Variable.ttf",
  variable: "--font-readex",
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL("https://grid-agency.de"),
  title: "GRID Agency — Social Media Agentur Berlin & Frankfurt",
  description:
    "GRID ist eine Kommunikationsagentur mit Schwerpunkt auf sozialen Medien, digitalem Marketing und den neuen Trends im Verbraucherverhalten. Serving the coolest brands.",
  openGraph: {
    title: "GRID Agency — Social Media Agentur Berlin & Frankfurt",
    description:
      "Digitale Kommunikation im und außerhalb das Grid. Deine Nr. 1 Social Media Agentur in Berlin & Frankfurt.",
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
    <html lang="de" className={`${readex.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col bg-sky text-snow font-sans">
        {children}
      </body>
    </html>
  );
}
