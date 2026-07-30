import type { MetadataRoute } from 'next';

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000';

export default function sitemap(): MetadataRoute.Sitemap {
  const staticRoutes = [
    '',
    '/login',
    '/signup',
    '/contact',
    '/legal/terms',
    '/legal/privacy',
    '/legal/refunds',
    '/legal/cookies',
    '/changelog',
  ];

  return staticRoutes.map((path) => ({
    url: `${SITE_URL}${path}`,
    lastModified: new Date(),
    changeFrequency: path === '' ? 'weekly' : 'monthly',
    priority: path === '' ? 1 : 0.5,
  }));

  // Public prototype pages (/proto/[slug]) are intentionally excluded —
  // they're customer content, not marketing pages, and most are meant to
  // be shared by link rather than discovered via search.
}
