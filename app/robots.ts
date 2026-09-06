import type { MetadataRoute } from 'next';
import { siteUrl } from '@/lib/site-url';

const SITE_URL = siteUrl();

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: ['/dashboard', '/admin', '/api', '/auth'],
      },
    ],
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
