import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'ufo — AI UI/UX design platform',
    short_name: 'ufo',
    description: 'Describe it. See it. Click through it.',
    start_url: '/dashboard',
    display: 'standalone',
    background_color: '#101114',
    theme_color: '#101114',
    icons: [
      { src: '/icon.svg', sizes: 'any', type: 'image/svg+xml' },
      { src: '/apple-icon.png', sizes: '180x180', type: 'image/png' },
    ],
  };
}
