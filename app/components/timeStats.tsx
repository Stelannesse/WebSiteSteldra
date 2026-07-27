'use client';

import { useMemo } from 'react';
import styles from '../page.module.css';

import type {
  MyListItem,
} from '../types/media';

type TimeStatsProps = {
  myList: Record<string, MyListItem>;
  watchedEpisodes: Record<string, boolean>;
};

const formatDuration = (minutes: number) => {
  if (minutes <= 0) {
    return '0 min';
  }

  const days = Math.floor(minutes / 1440);
  const hours = Math.floor(
    (minutes % 1440) / 60
  );
  const remainingMinutes = minutes % 60;

  const parts: string[] = [];

  if (days > 0) {
    parts.push(`${days} j`);
  }

  if (hours > 0) {
    parts.push(`${hours} h`);
  }

  if (remainingMinutes > 0 || parts.length === 0) {
    parts.push(`${remainingMinutes} min`);
  }

  return parts.join(' ');
};

export default function TimeStats({
  myList,
  watchedEpisodes,
}: TimeStatsProps) {
  const stats = useMemo(() => {
    let movieMinutes = 0;
    let seriesMinutes = 0;
    let animeMinutes = 0;
    let dramaMinutes = 0;

    let watchedMovies = 0;
    let watchedSeriesEpisodes = 0;
    let watchedAnimeEpisodes = 0;
    let watchedDramaEpisodes = 0;

    let missingDurations = 0;

    /*
     * Films terminés
     */
    Object.values(myList).forEach((entry) => {
      const media = entry.media;

      if (
        media.type !== 'movie' ||
        entry.status !== 'vu'
      ) {
        return;
      }

      const runtime =
        Number(media.runtime) || 0;

      const watchCount = Math.max(
        Number(entry.watchCount) || 1,
        1
      );

      watchedMovies += watchCount;

      if (runtime > 0) {
        movieMinutes += runtime * watchCount;
      } else {
        missingDurations += 1;
      }
    });

    /*
     * Épisodes cochés comme vus
     */
    Object.entries(watchedEpisodes).forEach(
      ([episodeKey, isWatched]) => {
        if (!isWatched) {
          return;
        }

        /*
         * Exemple :
         * anime_123_S1E4
         *
         * devient :
         * anime_123
         */
        const mediaKey = episodeKey.replace(
          /_S\d+E\d+$/,
          ''
        );

        const media = myList[mediaKey]?.media;

        if (!media) {
          return;
        }

        const episodeRuntime =
          Number(media.episode_runtime) || 0;

        if (media.type === 'tv') {
          watchedSeriesEpisodes += 1;

          if (episodeRuntime > 0) {
            seriesMinutes += episodeRuntime;
          } else {
            missingDurations += 1;
          }
        }

        if (media.type === 'anime') {
          watchedAnimeEpisodes += 1;

          if (episodeRuntime > 0) {
            animeMinutes += episodeRuntime;
          } else {
            missingDurations += 1;
          }
        }

        if (media.type === 'drama') {
          watchedDramaEpisodes += 1;

          if (episodeRuntime > 0) {
            dramaMinutes += episodeRuntime;
          } else {
            missingDurations += 1;
          }
        }
      }
    );

    const totalMinutes =
      movieMinutes +
      seriesMinutes +
      animeMinutes +
      dramaMinutes;

    const totalEpisodes =
      watchedSeriesEpisodes +
      watchedAnimeEpisodes +
      watchedDramaEpisodes;

    return {
      totalMinutes,

      movieMinutes,
      seriesMinutes,
      animeMinutes,
      dramaMinutes,

      watchedMovies,
      totalEpisodes,
      watchedSeriesEpisodes,
      watchedAnimeEpisodes,
      watchedDramaEpisodes,

      missingDurations,
    };
  }, [myList, watchedEpisodes]);

  return (
    <section className={styles.timeStats}>
      <div className={styles.timeStatsHeader}>
        <div>
          <span className={styles.timeStatsEyebrow}>
            Statistiques
          </span>

          <h2 className={styles.timeStatsTitle}>
            Temps passé devant tes écrans
          </h2>
        </div>

        <div className={styles.timeStatsTotal}>
          <span>Temps total</span>

          <strong>
            {formatDuration(stats.totalMinutes)}
          </strong>
        </div>
      </div>

      <div className={styles.timeStatsGrid}>
        <article className={styles.timeStatCard}>
          <span className={styles.timeStatIcon}>
            🎬
          </span>

          <div>
            <span className={styles.timeStatLabel}>
              Films
            </span>

            <strong className={styles.timeStatValue}>
              {formatDuration(stats.movieMinutes)}
            </strong>

            <small className={styles.timeStatDetail}>
              {stats.watchedMovies} film
              {stats.watchedMovies > 1 ? 's' : ''}{' '}
              vu
              {stats.watchedMovies > 1 ? 's' : ''}
            </small>
          </div>
        </article>

        <article className={styles.timeStatCard}>
          <span className={styles.timeStatIcon}>
            📺
          </span>

          <div>
            <span className={styles.timeStatLabel}>
              Séries
            </span>

            <strong className={styles.timeStatValue}>
              {formatDuration(stats.seriesMinutes)}
            </strong>

            <small className={styles.timeStatDetail}>
              {stats.watchedSeriesEpisodes}{' '}
              épisode
              {stats.watchedSeriesEpisodes > 1
                ? 's'
                : ''}
            </small>
          </div>
        </article>

        <article className={styles.timeStatCard}>
          <span className={styles.timeStatIcon}>
            ✨
          </span>

          <div>
            <span className={styles.timeStatLabel}>
              Animés
            </span>

            <strong className={styles.timeStatValue}>
              {formatDuration(stats.animeMinutes)}
            </strong>

            <small className={styles.timeStatDetail}>
              {stats.watchedAnimeEpisodes}{' '}
              épisode
              {stats.watchedAnimeEpisodes > 1
                ? 's'
                : ''}
            </small>
          </div>
        </article>

        <article className={styles.timeStatCard}>
          <span className={styles.timeStatIcon}>
            🎭
          </span>

          <div>
            <span className={styles.timeStatLabel}>
              Dramas
            </span>

            <strong className={styles.timeStatValue}>
              {formatDuration(stats.dramaMinutes)}
            </strong>

            <small className={styles.timeStatDetail}>
              {stats.watchedDramaEpisodes}{' '}
              épisode
              {stats.watchedDramaEpisodes > 1
                ? 's'
                : ''}
            </small>
          </div>
        </article>
      </div>

      {stats.missingDurations > 0 && (
        <p className={styles.timeStatsNotice}>
          Certaines durées ne sont pas encore
          disponibles. Le total affiché correspond
          uniquement aux médias dont la durée est
          connue.
        </p>
      )}
    </section>
  );
}