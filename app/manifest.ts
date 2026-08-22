import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'STELDRA',
    short_name: 'STELDRA',
    description: 'Films, séries, dramas et animés — votre univers cinéma STELDRA',
    start_url: '/',
    display: 'standalone',
    background_color: '#030b12',
    theme_color: '#030b12',
    orientation: 'portrait-primary',
    icons: [
      { src: '/icon.png', sizes: 'any', type: 'image/png' },
      { src: '/apple-icon.png', sizes: 'any', type: 'image/png' },
    ],
  };
}
