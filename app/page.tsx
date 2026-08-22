'use client';

import Link from 'next/link';
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import MainNav from './components/mainNav';
import { createClient } from './lib/supabase';
import styles from './page.module.css';
import type { MediaItem, WatchStatus } from './types/media';
import { getPosterUrl, usePosterFallback } from './lib/poster';
import { fetchAllPages } from './lib/supabasePaging';
import { calculateViewingStats } from './lib/viewingStats';

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

type WatchHistoryRow = {
  id: string;
  media_id: string;
  media_type: string;
  media_data: MediaItem | null;
  watched_at: string;
};

type Recommendation = MediaItem & {
  recommendation_reason?: 'collection' | 'recommended';
};

const mediaKey = (media: { type: string; id: string | number }) =>
  `${media.type}_${media.id}`;

const posterUrl = (media: MediaItem) => getPosterUrl(media, 'w342');

const HOME_GENRES = [
  'Action', 'Aventure', 'Animation', 'Comédie', 'Crime', 'Documentaire',
  'Drame', 'Fantastique', 'Histoire', 'Horreur', 'Romance', 'Science-fiction',
  'Thriller', 'BL', 'GL', 'Super-héros', 'Vampires', 'Zombies', 'Noël',
  'Arts martiaux', 'Espace', 'Voyage dans le temps',
];

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

const normalizeStoredMinutes = (value: unknown, kind: 'movie' | 'episode') => {
  let minutes = Number(value) || 0;
  if (!Number.isFinite(minutes) || minutes <= 0) return 0;

  // Certaines anciennes fiches ont pu conserver une durée exprimée en secondes.
  // Une durée de film > 10 h ou d'épisode > 5 h est donc ramenée en minutes.
  const suspiciousThreshold = kind === 'movie' ? 600 : 300;
  if (minutes > suspiciousThreshold) {
    minutes = minutes / 60;
  }

  return Math.round(minutes);
};

const firstPositiveNumber = (...values: unknown[]) => {
  for (const value of values) {
    const number = Number(value);
    if (Number.isFinite(number) && number > 0) return number;
  }
  return 0;
};

