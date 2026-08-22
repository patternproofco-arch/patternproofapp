import { createFileRoute } from "@tanstack/react-router";
import type {} from "@tanstack/react-start";

const BASE_URL = "https://pattern-proof.tech";

interface SitemapEntry {
  path: string;
  changefreq?: "always" | "hourly" | "daily" | "weekly" | "monthly" | "yearly" | "never";
  priority?: string;
}

export const Route = createFileRoute("/sitemap.xml")({
  server: {
    handlers: {
      GET: async () => {
        const entries: SitemapEntry[] = [
          { path: "/", changefreq: "weekly", priority: "1.0" },
          { path: "/pricing", changefreq: "monthly", priority: "0.9" },
          { path: "/for-attorneys", changefreq: "monthly", priority: "0.9" },
          { path: "/for-organizations", changefreq: "monthly", priority: "0.9" },
          { path: "/demo", changefreq: "monthly", priority: "0.7" },
          { path: "/privacy", changefreq: "yearly", priority: "0.4" },
          { path: "/terms", changefreq: "yearly", priority: "0.4" },
          { path: "/how-it-works", changefreq: "monthly", priority: "0.6" },
          { path: "/sample-case", changefreq: "monthly", priority: "0.6" },
          { path: "/resources", changefreq: "monthly", priority: "0.6" },
          { path: "/self-help-guide", changefreq: "monthly", priority: "0.6" },
          { path: "/safety", changefreq: "monthly", priority: "0.6" },
          { path: "/evidence-integrity", changefreq: "monthly", priority: "0.6" },
          { path: "/ai-transparency", changefreq: "monthly", priority: "0.6" },
          { path: "/professional-access", changefreq: "monthly", priority: "0.6" },
          { path: "/support", changefreq: "monthly", priority: "0.6" },
          { path: "/waitlist", changefreq: "monthly", priority: "0.6" },
        ];

        const urls = entries.map((e) =>
          [
            `  <url>`,
            `    <loc>${BASE_URL}${e.path}</loc>`,
            e.changefreq ? `    <changefreq>${e.changefreq}</changefreq>` : null,
            e.priority ? `    <priority>${e.priority}</priority>` : null,
            `  </url>`,
          ]
            .filter(Boolean)
            .join("\n"),
        );

        const xml = [
          `<?xml version="1.0" encoding="UTF-8"?>`,
          `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">`,
          ...urls,
          `</urlset>`,
        ].join("\n");

        return new Response(xml, {
          headers: {
            "Content-Type": "application/xml",
            "Cache-Control": "public, max-age=3600",
          },
        });
      },
    },
  },
});