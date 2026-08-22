import type { MyListItem } from '../types/media';

const CINEMA_TYPES = new Set(['movie', 'tv', 'drama', 'anime']);
const SERIES_TYPES = new Set(['tv', 'drama', 'anime']);

export type ViewingStats = {
  totalCinemaMedia: number;
  watchedMediaCount: number;
  watchedMovieCount: number;
  watchedSeriesCount: number;
  watchedEpisodeCount: number;
  totalMinutes: number;
  movieMinutes: number;
  seriesMinutes: number;
  animeMinutes: number;
  dramaMinutes: number;
  watchedSeriesEpisodes: number;
  watchedAnimeEpisodes: number;
  watchedDramaEpisodes: number;
  missingDurations: number;
  completion: number;
};

export const normalizeStoredMinutes = (
  value: unknown,
  kind: 'movie' | 'episode'
) => {
  let minutes = Number(value) || 0;
  if (!Number.isFinite(minutes) || minutes <= 0) return 0;

  const suspiciousThreshold = kind === 'movie' ? 600 : 300;
  if (minutes > suspiciousThreshold) minutes /= 60;

  return Math.round(minutes);
};

/**
 * Source de vérité unique pour les statistiques STELDRA.
 *
 * Règles :
 * - uniquement Films / Séries / Dramas / Animés ;
 * - un média = une seule entrée de collection ;
 * - "médias vus" = statut `vu` ;
 * - épisodes = uniquement les épisodes réellement cochés comme vus ;
 * - aucune estimation automatique du nombre total d'épisodes d'une série terminée ;
 * - les films comptent leur durée une fois (les relectures sont gérées par l'historique) ;
 * - compte vide = tous les compteurs à 0.
 */
export function calculateViewingStats(
  myList: Record<string, MyListItem>,
  watchedEpisodes: Record<string, boolean>
): ViewingStats {
  const cinemaEntries = Object.entries(myList).filter(([, entry]) =>
    Boolean(entry?.media && CINEMA_TYPES.has(entry.media.type))
  );

  let watchedMediaCount = 0;
  let watchedMovieCount = 0;
  let watchedSeriesCount = 0;

  let movieMinutes = 0;
  let seriesMinutes = 0;
  let animeMinutes = 0;
  let dramaMinutes = 0;

  let watchedSeriesEpisodes = 0;
  let watchedAnimeEpisodes = 0;
  let watchedDramaEpisodes = 0;
  let missingDurations = 0;

  const cinemaMap = new Map(cinemaEntries);

  cinemaEntries.forEach(([, entry]) => {
    const media = entry.media;
    if (entry.status !== 'vu') return;

    watchedMediaCount += 1;

    if (media.type === 'movie') {
      watchedMovieCount += 1;
      const runtime = normalizeStoredMinutes(media.runtime, 'movie');
      if (runtime > 0) movieMinutes += runtime;
      else missingDurations += 1;
      return;
    }

    if (SERIES_TYPES.has(media.type)) {
      watchedSeriesCount += 1;
    }
  });

  Object.entries(watchedEpisodes).forEach(([episodeKey, isWatched]) => {
    if (!isWatched) return;

    const mediaKey = episodeKey.replace(/_S\d+E\d+$/, '');
    const entry = cinemaMap.get(mediaKey);
    const media = entry?.media;

    if (!media || !SERIES_TYPES.has(media.type)) return;

    const episodeRuntime = normalizeStoredMinutes(
      media.episode_runtime,
      'episode'
    );

    if (media.type === 'tv') {
      watchedSeriesEpisodes += 1;
      if (episodeRuntime > 0) seriesMinutes += episodeRuntime;
      else missingDurations += 1;
    } else if (media.type === 'anime') {
      watchedAnimeEpisodes += 1;
      if (episodeRuntime > 0) animeMinutes += episodeRuntime;
      else missingDurations += 1;
    } else if (media.type === 'drama') {
      watchedDramaEpisodes += 1;
      if (episodeRuntime > 0) dramaMinutes += episodeRuntime;
      else missingDurations += 1;
    }
  });

  const totalCinemaMedia = cinemaEntries.length;
  const watchedEpisodeCount =
    watchedSeriesEpisodes + watchedAnimeEpisodes + watchedDramaEpisodes;
  const totalMinutes = movieMinutes + seriesMinutes + animeMinutes + dramaMinutes;
  const completion =
    totalCinemaMedia > 0
      ? Math.round((watchedMediaCount / totalCinemaMedia) * 100)
      : 0;

  return {
    totalCinemaMedia,
    watchedMediaCount,
    watchedMovieCount,
    watchedSeriesCount,
    watchedEpisodeCount,
    totalMinutes,
    movieMinutes,
    seriesMinutes,
    animeMinutes,
    dramaMinutes,
    watchedSeriesEpisodes,
    watchedAnimeEpisodes,
    watchedDramaEpisodes,
    missingDurations,
    completion,
  };
}
