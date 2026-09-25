import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  const base = ((process.env.GROWTH_OS_PUBLIC_BASE_URL || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "https://growth.domains.izakhonoafrica.co.za"))).replace(/\/$/, "");
  return {
    rules: {
      userAgent: "*",
      allow: ["/", "/connect", "/measure"],
      disallow: ["/api/", "/login"],
    },
    sitemap: `${base}/sitemap.xml`,
  };
}
