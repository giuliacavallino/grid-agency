import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/seo";

/** Suchmaschinen und KI-Crawler (GPTBot, ClaudeBot, PerplexityBot …)
 * dürfen alles lesen; nur Formular-Endpunkte und die Buchungsseite
 * bleiben draußen. */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: "*", allow: "/", disallow: ["/api/", "/termin"] },
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  };
}
