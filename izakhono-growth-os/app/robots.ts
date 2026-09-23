import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  const base = (process.env.GROWTH_OS_PUBLIC_BASE_URL || "https://izakhono-growth-os.vercel.app").replace(/\/$/, "");
  return {
    rules: {
      userAgent: "*",
      allow: ["/", "/connect", "/measure"],
      disallow: ["/api/", "/login"],
    },
    sitemap: `${base}/sitemap.xml`,
  };
}
