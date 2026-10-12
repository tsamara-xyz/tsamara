import type { MetadataRoute } from 'next';

import { SHORT_DESCRIPTION, SITE_NAME } from '@/lib/brand';

const manifest = (): MetadataRoute.Manifest => {
  return {
    name: SITE_NAME,
    short_name: 'Tsamara',
    description: SHORT_DESCRIPTION,
    start_url: '/',
    display: 'standalone',
    background_color: '#ffffff',
    theme_color: '#ffffff',
    icons: [
      {
        src: '/favicon/android-chrome-192x192.png',
        sizes: '192x192',
        type: 'image/png'
      },
      {
        src: '/favicon/android-chrome-512x512.png',
        sizes: '512x512',
        type: 'image/png'
      }
    ]
  };
};

export default manifest;
