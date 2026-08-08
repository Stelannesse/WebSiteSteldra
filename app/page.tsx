'use client';

import Link from 'next/link';
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import MainNav from './components/mainNav';
import { createClient } from './lib/supabase';
import styles from './page.module.css';
import type { MediaItem, WatchStatus } from './types/media';
import { getPosterUrl, usePosterFallback } from './lib/poster';

type ProgressRow = {
  id?: string | number;
  media_id: string;
  media_type: string;
  status: WatchStatus;
  media_data: MediaItem | null;
  watched_episode?: Record<string, boolean> | null;
  watched_episodes?: Record<string, boolean> | null;
  manga_progress?: number | null;
  watch_count?: number | null;
  created_at?: string | null;
  updated_at?: string | null;
};

type CustomListRow = {
  id: string;
  name: string;
  description?: string | null;
  created_at?: string;
};

type CustomListItemRow = {
  id: string;
  list_id: string;
  media_id: string;
  media_type: string;
  media_data: MediaItem;
  position: number;
};

type Recommendation = MediaItem & {
  recommendation_reason?: 'collection' | 'recommended';
};

const mediaKey = (media: { type: string; id: string | number }) =>
  `${media.type}_${media.id}`;

const posterUrl = (media: MediaItem) => getPosterUrl(media, 'w342');

const dateValue = (row: ProgressRow, mode: 'added' | 'activity') => {
  const media = row.media_data || ({} as MediaItem);
  const value =
    mode === 'activity'
      ? media.steldra_last_interaction_at || row.updated_at || row.created_at
      : media.steldra_added_at || row.created_at;

  return value ? new Date(value).getTime() : 0;
};

function getSeriesProgress(row: ProgressRow) {
  const episodes = row.watched_episode || row.watched_episodes || {};
  const prefix = `${row.media_type}_${row.media_id}_S`;
  let watchedCount = 0;
  let latestSeason = 1;
  let latestEpisode = 0;

  Object.entries(episodes).forEach(([key, watched]) => {
    if (!watched || !key.startsWith(prefix)) return;

    const match = key.match(/_S(\d+)E(\d+)$/);
    if (!match) return;

    watchedCount += 1;
    const season = Number(match[1]);
    const episode = Number(match[2]);

    if (
      season > latestSeason ||
      (season === latestSeason && episode > latestEpisode)
    ) {
      latestSeason = season;
      latestEpisode = episode;
    }
  });

  return {
    watchedCount,
    latestSeason,
    latestEpisode,
    nextEpisode: latestEpisode + 1,
  };
}


const formatMinutes = (minutes: number) => {
  if (minutes <= 0) return '0 min';
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  if (!hours) return `${rest} min`;
  return rest ? `${hours} h ${rest.toString().padStart(2, '0')}` : `${hours} h`;
};

