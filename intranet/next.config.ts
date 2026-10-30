import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Schriften des Rechnungs-PDFs (per Pfad gelesen, daher nicht automatisch dabei)
  outputFileTracingIncludes: {
    "/api/finance/**": ["src/lib/server/fonts/**"],
    "/api/cron/billing": ["src/lib/server/fonts/**"],
    "/api/sign/**": ["src/lib/server/fonts/**"],
    // E-Book-PDF, das /api/public/ebook als Anhang verschickt
    "/api/public/ebook": ["src/lib/server/ebook/**"],
  },
  // Die alte statische Seite lag unter /index.html
  async redirects() {
    return [{ source: "/index.html", destination: "/", permanent: true }];
  },
};

export default nextConfig;
