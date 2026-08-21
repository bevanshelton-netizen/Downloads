import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'KORA Network',
    short_name: 'KORA',
    description: 'African creator-first digital television: live, on demand, family entertainment and creator-led programming.',
    start_url: '/',
    display: 'standalone',
    background_color: '#15155b',
    theme_color: '#4c1fa8',
    categories: ['entertainment', 'video', 'music', 'lifestyle'],
  };
}
