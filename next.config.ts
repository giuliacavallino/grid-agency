import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    // Bewerbungsformular mit Unterlagen: bis 4 MB Dateien plus Formular.
    // Vercel nimmt höchstens 4,5 MB pro Anfrage an.
    serverActions: { bodySizeLimit: "4.5mb" },
  },
  async rewrites() {
    // Captcha-Aufgaben kommen vom Intranet, für den Browser aber von hier
    // (gleiche Domain, kein CORS).
    const intranet = process.env.INTRANET_URL ?? "https://intranet.grid-agency.de";
    return [{ source: "/api/altcha", destination: `${intranet}/api/public/altcha` }];
  },
  async redirects() {
    // Die Referenzen-Sektion heißt jetzt Projekte; alte Links und
    // Lesezeichen laufen dauerhaft auf die neuen URLs.
    return [
      { source: "/referenzen", destination: "/projekte", permanent: true },
      {
        source: "/referenzen/:slug",
        destination: "/projekte/:slug",
        permanent: true,
      },
    ];
  },
};

export default nextConfig;