const watchedMinutesFor = (row: ProgressRow | undefined, listMedia: MediaItem) => {
  if (!row) return 0;

  const progressMedia = row.media_data || ({} as MediaItem);
  const mediaType = progressMedia.type || listMedia.type || row.media_type;

  if (mediaType === 'manga' || mediaType === 'manhwa') return 0;

  if (mediaType === 'movie') {
    if (row.status !== 'vu') return 0;

    // Important : une fiche media_progress plus récente peut avoir runtime=null.
    // Dans ce cas on reprend la durée encore présente dans l'élément de liste.
    const runtime = firstPositiveNumber(
      progressMedia.runtime,
      listMedia.runtime
    );

    return normalizeStoredMinutes(runtime, 'movie');
  }

  const episodes = row.watched_episode || row.watched_episodes || {};
  const prefix = `${row.media_type}_${row.media_id}_S`;

  const watchedEpisodes = Object.entries(episodes).filter(
    ([key, watched]) => watched && key.startsWith(prefix)
  ).length;

  // Même principe pour les séries : on ne laisse pas un null/0 récent
  // écraser une ancienne durée d'épisode valide stockée dans la liste.
  const episodeRuntime = normalizeStoredMinutes(
    firstPositiveNumber(
      progressMedia.episode_runtime,
      listMedia.episode_runtime
    ),
    'episode'
  );

  const totalEpisodes = Math.max(
    0,
    Math.round(
      firstPositiveNumber(
        progressMedia.episodes,
        listMedia.episodes
      )
    )
  );

  const episodesToCount =
    watchedEpisodes > 0
      ? watchedEpisodes
      : row.status === 'vu'
        ? totalEpisodes
        : 0;

  // Si aucun épisode n'est réellement compté, la durée regardée reste nulle.
  if (episodesToCount <= 0) return 0;

  // Si la durée d'épisode manque réellement dans les deux sources, on garde 0
  // plutôt que d'inventer une durée. Elle sera renseignée dès que la fiche est
  // ouverte et mise à jour depuis TMDB.
  if (episodeRuntime <= 0) return 0;

  return episodeRuntime * episodesToCount;
};
export default function HomePage() {
  const [supabase] = useState(() => createClient());
  const [loading, setLoading] = useState(true);
  const [userName, setUserName] = useState('');
  const [profileOpen, setProfileOpen] = useState(false);
  const [progressRows, setProgressRows] = useState<ProgressRow[]>([]);
  const [customLists, setCustomLists] = useState<CustomListRow[]>([]);
  const [customListItems, setCustomListItems] = useState<CustomListItemRow[]>([]);
  const [watchHistory, setWatchHistory] = useState<WatchHistoryRow[]>([]);
  const [recommendations, setRecommendations] = useState<Recommendation[]>([]);
  const [recommendationSource, setRecommendationSource] = useState<string>('');
  const [savingKey, setSavingKey] = useState<string | null>(null);
  const [dashboardRefreshToken, setDashboardRefreshToken] = useState(0);
  const [visibleListsCount, setVisibleListsCount] = useState(6);
  const [homeContinueType, setHomeContinueType] = useState<'series' | 'movies'>('series');
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

      const [progressResponse, listsResponse, likesResponse] =
  await Promise.all([
    fetchAllPages<ProgressRow>((from, to) =>
      supabase
        .from('media_progress')
        .select('*')
        .eq('user_id', user.id)
        .order('media_id', { ascending: true })
        .range(from, to)
    ),

    supabase
      .from('custom_lists')
      .select('*')
      .eq('user_id', user.id)
      .order('updated_at', { ascending: false }),

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

let items: CustomListItemRow[] = [];

/*
 * On récupère UNIQUEMENT les éléments appartenant
 * aux listes de l'utilisateur connecté.
 */
if (lists.length > 0) {
  const listIds = lists.map((list) => list.id);

  const { data: listItemsData, error: listItemsError } = await fetchAllPages<CustomListItemRow>((from, to) =>
    supabase
      .from('custom_list_items')
      .select('*')
      .in('list_id', listIds)
      .order('position', { ascending: true })
      .range(from, to)
  );

  if (listItemsError) {
    console.error(
      'Erreur chargement éléments des listes :',
      listItemsError
    );
  } else {
    items = (listItemsData || []) as CustomListItemRow[];
  }
}

if (cancelled) return;

setProgressRows(rows);
setCustomLists(lists);
setCustomListItems(items);

const { data: historyData, error: historyError } = await supabase
  .from('watch_history')
  .select('id,media_id,media_type,media_data,watched_at')
  .eq('user_id', user.id)
  .order('watched_at', { ascending: false })
  .limit(20);

if (!historyError && !cancelled) {
  setWatchHistory((historyData || []) as WatchHistoryRow[]);
}

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
    () => watchHistory.filter((row) => row.media_data).slice(0, 20),
    [watchHistory]
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

  const handleLogout = async () => {
    await supabase.auth.signOut();
    window.location.href = '/login';
  };

  const displayName = userName.trim() || 'Utilisateur';
  const profileInitials = displayName
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join('') || 'U';

  // Une seule ligne par média : évite qu'une ancienne ligne ou un doublon
  // fasse gonfler les compteurs de l'accueil.
  const uniqueProgressRows = Array.from(
    new Map(progressRows.map((row) => [`${row.media_type}_${row.media_id}`, row])).values()
  );

  // Source de vérité commune Accueil / Collection / Statistiques.
  const statsMyList = uniqueProgressRows.reduce<Record<string, any>>((acc, row) => {
    if (!row.media_data) return acc;
    const media = {
      ...row.media_data,
      id: row.media_id,
      type: (row.media_data.type || row.media_type) as any,
    };
    acc[`${media.type}_${media.id}`] = {
      media,
      status: row.status,
      watchCount: Number(row.watch_count) || 0,
    };
    return acc;
  }, {});

  const statsWatchedEpisodes = uniqueProgressRows.reduce<Record<string, boolean>>((acc, row) => {
    Object.assign(acc, row.watched_episode || {});
    Object.assign(acc, row.watched_episodes || {});
    return acc;
  }, {});

  const viewingStats = calculateViewingStats(statsMyList, statsWatchedEpisodes);
  const watchedMediaCount = viewingStats.watchedMediaCount;
  const seriesCount = viewingStats.watchedSeriesCount;
  const episodesWatched = viewingStats.watchedEpisodeCount;
  const totalWatchedMinutes = viewingStats.totalMinutes;

  const cinemaContinueRows = continueRows.filter((row) => !['manga', 'manhwa'].includes(row.media_type));
  const movieContinueRows = cinemaContinueRows.filter((row) => row.media_type === 'movie');
  const seriesContinueRows = cinemaContinueRows.filter((row) => ['tv', 'drama', 'anime'].includes(row.media_type));
  const activeContinueRows = homeContinueType === 'movies' ? movieContinueRows : seriesContinueRows;
  const featuredContinue = activeContinueRows[0];
  const favoriteMedia = uniqueProgressRows
    .filter((row) => row.media_data && Boolean((row.media_data as MediaItem & { favorite?: boolean }).favorite))
    .map((row) => row.media_data as MediaItem)
    .slice(0, 8);
  const compactLists = customLists.slice(0, 4);

  return (
    <>
      <MainNav />

      <main className={styles.cinemaHome}>
        <section className={styles.cinemaTopbar}>
          <Link href="/" className={styles.cinemaLogo}>
            <span className={styles.cinemaSpark}>✦</span>
            <span>
              <strong>STELDRA</strong>
              <small>Votre univers cinéma</small>
            </span>
          </Link>

          <div className={styles.profileContainer}>
            <button
              type="button"
              className={styles.profileButton}
              onClick={() => setProfileOpen((current) => !current)}
              aria-label="Ouvrir le menu utilisateur"
              aria-expanded={profileOpen}
            >
              <span className={styles.profileInitials}>{profileInitials}</span>
              <span className={`${styles.profileChevron} ${profileOpen ? styles.profileChevronOpen : ''}`}>▾</span>
            </button>
            {profileOpen && (
              <div className={styles.profileMenu}>
                <div className={styles.profileMenuHeader}>
                  <strong>{displayName}</strong>
                  <span>Mon compte STELDRA</span>
                </div>
                <Link href="/settings" className={styles.profileMenuLink} onClick={() => setProfileOpen(false)}>
                  Paramètres
                </Link>
                <button
                  type="button"
                  className={styles.profileMenuItem}
                  onClick={() => {
                    setProfileOpen(false);
                    void handleLogout();
                  }}
                >
                  Déconnexion
                </button>
              </div>
            )}
          </div>
        </section>

        <section className={styles.cinemaHero}>
          <div className={styles.cinemaHeroGlow} />
          <div className={styles.cinemaHeroContent}>
            <span className={styles.cinemaEyebrow}>MON UNIVERS</span>
            <h1>Bienvenue, {displayName} !</h1>
            <p>Explorez et retrouvez toutes vos histoires.</p>
            <span className={styles.heroLine}><i /></span>
          </div>
        </section>

        {loading ? (
          <div className={styles.dashboardLoading}>Chargement de votre espace...</div>
        ) : (
          <div className={styles.cinemaDashboardGrid}>
            <div className={styles.cinemaMainColumn}>
              <form className={styles.cinemaSearch} action="/collection">
                <span aria-hidden="true">⌕</span>
                <input name="q" placeholder="Rechercher un film, une série..." aria-label="Rechercher" />
                <button type="submit">Rechercher</button>
              </form>

              <div className={styles.typeChips}>
                <Link href="/collection">Films</Link>
                <Link href="/collection">Séries</Link>
                <Link href="/collection">Drama</Link>
                <Link href="/collection">Animés</Link>
                <Link href="/collection">Documentaires</Link>
                <Link href="/talents">Talents</Link>
              </div>

              <section className={`${styles.cinemaPanel} ${styles.moodPanel}`}>
                <div className={styles.panelTitleRow}>
                  <div>
                    <span className={styles.cinemaEyebrow}>DÉCOUVRIR</span>
                    <h2>J’ai envie de...</h2>
                  </div>
                  <Link href="/discover" className={styles.ghostAction}>Nouvelles propositions ✦</Link>
                </div>
                <div className={styles.genreCloud}>
                  {HOME_GENRES.map((genre) => (
                    <Link key={genre} href={`/discover?genres=${encodeURIComponent(genre)}`} className={styles.genrePill}>{genre}</Link>
                  ))}
                </div>
              </section>

              <div className={styles.cinemaSplitRow}>
                <section className={`${styles.cinemaPanel} ${styles.continueSpotlight}`}>
                  <div className={styles.panelTitleRow}>
                    <h2>Continuer mon visionnage</h2>
                    <div className={styles.continueTabs} role="tablist" aria-label="Type de média à reprendre">
                      <button type="button" className={homeContinueType === 'series' ? styles.continueTabActive : ''} onClick={() => setHomeContinueType('series')}>Séries</button>
                      <button type="button" className={homeContinueType === 'movies' ? styles.continueTabActive : ''} onClick={() => setHomeContinueType('movies')}>Films</button>
                    </div>
                  </div>
                  {featuredContinue?.media_data ? (() => {
                    const row = featuredContinue;
                    const media = row.media_data as MediaItem;
                    const isMovie = media.type === 'movie';
                    const progress = getSeriesProgress(row);
                    const total = Number(media.episodes) || 0;
                    const percent = isMovie ? 0 : (total > 0 ? Math.min(100, Math.round((progress.watchedCount / total) * 100)) : 0);
                    return (
                      <Link href={`/media/${media.type}/${media.id}`} className={styles.featuredContinueCard}>
                        <img src={posterUrl(media)} alt={media.title} onError={(event) => usePosterFallback(event.currentTarget)} />
                        <div>
                          <strong>{media.title}</strong>
                          <span>{isMovie ? `Film${media.runtime ? ` · ${formatMinutes(normalizeStoredMinutes(media.runtime, 'movie'))}` : ''}` : `Saison ${progress.latestSeason} · épisode ${Math.max(1, progress.nextEpisode)}`}</span>
                          {!isMovie && <div className={styles.progressTrack}><span style={{ width: `${percent}%` }} /></div>}
                          <small>{isMovie ? 'Film en cours' : (percent > 0 ? `${percent}% terminé` : 'Reprendre')}</small>
                          <b>▶ Regarder</b>
                        </div>
                      </Link>
                    );
                  })() : <p className={styles.emptyDashboard}>Aucun visionnage en cours.</p>}
                </section>

                <section className={`${styles.cinemaPanel} ${styles.recentPanel}`}>
                  <div className={styles.panelTitleRow}>
                    <h2>Vu récemment</h2>
                    <Link href="/history">Voir tout</Link>
                  </div>
                  <div className={styles.miniPosterRail}>
                    {recentlyWatched.slice(0, 5).map((row) => row.media_data && (
                      <PosterCard key={row.id || `${row.media_type}_${row.media_id}_${row.watched_at}`} media={row.media_data} />
                    ))}
                  </div>
                </section>
              </div>

              <section className={`${styles.cinemaPanel} ${styles.favoritePanel}`}>
                <div className={styles.panelTitleRow}>
                  <div>
                    <span className={styles.cinemaEyebrow}>POUR VOUS</span>
                    <h2>Mes favoris</h2>
                  </div>
                  <Link href="/discover">Voir tout</Link>
                </div>
                <div className={styles.posterShowcase}>
                  {favoriteMedia.length ? favoriteMedia.map((media) => (
                    <PosterCard key={`${media.type}_${media.id}`} media={media} />
                  )) : <p className={styles.emptyDashboard}>Aucun favori pour le moment. Ajoutez une étoile depuis votre collection.</p>}
                </div>
              </section>
            </div>

            <aside className={styles.cinemaSidebar}>
              <section className={`${styles.cinemaPanel} ${styles.statsPanel}`}>
                <div className={styles.panelTitleRow}>
                  <h2>Mes statistiques</h2>
                  <Link href="/statistiques">Voir tout</Link>
                </div>
                <div className={styles.statGrid}>
                  <div><strong>{watchedMediaCount}</strong><span>Médias vus</span></div>
                  <div><strong>{Math.round(totalWatchedMinutes / 60)} h</strong><span>Visionnage</span></div>
                  <div><strong>{episodesWatched.toLocaleString('fr-FR')}</strong><span>Épisodes vus</span></div>
                  <div><strong>{seriesCount}</strong><span>Séries terminées</span></div>
                </div>
              </section>

              <section className={`${styles.cinemaPanel} ${styles.sidebarLists}`}>
                <div className={styles.panelTitleRow}>
                  <h2>Mes listes</h2>
                  <Link href="/lists">Voir tout</Link>
                </div>
                <div className={styles.sidebarListRows}>
                  {compactLists.length ? compactLists.map((list) => {
                    const total = customListItems.filter((item) => item.list_id === list.id).length;
                    return (
                      <Link href={`/lists/${list.id}`} key={list.id}>
                        <span>▤</span><strong>{list.name}</strong><small>{total}</small><b>›</b>
                      </Link>
                    );
                  }) : <p className={styles.emptyDashboard}>Aucune liste.</p>}
                </div>
              </section>

              <section className={`${styles.cinemaPanel} ${styles.lastAddedPanel}`}>
                <div className={styles.panelTitleRow}>
                  <h2>Derniers ajouts</h2>
                  <Link href="/collection">Voir tout</Link>
                </div>
                <div className={styles.lastAddedList}>
                  {recentlyAdded.slice(0, 5).map((row) => row.media_data && (
                    <Link href={`/media/${row.media_data.type}/${row.media_data.id}`} key={row.id || `${row.media_type}_${row.media_id}`}>
                      <img src={posterUrl(row.media_data)} alt="" onError={(event) => usePosterFallback(event.currentTarget)} />
                      <div><strong>{row.media_data.title}</strong><span>{row.media_data.type}</span></div>
                      <b>⋮</b>
                    </Link>
                  ))}
                </div>
              </section>
            </aside>
          </div>
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
