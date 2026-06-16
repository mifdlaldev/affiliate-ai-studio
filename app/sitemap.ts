import type { MetadataRoute } from "next";

export default function sitemap(): MetadataRoute.Sitemap {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://affiliate-ai-studio.vercel.app";
  return [
    { url: siteUrl, lastModified: new Date(), changeFrequency: "monthly", priority: 1.0 },
    { url: `${siteUrl}/login`, lastModified: new Date(), changeFrequency: "monthly", priority: 0.5 },
    { url: `${siteUrl}/assets`, lastModified: new Date(), changeFrequency: "weekly", priority: 0.7 },
  ];
}
