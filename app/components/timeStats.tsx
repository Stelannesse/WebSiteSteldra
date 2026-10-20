/**
 * Rôle du fichier : Bloc de statistiques : transforme le temps de visionnage en indicateurs lisibles.
 */

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

/** Transforme une durée en minutes en texte lisible. */
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



/** Composant principal de cette page ou zone d'interface. */
export default function TimeStats({
  myList,
  watchedEpisodes,
}: TimeStatsProps) {
  const stats = useMemo(
    () => calculateViewingStats(myList, watchedEpisodes),
    [myList, watchedEpisodes]
  );

  return (
    <section data-steldra-ui="timeStats" className={styles.timeStats}>
      <div data-steldra-ui="timeStatsHeader" className={styles.timeStatsHeader}>
        <div>
          <span data-steldra-ui="timeStatsEyebrow" className={styles.timeStatsEyebrow}>
            Statistiques
          </span>

          <h2 data-steldra-ui="timeStatsTitle" className={styles.timeStatsTitle}>
            Temps passé devant tes écrans
          </h2>
        </div>

        <div data-steldra-ui="timeStatsTotal" className={styles.timeStatsTotal}>
          <span>Temps total</span>

          <strong>
            {formatDuration(stats.totalMinutes)}
          </strong>
        </div>
      </div>

      <div data-steldra-ui="timeStatsGrid" className={styles.timeStatsGrid}>
        <article data-steldra-ui="timeStatCard" className={styles.timeStatCard}>
          

          <div>
            <span data-steldra-ui="timeStatLabel" className={styles.timeStatLabel}>
              Films
            </span>

            <strong data-steldra-ui="timeStatValue" className={styles.timeStatValue}>
              {formatDuration(stats.movieMinutes)}
            </strong>

            <small data-steldra-ui="timeStatDetail" className={styles.timeStatDetail}>
              {stats.watchedMovieCount} film
              {stats.watchedMovieCount > 1 ? 's' : ''}{' '}
              vu
              {stats.watchedMovieCount > 1 ? 's' : ''}
            </small>
          </div>
        </article>

        <article data-steldra-ui="timeStatCard" className={styles.timeStatCard}>
          

          <div>
            <span data-steldra-ui="timeStatLabel" className={styles.timeStatLabel}>
              Séries
            </span>

            <strong data-steldra-ui="timeStatValue" className={styles.timeStatValue}>
              {formatDuration(stats.seriesMinutes)}
            </strong>

            <small data-steldra-ui="timeStatDetail" className={styles.timeStatDetail}>
              {stats.watchedSeriesEpisodes}{' '}
              épisode
              {stats.watchedSeriesEpisodes > 1
                ? 's'
                : ''}
            </small>
          </div>
        </article>

        <article data-steldra-ui="timeStatCard" className={styles.timeStatCard}>
         

          <div>
            <span data-steldra-ui="timeStatLabel" className={styles.timeStatLabel}>
              Animés
            </span>

            <strong data-steldra-ui="timeStatValue" className={styles.timeStatValue}>
              {formatDuration(stats.animeMinutes)}
            </strong>

            <small data-steldra-ui="timeStatDetail" className={styles.timeStatDetail}>
              {stats.watchedAnimeEpisodes}{' '}
              épisode
              {stats.watchedAnimeEpisodes > 1
                ? 's'
                : ''}
            </small>
          </div>
        </article>

        <article data-steldra-ui="timeStatCard" className={styles.timeStatCard}>
        

          <div>
            <span data-steldra-ui="timeStatLabel" className={styles.timeStatLabel}>
              Dramas
            </span>

            <strong data-steldra-ui="timeStatValue" className={styles.timeStatValue}>
              {formatDuration(stats.dramaMinutes)}
            </strong>

            <small data-steldra-ui="timeStatDetail" className={styles.timeStatDetail}>
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
        <p data-steldra-ui="timeStatsNotice" className={styles.timeStatsNotice}>
          Certaines durées ne sont pas encore
          disponibles. Le total affiché correspond
          uniquement aux médias dont la durée est
          connue.
        </p>
      )}
    </section>
  );
}