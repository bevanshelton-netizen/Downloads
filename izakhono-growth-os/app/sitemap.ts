import type { MetadataRoute } from "next";

export default function sitemap(): MetadataRoute.Sitemap {
  const base = ((process.env.GROWTH_OS_PUBLIC_BASE_URL || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "https://growth.domains.izakhonoafrica.co.za"))).replace(/\/$/, "");
  const now = new Date();
  return [
    { url: `${base}/`, lastModified: now, changeFrequency: "weekly", priority: 1 },
    { url: `${base}/connect`, lastModified: now, changeFrequency: "monthly", priority: 0.8 },
    { url: `${base}/measure`, lastModified: now, changeFrequency: "weekly", priority: 0.8 },
  ];
}
