import type { MediaItem } from '../types/media';

export const POSTER_FALLBACK = '/steldra-poster-placeholder.svg';

export function getPosterUrl(media: Pick<MediaItem, 'poster_path'>, size = 'w342') {
  const path = media.poster_path?.trim();

  if (!path) return POSTER_FALLBACK;
  if (path.startsWith('http://') || path.startsWith('https://')) return path;

  return `https://image.tmdb.org/t/p/${size}${path}`;
}

export function usePosterFallback(image: HTMLImageElement) {
  if (image.dataset.posterFallback === 'true') return;
  image.dataset.posterFallback = 'true';
  image.src = POSTER_FALLBACK;
}
