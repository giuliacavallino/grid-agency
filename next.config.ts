import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    // Bewerbungsformular mit Unterlagen: bis 4 MB Dateien plus Formular.
    // Vercel nimmt höchstens 4,5 MB pro Anfrage an.
    serverActions: { bodySizeLimit: "4.5mb" },
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
