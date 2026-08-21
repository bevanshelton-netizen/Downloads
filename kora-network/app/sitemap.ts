import type { MetadataRoute } from 'next';

const publicPaths = [
  '/',
  '/open-africa',
  '/music',
  '/artists',
  '/perform-live',
  '/tickets',
  '/watch',
  '/live',
  '/kids',
  '/creators',
  '/advertise',
  '/legal/terms',
  '/legal/privacy',
  '/legal/content-policy',
  '/legal/creator-agreement',
  '/legal/advertiser-terms',
  '/legal/copyright',
  '/legal/refunds',
];

export default function sitemap(): MetadataRoute.Sitemap {
  const base = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, '') || 'https://kora.example';
  const now = new Date();
  return publicPaths.map((path, index): MetadataRoute.Sitemap[number] => ({
    url: `${base}${path}`,
    lastModified: now,
    changeFrequency: index === 0 ? 'daily' : 'weekly',
    priority: index === 0 ? 1 : path.startsWith('/legal/') ? 0.4 : 0.8,
  }));
}
