/**
 * Rôle du fichier : Utilitaires d'affiche : construit les URL TMDB et applique une image de secours en cas d'échec.
 */

import type { MediaItem } from '../types/media';

export const POSTER_FALLBACK = '/steldra-poster-placeholder.svg';

/** Construit l'adresse d'une affiche ou retourne l'image de remplacement. */
export function getPosterUrl(media: Pick<MediaItem, 'poster_path'>, size = 'w342') {
  const path = media.poster_path?.trim();

  if (!path) return POSTER_FALLBACK;
  if (path.startsWith('http://') || path.startsWith('https://')) return path;

  return `https://image.tmdb.org/t/p/${size}${path}`;
}

/** Remplace une image qui n'a pas pu être chargée. */
export function usePosterFallback(image: HTMLImageElement) {
  if (image.dataset.posterFallback === 'true') return;
  image.dataset.posterFallback = 'true';
  image.src = POSTER_FALLBACK;
}