const watchedMinutesFor = (row: ProgressRow | undefined, media: MediaItem) => {
  if (!row) return 0;
  if (media.type === 'manga' || media.type === 'manhwa') return 0;
  if (media.type === 'movie') {
    const count = Math.max(Number(row.watch_count) || (row.status === 'vu' ? 1 : 0), 0);
    return Math.round((Number(media.runtime) || 0) * count);
  }
  const episodes = row.watched_episode || row.watched_episodes || {};
  const watchedEpisodes = Object.values(episodes).filter(Boolean).length;
  const fallbackEpisodes = row.status === 'vu' ? Number(media.episodes) || 0 : 0;
  return Math.round((Number(media.episode_runtime) || 0) * Math.max(watchedEpisodes, fallbackEpisodes));
};
export default function HomePage() {
  const [supabase] = useState(() => createClient());
  const [loading, setLoading] = useState(true);
  const [userName, setUserName] = useState('');
  const [progressRows, setProgressRows] = useState<ProgressRow[]>([]);
  const [customLists, setCustomLists] = useState<CustomListRow[]>([]);
  const [customListItems, setCustomListItems] = useState<CustomListItemRow[]>([]);
  const [recommendations, setRecommendations] = useState<Recommendation[]>([]);
  const [recommendationSource, setRecommendationSource] = useState<string>('');
  const [savingKey, setSavingKey] = useState<string | null>(null);
  const [dashboardRefreshToken, setDashboardRefreshToken] = useState(0);
  const hasLoadedDashboard = useRef(false);

  useEffect(() => {
    const refreshDashboard = () => {
      setDashboardRefreshToken((value) => value + 1);
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        refreshDashboard();
      }
    };

    window.addEventListener('steldra:progress-updated', refreshDashboard);
    window.addEventListener('focus', refreshDashboard);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      window.removeEventListener('steldra:progress-updated', refreshDashboard);
      window.removeEventListener('focus', refreshDashboard);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    const loadDashboard = async () => {
      if (!hasLoadedDashboard.current) {
        setLoading(true);
      }

      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user || cancelled) {
        setLoading(false);
        return;
      }

      setUserName(
        user.user_metadata?.full_name ||
          user.email?.split('@')[0] ||
          ''
      );

      const [progressResponse, listsResponse, listItemsResponse, likesResponse] =
        await Promise.all([
          supabase
            .from('media_progress')
            .select('*')
            .eq('user_id', user.id),
          supabase
            .from('custom_lists')
            .select('*')
            .eq('user_id', user.id)
            .order('updated_at', { ascending: false }),
          supabase
            .from('custom_list_items')
            .select('*')
            .order('position', { ascending: true }),
          supabase
            .from('media_reviews')
            .select('*')
            .eq('user_id', user.id)
            .eq('rating', 'like')
            .order('created_at', { ascending: false })
            .limit(5),
        ]);

      if (cancelled) return;

      const rows = (progressResponse.data || []) as ProgressRow[];
      const lists = (listsResponse.data || []) as CustomListRow[];
      const listIds = new Set(lists.map((list) => list.id));
      const items = ((listItemsResponse.data || []) as CustomListItemRow[]).filter(
        (item) => listIds.has(item.list_id)
      );

      setProgressRows(rows);
      setCustomLists(lists);
      setCustomListItems(items);

      const likedRows = (likesResponse.data || []) as Array<{
        media_id: string;
        media_type: string;
      }>;

      const likedSource = likedRows.find((review) =>
        rows.some(
          (row) =>
            row.media_id === review.media_id &&
            row.media_type === review.media_type
        )
      );

      if (likedSource) {
        const sourceRow = rows.find(
          (row) =>
            row.media_id === likedSource.media_id &&
            row.media_type === likedSource.media_type
        );

        setRecommendationSource(sourceRow?.media_data?.title || 'un titre aimé');

        try {
          const response = await fetch(
            `/api/recommendations?id=${encodeURIComponent(
              likedSource.media_id
            )}&type=${encodeURIComponent(likedSource.media_type)}`
          );

          if (response.ok) {
            const data = await response.json();
            setRecommendations((data.results || []).slice(0, 10));
          }
        } catch (error) {
          console.error('Recommandations accueil indisponibles :', error);
        }
      }

      hasLoadedDashboard.current = true;
      setLoading(false);
    };

    void loadDashboard();

    return () => {
      cancelled = true;
    };
  }, [supabase, dashboardRefreshToken]);

  const progressMap = useMemo(() => {
    const map = new Map<string, ProgressRow>();

    progressRows.forEach((row) => {
      map.set(`${row.media_type}_${row.media_id}`, row);
    });

    return map;
  }, [progressRows]);

  const continueRows = useMemo(
    () =>
      progressRows
        .filter((row) => row.status === 'en_cours' && row.media_data)
        .sort((a, b) => dateValue(b, 'activity') - dateValue(a, 'activity'))
        .slice(0, 8),
    [progressRows]
  );

  const recentlyWatched = useMemo(
    () =>
      progressRows
        .filter((row) => row.status === 'vu' && row.media_data)
        .sort((a, b) => dateValue(b, 'activity') - dateValue(a, 'activity'))
        .slice(0, 8),
    [progressRows]
  );

  const recentlyAdded = useMemo(
    () =>
      [...progressRows]
        .filter((row) => row.media_data)
        .sort((a, b) => dateValue(b, 'added') - dateValue(a, 'added'))
        .slice(0, 8),
    [progressRows]
  );

  const nextFromLists = useMemo(() => {
    return customLists
      .map((list) => {
        const nextItem = customListItems
          .filter((item) => item.list_id === list.id)
          .sort((a, b) => a.position - b.position)
          .find((item) => {
            const row = progressMap.get(
              `${item.media_type}_${item.media_id}`
            );
            return row?.status !== 'vu';
          });

        return nextItem ? { list, item: nextItem } : null;
      })
      .filter(Boolean)
      .slice(0, 6) as Array<{
      list: CustomListRow;
      item: CustomListItemRow;
    }>;
  }, [customLists, customListItems, progressMap]);

  const addRecommendationToWatch = async (media: Recommendation) => {
    const key = mediaKey(media);
    if (savingKey) return;

    setSavingKey(key);

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) return;

      const now = new Date().toISOString();
      const enrichedMedia: MediaItem = {
        ...media,
        steldra_added_at: now,
        steldra_last_interaction_at: now,
      };

      const { data, error } = await supabase
        .from('media_progress')
        .upsert(
          {
            user_id: user.id,
            media_id: String(media.id),
            media_type: media.type,
            media_data: enrichedMedia,
            status: 'a_voir',
            watch_count: 0,
          },
          { onConflict: 'user_id,media_id' }
        )
        .select('*')
        .single();

      if (error) throw error;

      setProgressRows((current) => {
        const without = current.filter(
          (row) =>
            !(
              row.media_id === String(media.id) &&
              row.media_type === media.type
            )
        );

        return [data as ProgressRow, ...without];
      });
    } catch (error) {
      console.error('Impossible d’ajouter la recommandation :', error);
    } finally {
      setSavingKey(null);
    }
  };

  return (
    <>
      <MainNav />

      <main className={styles.dashboardHome}>
        {loading ? (
          <div className={styles.dashboardLoading}>Chargement de votre espace...</div>
        ) : (
          <>
            <DashboardSection
              title="Continuer"
              subtitle="Vos séries, films et lectures en cours"
              empty="Aucun contenu en cours pour le moment."
            >
              {continueRows.map((row) => {
                const media = row.media_data as MediaItem;
                const seriesProgress = getSeriesProgress(row);
                const isReading = media.type === 'manga' || media.type === 'manhwa';
                const isSeries = ['tv', 'drama', 'anime'].includes(media.type);
                const currentChapter = Number(row.manga_progress) || 0;
                const total = isReading
                  ? Number(media.chapters) || 0
                  : isSeries
                    ? Number(media.episodes) || 0
                    : 0;
                const current = isReading ? currentChapter : seriesProgress.watchedCount;
                const percent = total > 0 ? Math.min(100, Math.round((current / total) * 100)) : 0;

                return (
                  <Link
                    key={`${row.media_type}_${row.media_id}`}
                    href={`/media/${media.type}/${media.id}`}
                    className={styles.continueCard}
                  >
                    <img src={posterUrl(media)} alt={media.title} onError={(event) => usePosterFallback(event.currentTarget)} />
                    <div className={styles.continueInfo}>
                      <span className={styles.mediaTypeLabel}>{media.type}</span>
                      <strong>{media.title}</strong>
                      <p>
                        {isReading
                          ? `Chapitre ${currentChapter}${media.chapters ? ` sur ${media.chapters}` : ''}`
                          : isSeries
                            ? `Saison ${seriesProgress.latestSeason} · épisode ${Math.max(1, seriesProgress.nextEpisode)} à poursuivre`
                            : 'Lecture ou visionnage en cours'}
                      </p>
                      {total > 0 && (
                        <div className={styles.progressTrack}>
                          <span style={{ width: `${percent}%` }} />
                        </div>
                      )}
                      {total > 0 && <small>{current} / {total}</small>}
                    </div>
                  </Link>
                );
              })}
            </DashboardSection>

            <DashboardSection
              title="À regarder ensuite"
              subtitle="Le prochain titre non vu de vos listes ordonnées"
              empty="Vos listes n’ont pas encore de prochain média à proposer."
            >
              {nextFromLists.map(({ list, item }) => (
                <Link
                  key={`${list.id}_${item.id}`}
                  href={`/media/${item.media_data.type}/${item.media_data.id}`}
                  className={styles.nextCard}
                >
                  <img src={posterUrl(item.media_data)} alt={item.media_data.title} onError={(event) => usePosterFallback(event.currentTarget)} />
                  <div>
                    <span>{list.name}</span>
                    <strong>{item.media_data.title}</strong>
                    <small>Position {item.position + 1}</small>
                  </div>
                </Link>
              ))}
            </DashboardSection>

            <DashboardSection
              title={recommendationSource ? `Parce que vous avez aimé ${recommendationSource}` : 'Découvrir'}
              subtitle="Des titres proches de vos goûts et des sagas que vous suivez"
              empty="Ajoutez un avis J’aime sur une fiche pour personnaliser cette section."
            >
              {recommendations.map((media) => {
                const key = mediaKey(media);
                const alreadyInCollection = progressMap.has(key);

                return (
                  <div key={key} className={styles.recommendationCard}>
                    <Link href={`/media/${media.type}/${media.id}`}>
                      <img src={posterUrl(media)} alt={media.title} onError={(event) => usePosterFallback(event.currentTarget)} />
                      <strong>{media.title}</strong>
                    </Link>
                    <button
                      type="button"
                      disabled={alreadyInCollection || savingKey === key}
                      onClick={() => void addRecommendationToWatch(media)}
                    >
                      {alreadyInCollection ? 'Dans la collection' : savingKey === key ? 'Ajout...' : 'Ajouter à voir'}
                    </button>
                  </div>
                );
              })}
            </DashboardSection>

            <section className={styles.dashboardSection}>
              <div className={styles.sectionHeading}>
                <div>
                  <h2>Vos listes</h2>
                  <p>Retrouvez vos sélections et leur prochain média.</p>
                </div>
                <Link href="/lists">Voir toutes les listes</Link>
              </div>

              {customLists.length === 0 ? (
                <p className={styles.emptyDashboard}>Aucune liste personnalisée pour le moment.</p>
              ) : (
                <div className={styles.listPreviewGrid}>
                  {customLists.slice(0, 6).map((list) => {
                    const preview = customListItems
                      .filter((item) => item.list_id === list.id)
                      .sort((a, b) => a.position - b.position)
                      .slice(0, 3);

                    const watched = customListItems
                      .filter((item) => item.list_id === list.id)
                      .filter((item) => progressMap.get(`${item.media_type}_${item.media_id}`)?.status === 'vu').length;

                    const listItems = customListItems.filter((item) => item.list_id === list.id);
                    const total = listItems.length;
                    const watchedMinutes = listItems.reduce((sum, item) => {
                      const row = progressMap.get(`${item.media_type}_${item.media_id}`);
                      return sum + watchedMinutesFor(row, item.media_data);
                    }, 0);

                    return (
                      <Link key={list.id} href={`/lists/${list.id}`} className={styles.homeListCard}>
                        <div className={styles.homeListPosters}>
                          {preview.length > 0 ? preview.map((item) => (
                            <img key={item.id} src={posterUrl(item.media_data)} alt="" onError={(event) => usePosterFallback(event.currentTarget)} />
                          )) : <span>Aucun média</span>}
                        </div>
                        <strong>{list.name}</strong>
                        <small className={styles.homeListCount}>{total} média{total > 1 ? 's' : ''}</small>
                        <div className={styles.homeListProgressLine}>
                          <span>{watched} / {total} vus</span>
                          <span>•</span>
                          <span>{total > 0 ? Math.round((watched / total) * 100) : 0}%</span>
                        </div>
                        <small className={styles.homeListTime}>◷ {formatMinutes(watchedMinutes)} regardées</small>
                      </Link>
                    );
                  })}
                </div>
              )}
            </section>

            <DashboardSection
              title="Ajoutés récemment"
              subtitle="Les derniers médias entrés dans votre collection"
              empty="Votre collection est encore vide."
            >
              {recentlyAdded.map((row) => (
                <PosterCard key={`${row.media_type}_${row.media_id}`} media={row.media_data as MediaItem} />
              ))}
            </DashboardSection>


            <DashboardSection
              title="Vu récemment"
              subtitle="Les derniers titres que vous avez terminés"
              empty="Aucun média terminé récemment."
            >
              {recentlyWatched.map((row) => (
                <PosterCard key={`${row.media_type}_${row.media_id}`} media={row.media_data as MediaItem} />
              ))}
            </DashboardSection>
          </>
        )}
      </main>
    </>
  );
}

function DashboardSection({
  title,
  subtitle,
  empty,
  children,
}: {
  title: string;
  subtitle: string;
  empty: string;
  children: ReactNode;
}) {
  const count = Array.isArray(children) ? children.length : 0;

  return (
    <section className={styles.dashboardSection}>
      <div className={styles.sectionHeading}>
        <div>
          <h2>{title}</h2>
          <p>{subtitle}</p>
        </div>
      </div>

      {count === 0 ? (
        <p className={styles.emptyDashboard}>{empty}</p>
      ) : (
        <div className={styles.dashboardRail}>{children}</div>
      )}
    </section>
  );
}

function PosterCard({ media }: { media: MediaItem }) {
  return (
    <Link href={`/media/${media.type}/${media.id}`} className={styles.dashboardPosterCard}>
      <img src={posterUrl(media)} alt={media.title} onError={(event) => usePosterFallback(event.currentTarget)} />
      <strong>{media.title}</strong>
      <span>{media.type}</span>
    </Link>
  );
}
