import type { MetadataRoute } from "next";
import { clients, clientSlug } from "@/lib/content";
import { SITE_URL } from "@/lib/seo";

export default function sitemap(): MetadataRoute.Sitemap {
  const page = (path: string, priority: number, changeFrequency: MetadataRoute.Sitemap[number]["changeFrequency"]) => ({
    url: `${SITE_URL}${path}`,
    changeFrequency,
    priority,
  });
  return [
    page("/", 1, "weekly"),
    page("/projekte", 0.9, "weekly"),
    ...clients.map((c) => page(`/projekte/${clientSlug(c.name)}`, 0.7, "monthly")),
    page("/faq", 0.8, "monthly"),
    page("/jobs", 0.7, "weekly"),
    page("/ebook", 0.7, "monthly"),
    page("/events", 0.6, "weekly"),
    page("/impressum", 0.2, "yearly"),
    page("/agb", 0.2, "yearly"),
    page("/datenschutz", 0.2, "yearly"),
  ];
}
