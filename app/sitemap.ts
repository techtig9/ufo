import type { MetadataRoute } from 'next';
import { siteUrl } from '@/lib/site-url';
import { publishedSlugs } from '@/lib/blog';

const SITE_URL = siteUrl();

export default function sitemap(): MetadataRoute.Sitemap {
  const staticRoutes = [
    '',
    '/login',
    '/signup',
    '/contact',
    '/help',
    '/legal/terms',
    '/legal/privacy',
    '/legal/refunds',
    '/legal/cookies',
    '/changelog',
    '/blog',
  ];

  // Published posts only. publishedSlugs() filters drafts in EVERY
  // environment, not just production — a draft leaking into the sitemap is
  // how unfinished copy gets crawled before anyone notices it is listed.
  const postRoutes = publishedSlugs().map((slug) => `/blog/${slug}`);

  return [...staticRoutes, ...postRoutes].map((path) => ({
    url: `${SITE_URL}${path}`,
    lastModified: new Date(),
    changeFrequency: path === '' ? 'weekly' : 'monthly',
    priority: path === '' ? 1 : path.startsWith('/blog/') ? 0.6 : 0.5,
  }));

  // Public prototype pages (/proto/[slug]) are intentionally excluded —
  // they're customer content, not marketing pages, and most are meant to
  // be shared by link rather than discovered via search.
}
