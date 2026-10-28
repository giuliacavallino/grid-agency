import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Die alte statische Seite lag unter /index.html
  async redirects() {
    return [{ source: "/index.html", destination: "/", permanent: true }];
  },
};

export default nextConfig;
