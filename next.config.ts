import type { NextConfig } from "next";

const nextConfig: NextConfig = {
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
