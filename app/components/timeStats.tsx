'use client';

import { useMemo } from 'react';
import styles from '../page.module.css';

import type {
  MyListItem,
} from '../types/media';
import { calculateViewingStats } from '../lib/viewingStats';

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
  const stats = useMemo(
    () => calculateViewingStats(myList, watchedEpisodes),
    [myList, watchedEpisodes]
  );

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
          

          <div>
            <span className={styles.timeStatLabel}>
              Films
            </span>

            <strong className={styles.timeStatValue}>
              {formatDuration(stats.movieMinutes)}
            </strong>

            <small className={styles.timeStatDetail}>
              {stats.watchedMovieCount} film
              {stats.watchedMovieCount > 1 ? 's' : ''}{' '}
              vu
              {stats.watchedMovieCount > 1 ? 's' : ''}
            </small>
          </div>
        </article>

        <article className={styles.timeStatCard}>
          

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