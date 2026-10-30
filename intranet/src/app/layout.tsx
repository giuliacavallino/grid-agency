import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import { AuthProvider } from "@/lib/auth";
import { TeamsProvider } from "@/components/teams";
import { ToastProvider } from "@/components/ui";
import "./globals.css";

const readex = localFont({
  src: "./fonts/ReadexPro-Variable.ttf",
  variable: "--font-readex",
  display: "swap",
});

export const metadata: Metadata = {
  title: { default: "GRID Intranet", template: "%s | GRID Intranet" },
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  themeColor: "#2b2926",
  viewportFit: "cover",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="de" className={`${readex.variable} h-full antialiased`}>
      <body className="min-h-full bg-sky font-sans font-light text-snow">
        <AuthProvider>
          <ToastProvider>
            <TeamsProvider>{children}</TeamsProvider>
          </ToastProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
