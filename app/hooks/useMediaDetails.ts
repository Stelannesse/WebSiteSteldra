'use client';

import { useCallback, useEffect, useState } from 'react';

import {
  getMediaDetails,
  getSeasonEpisodes,
} from '../lib/mediaService';

import type { MediaItem } from '../types/media';

type Actor = {
  id: string | number;
  name: string;
  character?: string;
  profile_path?: string | null;
  image_url?: string | null;
  voice_actor?: string | null;
  language?: string | null;
};

type Episode = {
  id: number;
  episode_number: number;
  season_number?: number;
  name: string;
  overview?: string;
  air_date?: string | null;
  still_path?: string | null;
  runtime?: number | null;
};

export type LoadedMediaDetails = {
  synopsis: string;
  actors: Actor[];
  seasons_count: number;
  authors?: unknown[];
  runtime?: number | null;
  episode_runtime?: number | null;
  genres?: string[];
  genre_ids?: number[];
  rating?: number | null;
  year?: number | null;
  release_date?: string | null;
  first_air_date?: string | null;
};

type UseMediaDetailsOptions = {
  initialMedia: MediaItem | null;
};

export default function useMediaDetails({
  initialMedia,
}: UseMediaDetailsOptions) {
  const [media, setMedia] =
    useState<MediaItem | null>(initialMedia);

  const [mediaDetails, setMediaDetails] =
    useState<LoadedMediaDetails | null>(null);

  const [detailsLoading, setDetailsLoading] =
    useState(false);

  const [detailsError, setDetailsError] =
    useState<string | null>(null);

  const [activeSeason, setActiveSeason] =
    useState(1);

  const [seasonEpisodes, setSeasonEpisodes] =
    useState<Episode[]>([]);

  const [episodesLoading, setEpisodesLoading] =
    useState(false);

  const [episodesError, setEpisodesError] =
    useState<string | null>(null);

  /**
   * Charge les épisodes d’une saison.
   */
  const loadSeasonEpisodes = useCallback(
    async (
      mediaId: string | number,
      seasonNumber: number
    ) => {
      setActiveSeason(seasonNumber);
      setEpisodesLoading(true);
      setEpisodesError(null);

      try {
        const episodes = await getSeasonEpisodes(
          mediaId,
          seasonNumber
        );

        setSeasonEpisodes(
          Array.isArray(episodes) ? episodes : []
        );
      } catch (error) {
        console.error(
          'Erreur lors du chargement des épisodes :',
          error
        );

        setSeasonEpisodes([]);
        setEpisodesError(
          'Impossible de charger les épisodes.'
        );
      } finally {
        setEpisodesLoading(false);
      }
    },
    []
  );

  /**
   * Charge les informations détaillées du média.
   */
  const loadMediaDetails = useCallback(
    async (mediaToLoad: MediaItem) => {
      setDetailsLoading(true);
      setDetailsError(null);
      setMediaDetails(null);
      setSeasonEpisodes([]);
      setActiveSeason(1);

      const localSynopsis =
        mediaToLoad.synopsis ||
        'Aucun synopsis disponible.';

      const hasSeasons = [
        'tv',
        'anime',
        'drama',
      ].includes(mediaToLoad.type);

      const defaultSeasons = hasSeasons
        ? mediaToLoad.seasons || 1
        : 0;

      try {
        const data = await getMediaDetails(
          mediaToLoad
        );

        const enrichedMedia: MediaItem = {
          ...mediaToLoad,

          runtime:
            data?.runtime ??
            mediaToLoad.runtime ??
            null,

          episode_runtime:
            data?.episode_runtime ??
            mediaToLoad.episode_runtime ??
            null,

          genres:
            Array.isArray(data?.genres) && data.genres.length > 0
              ? data.genres
              : mediaToLoad.genres,

          genre_ids:
            data?.genre_ids ??
            mediaToLoad.genre_ids,

          rating:
            data?.rating ??
            mediaToLoad.rating ??
            null,

          year:
            data?.year ??
            mediaToLoad.year ??
            null,

          release_date:
            data?.release_date ??
            mediaToLoad.release_date ??
            null,

          first_air_date:
            data?.first_air_date ??
            mediaToLoad.first_air_date ??
            null,
        };

        const loadedDetails: LoadedMediaDetails = {
          synopsis:
            data?.synopsis || localSynopsis,

          actors: Array.isArray(data?.actors)
            ? data.actors
            : [],

          seasons_count:
            Number(data?.seasons_count) ||
            defaultSeasons,

          authors:
            data?.authors ||
            data?.creators ||
            [],

          runtime:
            data?.runtime ??
            enrichedMedia.runtime ??
            null,

          episode_runtime:
            data?.episode_runtime ??
            enrichedMedia.episode_runtime ??
            null,

          genres:
            Array.isArray(data?.genres)
              ? data.genres
              : enrichedMedia.genres,

          genre_ids:
            data?.genre_ids ??
            enrichedMedia.genre_ids,

          rating:
            data?.rating ??
            enrichedMedia.rating ??
            null,

          year:
            data?.year ??
            enrichedMedia.year ??
            null,

          release_date:
            data?.release_date ??
            enrichedMedia.release_date ??
            null,

          first_air_date:
            data?.first_air_date ??
            enrichedMedia.first_air_date ??
            null,
        };

        setMedia(enrichedMedia);
        setMediaDetails(loadedDetails);

        if (
          hasSeasons &&
          loadedDetails.seasons_count > 0
        ) {
          await loadSeasonEpisodes(
            enrichedMedia.id,
            1
          );
        }

        return enrichedMedia;
      } catch (error) {
        console.error(
          'Erreur lors du chargement du média :',
          error
        );

        setMedia(mediaToLoad);

        setMediaDetails({
          synopsis: localSynopsis,
          actors: [],
          seasons_count: defaultSeasons,
          authors: [],
          runtime:
            mediaToLoad.runtime ?? null,
          episode_runtime:
            mediaToLoad.episode_runtime ?? null,
          genres: mediaToLoad.genres || [],
          genre_ids: mediaToLoad.genre_ids || [],
          rating: mediaToLoad.rating ?? null,
          year: mediaToLoad.year ?? null,
          release_date: mediaToLoad.release_date ?? null,
          first_air_date: mediaToLoad.first_air_date ?? null,
        });

        setDetailsError(
          'Certaines informations de la fiche n’ont pas pu être chargées.'
        );

        return mediaToLoad;
      } finally {
        setDetailsLoading(false);
      }
    },
    [loadSeasonEpisodes]
  );

  /**
   * Recharge automatiquement la fiche lorsque
   * le média initial est disponible.
   */
  useEffect(() => {
    if (!initialMedia) {
      return;
    }

    setMedia(initialMedia);
    void loadMediaDetails(initialMedia);
  }, [initialMedia, loadMediaDetails]);

  return {
    media,
    setMedia,

    mediaDetails,
    detailsLoading,
    detailsError,

    activeSeason,
    seasonEpisodes,
    episodesLoading,
    episodesError,

    loadMediaDetails,
    loadSeasonEpisodes,
  };
}