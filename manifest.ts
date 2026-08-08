import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Steldra',
    short_name: 'Steldra',
    description: 'Films, séries, animés, mangas et manhwas',
    start_url: '/',
    display: 'standalone',
    background_color: '#100820',
    theme_color: '#24103f',
    icons: [
      {
        src: '/icon.png',
        sizes: '512x512',
        type: 'image/png',
      },
    ],
  };
}
