import type { MetadataRoute } from 'next';

export default function robots(): MetadataRoute.Robots {
  const base = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, '') || 'https://kora.example';
  return {
    rules: {
      userAgent: '*',
      allow: ['/', '/watch', '/live', '/kids', '/creators', '/advertise', '/legal/'],
      disallow: ['/admin/', '/account/', '/studio/', '/advertiser/', '/api/'],
    },
    sitemap: `${base}/sitemap.xml`,
  };
}
