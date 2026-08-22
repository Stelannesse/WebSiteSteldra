'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';

import MainNav from '../components/mainNav';
import TimeStats from '../components/timeStats';
import { createClient } from '../lib/supabase';
import { fetchAllPages } from '../lib/supabasePaging';
import { calculateViewingStats } from '../lib/viewingStats';
import type { MediaItem, MyListItem } from '../types/media';
import styles from '../page.module.css';

const TYPE_LABELS: Record<string, string> = {
  movie: 'Films',
  tv: 'Séries',
  drama: 'Dramas',
  anime: 'Animés',
};

const STATUS_LABELS: Record<string, string> = {
  vu: 'Vus',
  en_cours: 'En cours',
  a_voir: 'À voir',
  en_pause: 'En pause',
  abandonne: 'Abandonnés',
};

const formatCompactDuration = (minutes: number) => {
  if (minutes <= 0) return '0 h';
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  if (hours <= 0) return `${rest} min`;
  return rest ? `${hours} h ${rest.toString().padStart(2, '0')}` : `${hours} h`;
};

export default function StatistiquesPage() {
  const [supabase] = useState(() => createClient());
  const [myList, setMyList] = useState<Record<string, MyListItem>>({});
  const [watchedEpisodes, setWatchedEpisodes] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    const loadStatistics = async () => {
      setLoading(true);
      setError(null);

      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (cancelled) return;

        if (user) {
          const { data, error: supabaseError } = await fetchAllPages<any>((from, to) =>
            supabase
              .from('media_progress')
              .select('*')
              .eq('user_id', user.id)
              .order('media_id', { ascending: true })
              .range(from, to)
          );

          if (supabaseError) throw supabaseError;

          const loadedList: Record<string, MyListItem> = {};
          const loadedEpisodes: Record<string, boolean> = {};

          (data || []).forEach((item) => {
            const storedMedia = item.media_data as MediaItem | null;
            if (!storedMedia) return;

            const mediaType = storedMedia.type || item.media_type;
            const mediaId = item.media_id;
            if (!['movie', 'tv', 'drama', 'anime'].includes(mediaType)) return;

            const mediaKey = `${mediaType}_${mediaId}`;
            const media: MediaItem = {
              ...storedMedia,
              id: mediaId,
              type: mediaType,
            };

            loadedList[mediaKey] = {
              media,
              status: item.status || 'a_voir',
              watchCount: Number(item.watch_count) || 0,
            };

            Object.assign(
              loadedEpisodes,
              item.watched_episode || item.watched_episodes || {}
            );
          });

          if (!cancelled) {
            setMyList(loadedList);
            setWatchedEpisodes(loadedEpisodes);
          }
          return;
        }

        const savedList = localStorage.getItem('steldra_multimedia_list_v1');
        const savedEpisodes = localStorage.getItem('steldra_watched_episodes_v1');

        if (!cancelled) {
          if (savedList) setMyList(JSON.parse(savedList));
          if (savedEpisodes) setWatchedEpisodes(JSON.parse(savedEpisodes));
        }
      } catch (loadError) {
        console.error('Erreur chargement statistiques :', loadError);
        if (!cancelled) setError('Les statistiques n’ont pas pu être chargées.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    void loadStatistics();
    return () => { cancelled = true; };
  }, [supabase]);

  const stats = useMemo(
    () => calculateViewingStats(myList, watchedEpisodes),
    [myList, watchedEpisodes]
  );

  const typeCounts = useMemo(() => {
    const counts: Record<string, number> = { movie: 0, tv: 0, drama: 0, anime: 0 };
    Object.values(myList).forEach((entry) => {
      if (entry?.media?.type in counts) counts[entry.media.type] += 1;
    });
    return counts;
  }, [myList]);

  const statusCounts = useMemo(() => {
    const counts: Record<string, number> = {
      vu: 0,
      en_cours: 0,
      a_voir: 0,
      en_pause: 0,
      abandonne: 0,
    };
    Object.values(myList).forEach((entry) => {
      if (entry?.status && entry.status in counts) counts[entry.status] += 1;
    });
    return counts;
  }, [myList]);

  const maxTypeCount = Math.max(1, ...Object.values(typeCounts));
  const maxStatusCount = Math.max(1, ...Object.values(statusCounts));

  return (
    <>
      <MainNav />
      <main className={styles.stats2026Page}>
        <section className={styles.stats2026Hero}>
          <div className={styles.stats2026HeroCopy}>
            <span>VOTRE BILAN</span>
            <h1>Mes statistiques</h1>
            <p>Suivez simplement toutes vos habitudes de visionnage.</p>
            <div className={styles.stats2026HeroActions}>
              <Link href="/collection">Voir ma collection</Link>
              <Link href="/history">Historique</Link>
            </div>
          </div>
        </section>

        {loading ? (
          <div className={styles.stats2026State}>Chargement des statistiques…</div>
        ) : error ? (
          <div className={`${styles.stats2026State} ${styles.stats2026Error}`}>{error}</div>
        ) : (
          <>
            <section className={styles.stats2026SummaryGrid}>
              <article>
                <span>MÉDIAS VUS</span>
                <strong>{stats.watchedMediaCount}</strong>
                <small>sur {stats.totalCinemaMedia} dans la collection</small>
              </article>
              <article>
                <span>ÉPISODES VUS</span>
                <strong>{stats.watchedEpisodeCount}</strong>
                <small>épisodes réellement cochés</small>
              </article>
              <article>
                <span>TEMPS DE VISIONNAGE</span>
                <strong>{formatCompactDuration(stats.totalMinutes)}</strong>
                <small>durées connues uniquement</small>
              </article>
              <article>
                <span>PROGRESSION</span>
                <strong>{stats.completion}%</strong>
                <small>de ta collection cinéma terminée</small>
              </article>
            </section>

            <div className={styles.stats2026MainGrid}>
              <section className={styles.stats2026Panel}>
                <div className={styles.stats2026PanelHead}>
                  <div>
                    <span>COLLECTION</span>
                    <h2>Répartition par format</h2>
                  </div>
                  <strong>{stats.totalCinemaMedia} titres</strong>
                </div>
                <div className={styles.stats2026Bars}>
                  {Object.entries(typeCounts).map(([type, count]) => (
                    <div className={styles.stats2026BarRow} key={type}>
                      <div><span>{TYPE_LABELS[type]}</span><strong>{count}</strong></div>
                      <div className={styles.stats2026BarTrack}>
                        <span style={{ width: `${(count / maxTypeCount) * 100}%` }} />
                      </div>
                    </div>
                  ))}
                </div>
              </section>

              <section className={styles.stats2026Panel}>
                <div className={styles.stats2026PanelHead}>
                  <div>
                    <span>STATUTS</span>
                    <h2>Où en est ta collection ?</h2>
                  </div>
                </div>
                <div className={styles.stats2026Bars}>
                  {Object.entries(statusCounts).map(([status, count]) => (
                    <div className={styles.stats2026BarRow} key={status}>
                      <div><span>{STATUS_LABELS[status]}</span><strong>{count}</strong></div>
                      <div className={styles.stats2026BarTrack}>
                        <span style={{ width: `${(count / maxStatusCount) * 100}%` }} />
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            </div>

            <TimeStats myList={myList} watchedEpisodes={watchedEpisodes} />

            {stats.totalCinemaMedia === 0 && (
              <div className={styles.stats2026Empty}>
                <h2>Ton univers est encore vide</h2>
                <p>Ajoute un premier film ou une première série pour voir tes statistiques apparaître ici.</p>
                <Link href="/discover">Découvrir des médias</Link>
              </div>
            )}
          </>
        )}
      </main>
    </>
  );
}
