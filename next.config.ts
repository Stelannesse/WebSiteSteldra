import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'uploads.mangadex.org', // Pour les images MangaDex
      },
      {
        protocol: 'https',
        hostname: 'image.tmdb.org', // Pour les images de films/séries (si tu utilises TMDB)
      },
      {
        protocol: 'https',
        hostname: 'cdn.myanimelist.net', // Pour les images d'Animes
      },
    ],
  },
};

export default nextConfig;