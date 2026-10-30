import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    // AVIF zuerst: bei Fotos meist rund 30 % kleiner als WebP
    formats: ["image/avif", "image/webp"],
    minimumCacheTTL: 60 * 60 * 24 * 30,
  },
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
