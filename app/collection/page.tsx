'use client'; // Permet d'utiliser les fonctionnalités côté client

import { createClient } from '../lib/supabase';
import { useState, useEffect, useMemo } from 'react'; // Gérer les données et les actions
import styles from '../page.module.css'; //Importer le style de la page
import MediaCard from '../components/mediaCard';
import useReviews from '../hooks/useReviews';
import MediaModal from '../components/mediaModal';
import useMediaProgress from '../hooks/useMediaProgress';
import type { MediaType } from '../types/media';
import MainNav from '../components/mainNav';
import Link from 'next/link';
import { sortMediaAlphabetically } from "../lib/sortMedia";
import { getPosterUrl, usePosterFallback } from '../lib/poster';
import { fetchAllPages } from '../lib/supabasePaging';
import type {
  MediaItem,
  MyListItem,
  WatchStatus,
  FilterStatus,
} from '../types/media';

import {
  searchMedia,
  getMediaDetails,
  getSeasonEpisodes,
} from '../lib/mediaService';

export default function Home() {
const [supabase] = useState(() => createClient());
  const [query, setQuery] = useState(''); // État pour la recherche
  const [results, setResults] = useState<MediaItem[]>([]); // État pour les résultats de recherche
  const [loading, setLoading] = useState(false); // État pour indiquer si la recherche est en cours
  const [userName, setUserName] = useState<string | null>(null); // État pour stocker le nom de l'utilisateur connecté
  const [userId, setUserId] = useState<string | null>(null); // État pour stocker l'ID de l'utilisateur connecté
  const [userCreatedAt, setUserCreatedAt] = useState<string | null>(null); // État pour stocker la date de création du compte de l'utilisateur connecté
  const [showScrollTop, setShowScrollTop] = useState(false);
  const [initialDataReady, setInitialDataReady] = useState(false);
  const [pendingScrollRestore, setPendingScrollRestore] = useState<number | null>(null);
  const [collectionStateRestored, setCollectionStateRestored] = useState(false);
  const [visibleCount, setVisibleCount] = useState(120);
  const [quickLists, setQuickLists] = useState<Array<{ id: string; name: string }>>([]);
  

  const [statusFilter, setStatusFilter] = useState<FilterStatus>('tout');
const [typeFilter, setTypeFilter] =useState<MediaType | 'tous'>('tous');  
const [sortBy, setSortBy] = useState<'title' | 'added' | 'year' | 'rating' | 'status'>('title');
const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
const [favoritesOnly, setFavoritesOnly] = useState(false);
const [collectionContinueType, setCollectionContinueType] = useState<'series' | 'movies'>('series');
const [hideCompleted, setHideCompleted] = useState(false);
const [yearFilter, setYearFilter] = useState('all');
const [selectedDecade, setSelectedDecade] = useState<number | null>(null);
const [metadataIndexing, setMetadataIndexing] = useState(false);
const [metadataIndexedCount, setMetadataIndexedCount] = useState(0);
const [metadataMissingCount, setMetadataMissingCount] = useState(0);
const [myList, setMyList] = useState<{
  [key: string]: MyListItem;
}>({});
  
  // États pour la fiche détaillée "TV Time"
  const [selectedMedia, setSelectedMedia] = useState<MediaItem | null>(null);
  const [detailsLoading, setDetailsLoading] = useState(false);
  const [mediaDetails, setMediaDetails] = useState<{
  synopsis: string;
  actors: any[];
  seasons_count: number;
  authors?: any[];
  runtime?: number | null;
  episode_runtime?: number | null;
} | null>(null);  
  const [activeSeason, setActiveSeason] = useState<number>(1);
  const [seasonEpisodes, setSeasonEpisodes] = useState<any[]>([]);
  const [episodesLoading, setEpisodesLoading] = useState(false);
  const {
  reviewsByMedia,
  reviewRating,
  reviewComment,
  setReviewRating,
  setReviewComment,
  loadReviews,
  submitReview,
  deleteReview,
} = useReviews({
  supabase,
  userId,
  userName,
});

// Distribution calculée à partir de la liste personnelle
const distribution = useMemo(() => {
  const counts: { [k: string]: number } = {
    movie: 0,
    tv: 0,
    drama: 0,
    anime: 0,
    manga: 0,
    manhwa: 0,
  };

  Object.values(myList).forEach((entry) => {
    const type = entry.media.type;
    counts[type] = (counts[type] || 0) + 1;
  });

  return counts;
}, [myList]);

  // Suivi des épisodes vus et progression chapitres
  const [watchedEpisodes, setWatchedEpisodes] = useState<{ [key: string]: boolean }>({});
  const [mangaProgress, setMangaProgress] = useState<{ [key: string]: number }>({});  

  const getMediaKey = (media: MediaItem | { type: string; id: string | number }) => `${media.type}_${media.id}`;

  // Année de SORTIE du média uniquement.
  // Elle ne dépend jamais de steldra_added_at / created_at.
  const getMediaYear = (media: MediaItem): number | null => {
    const directYear = Number(media.year);

    if (Number.isFinite(directYear) && directYear > 1900) {
      return directYear;
    }

    const date = media.release_date || media.first_air_date || '';
    const parsedYear = Number(String(date).slice(0, 4));

    return Number.isFinite(parsedYear) && parsedYear > 1900
      ? parsedYear
      : null;
  };



const normalizeGenre = (value: string) => {
  const normalized = value.trim().toLowerCase();

  const aliases: Record<string, string> = {
    comedy: 'Comédie',
    comedie: 'Comédie',
    romance: 'Romance',

    bl: 'BL',
    'boys love': 'BL',
    'boy love': 'BL',
    yaoi: 'BL',
    'shounen ai': 'BL',
    'shounen-ai': 'BL',

    gl: 'GL',
    'girls love': 'GL',
    "girls' love": 'GL',
    'girl love': 'GL',
    yuri: 'GL',
    'shoujo ai': 'GL',
    'shoujo-ai': 'GL',

    action: 'Action',
    adventure: 'Aventure',
    aventure: 'Aventure',
    fantasy: 'Fantastique',
    fantastique: 'Fantastique',
    horror: 'Horreur',
    horreur: 'Horreur',
    thriller: 'Thriller',
    mystery: 'Mystère',
    mystere: 'Mystère',
    crime: 'Crime',
    drama: 'Drame',
    drame: 'Drame',
    animation: 'Animation',
    family: 'Famille',
    famille: 'Famille',
    documentary: 'Documentaire',
    documentaire: 'Documentaire',
    history: 'Histoire',
    histoire: 'Histoire',
    music: 'Musique',
    musique: 'Musique',
    western: 'Western',
    war: 'Guerre',
    guerre: 'Guerre',
    'science fiction': 'Science-fiction',
    'science-fiction': 'Science-fiction',
    'sci-fi': 'Science-fiction',
  };

  return aliases[normalized] || value.trim();
};

const getMediaGenres = (media: MediaItem) => {
  const officialGenres = (media.genres || [])
    .map(normalizeGenre)
    .filter(Boolean);

  // Compatibilité avec l'ancien système :
  // les anciens tags BL/GL sont désormais lus comme des genres.
  const legacyGenres = (media.tags || [])
    .filter((tag) => tag === 'BL' || tag === 'GL')
    .map(normalizeGenre);

  return Array.from(
    new Set([...officialGenres, ...legacyGenres])
  );
};

const {
  handleMarkWatched,
  handleToggleInProgress,
  handleMarkToWatch,
  handleRemove,
  toggleEpisodeWatched,
  handleChapterChange,
} = useMediaProgress({
  supabase,
  myList,
  setMyList,
  watchedEpisodes,
  setWatchedEpisodes,
  mangaProgress,
  setMangaProgress,
  selectedMedia,
  activeSeason,
  getMediaKey,
});

  const hasStartedProgress = (mediaKey: string) => {
   const hasWatched = Object.keys(watchedEpisodes).some((key) => key.startsWith(`${mediaKey}_S`) && watchedEpisodes[key]);
    const progressValue = mangaProgress[mediaKey] || 0;
    return hasWatched || progressValue > 0;
  };

const getFilterStatus = (
  media: MediaItem,
  currentStatus?: WatchStatus
): FilterStatus => {
  const status =
    currentStatus ||
    myList[getMediaKey(media)]?.status ||
    'a_voir';

  if (status === 'vu') {
    return 'termine';
  }

  if (status === 'en_cours') { return 'en_cours'; }
  if (status === 'en_pause') { return 'en_pause'; }
  if (status === 'abandonne') { return 'abandonne'; }

  if (hasStartedProgress(getMediaKey(media))) {
    return 'en_cours';
  }

  return 'a_voir';
};

// Fonction pour sauvegarder les données dans Supabase
const saveToSupabase = async (mediaData: MediaItem, status: string, user: any) => {
  const mediaKey = `${mediaData.type}_${mediaData.id}`;
  const { error } = await supabase
    .from('media_progress')
    .upsert({
      user_id: user.id,
      media_id: mediaData.id.toString(),
      media_type: mediaData.type,
      status: status,
      media_data: mediaData,
      // On conserve les épisodes et chapitres existants s'ils existent localement
      watched_episodes: watchedEpisodes,
      manga_progress: mangaProgress[mediaKey] || 0
    });

  if (error) console.error("Erreur de sauvegarde globale:", error);
};

const enrichMissingMetadata = async (
  list: Record<string, MyListItem>,
  currentUserId: string
) => {
  const missing = Object.entries(list).filter(([, entry]) => {
    const hasGenres =
      Array.isArray(entry.media.genres) &&
      entry.media.genres.length > 0;

    const hasYear = getMediaYear(entry.media) !== null;

    const needsPoster =
      ['movie', 'tv', 'drama', 'anime'].includes(entry.media.type) &&
      !entry.media.poster_path;

    return !hasGenres || !hasYear || needsPoster;
  });

  setMetadataMissingCount(missing.length);
  setMetadataIndexedCount(0);

  if (missing.length === 0) {
    setMetadataIndexing(false);
    return;
  }

  /*
   * Évite de relancer tout l'enrichissement plusieurs fois
   * pendant la même session navigateur.
   */
  const sessionKey = `steldra_metadata_enrichment_${currentUserId}`;

  if (sessionStorage.getItem(sessionKey) === 'running') {
    return;
  }

  sessionStorage.setItem(sessionKey, 'running');
  setMetadataIndexing(true);

  try {
    /*
     * On traite seulement 4 médias simultanément.
     * C'est suffisamment rapide, mais beaucoup moins violent
     * pour l'API, Supabase et React.
     */
    const BATCH_SIZE = 4;

    for (let index = 0; index < missing.length; index += BATCH_SIZE) {
      const chunk = missing.slice(index, index + BATCH_SIZE);

      const results = await Promise.allSettled(
        chunk.map(async ([key, entry]) => {
          try {
            const details = await getMediaDetails(entry.media);

            const genres = Array.isArray(details.genres)
              ? details.genres
                  .map(normalizeGenre)
                  .filter(Boolean)
              : [];

            const detailsYear =
              Number(details.year) ||
              Number(
                String(
                  details.release_date ||
                  details.first_air_date ||
                  ''
                ).slice(0, 4)
              ) ||
              null;

            const existingYear = getMediaYear(entry.media);

            const enrichedMedia: MediaItem = {
              ...entry.media,

              poster_path:
                details.poster_path ||
                entry.media.poster_path ||
                '',

              genres:
                genres.length > 0
                  ? Array.from(new Set(genres))
                  : entry.media.genres,

              genre_ids:
                details.genre_ids ||
                entry.media.genre_ids,

              rating:
                details.rating ??
                entry.media.rating ??
                null,

              year:
                detailsYear && detailsYear > 1900
                  ? detailsYear
                  : existingYear ||
                    entry.media.year,

              release_date:
                details.release_date ||
                entry.media.release_date,

              first_air_date:
                details.first_air_date ||
                entry.media.first_air_date,
            };

            /*
             * Sauvegarde dans Supabase.
             */
            const { error } = await supabase
              .from('media_progress')
              .update({
                media_data: enrichedMedia,
              })
              .eq('user_id', currentUserId)
              .eq('media_id', String(entry.media.id))
              .eq('media_type', entry.media.type);

            if (error) {
              console.error(
                `Erreur Supabase pour ${entry.media.title}:`,
                error
              );
            }

            return {
              key,
              enrichedMedia,
            };
          } catch (error) {
            console.error(
              `Métadonnées indisponibles pour ${entry.media.title}:`,
              error
            );

            return null;
          }
        })
      );

      /*
       * IMPORTANT :
       * au lieu de faire setMyList() une fois PAR média,
       * on met React à jour UNE SEULE FOIS par lot.
       */
      const successfulUpdates = results
        .filter(
          (
            result
          ): result is PromiseFulfilledResult<{
            key: string;
            enrichedMedia: MediaItem;
          } | null> => result.status === 'fulfilled'
        )
        .map((result) => result.value)
        .filter(
          (
            value
          ): value is {
            key: string;
            enrichedMedia: MediaItem;
          } => value !== null
        );

      if (successfulUpdates.length > 0) {
        setMyList((current) => {
          const updated = { ...current };

          successfulUpdates.forEach(({ key, enrichedMedia }) => {
            const currentEntry = updated[key];

            if (!currentEntry) return;

            updated[key] = {
              ...currentEntry,
              media: enrichedMedia,
            };
          });

          return updated;
        });
      }

      setMetadataIndexedCount((current) =>
        Math.min(current + chunk.length, missing.length)
      );

      /*
       * Petite pause entre deux groupes.
       * Cela évite d'inonder l'API.
       */
      if (index + BATCH_SIZE < missing.length) {
        await new Promise((resolve) =>
          window.setTimeout(resolve, 250)
        );
      }
    }
  } finally {
    setMetadataIndexing(false);

    /*
     * "done" empêche un deuxième gros enrichissement
     * pendant la même session.
     */
    sessionStorage.setItem(sessionKey, 'done');
  }
};


useEffect(() => {
  let cancelled = false;

  const loadQuickLists = async () => {
    if (!userId) {
      setQuickLists([]);
      return;
    }

    const { data, error } = await supabase
      .from('custom_lists')
      .select('id,name')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(4);

    if (!cancelled) {
      if (error) {
        console.error('Erreur chargement listes rapides :', error);
        setQuickLists([]);
      } else {
        setQuickLists((data || []) as Array<{ id: string; name: string }>);
      }
    }
  };

  void loadQuickLists();
  return () => { cancelled = true; };
}, [supabase, userId]);

const handleAddToMyList = async (media: MediaItem, status: 'vu' | 'a_voir') => {
  const mediaKey = `${media.type}_${media.id}`;
  const updatedList = { ...myList, [mediaKey]: { media, status } };
  setMyList(updatedList);

  const { data: { user } } = await supabase.auth.getUser();
  if (user) {
    await saveToSupabase(media, status, user);
  } else {
    localStorage.setItem('steldra_multimedia_list_v1', JSON.stringify(updatedList));
  }
};

// Vérification de la session utilisateur au chargement de la page
useEffect(() => { 
  const loadInitialData = async () => {
    const { data: { user } } = await supabase.auth.getUser();

    if (user) {
      // Si connecté : on récupère tout depuis Supabase
      setUserName(user.user_metadata?.full_name || user.email?.split('@')[0] || "Utilisateur");
      setUserId(user.id);

      
    const { data, error } = await fetchAllPages<any>((from, to) =>
      supabase
        .from('media_progress')
        .select('*')
        .eq('user_id', user.id)
        .order('media_id', { ascending: true })
        .range(from, to)
    );
      if (data && !error) {
        console.log("Données brutes reçues de Supabase :", data);

        const newList: any = {};
        const newEpisodes: any = {};
        const newProgress: any = {};

      data.forEach((item: any) => {
    // 1. Récupération sûre du media et de son type
    const media = item.media_data;
    const mediaType = media?.type || item.media_type || 'unknown';
    const mediaId = item.media_id;
    
    // 2. Clé unique (en forçant le type pour éviter les erreurs)
    const mediaKey = `${mediaType}_${mediaId}`;
    
    // 3. Reconstitution propre de l'objet
    newList[mediaKey] = {
  media: {
    ...media,
    type: mediaType,
    id: mediaId,
  },
  status: item.status,
  watchCount: Number(item.watch_count) || 0,
  favorite: Boolean(media?.favorite),
  addedAt: media?.steldra_added_at || item.created_at || null,
  lastInteractionAt: media?.steldra_last_interaction_at || item.updated_at || item.created_at || null,
};
    
    // 4. On stocke le reste
    if (item.watched_episode) Object.assign(newEpisodes, item.watched_episode);
    if (item.watched_episodes) Object.assign(newEpisodes, item.watched_episodes);
    if (item.manga_progress) newProgress[mediaKey] = item.manga_progress;
});

// Mise à jour de tous les états
setMyList(newList);
setWatchedEpisodes(newEpisodes);
setMangaProgress(newProgress);
void enrichMissingMetadata(newList, user.id);

      }
    } else {
      // Si pas connecté : on récupère depuis le localStorage
      const savedList = localStorage.getItem('steldra_multimedia_list_v1');
      if (savedList) setMyList(JSON.parse(savedList));

      // On récupère les épisodes vus et la progression des mangas depuis le localStorage
      const savedEpisodes = localStorage.getItem('steldra_watched_episodes_v1');
      if (savedEpisodes) setWatchedEpisodes(JSON.parse(savedEpisodes));

      // On récupère la progression des mangas depuis le localStorage
      const savedProgress = localStorage.getItem('steldra_manga_progress_v1');
      if (savedProgress) setMangaProgress(JSON.parse(savedProgress));
    }

    setInitialDataReady(true);
  };

      // On met à jour l'état pour indiquer que la vérification est terminée
  loadInitialData();
}, []);  

useEffect(() => {
  const savedState = sessionStorage.getItem('steldra_collection_state');
  const savedScroll = sessionStorage.getItem('steldra_collection_scroll_y');

  if (savedState) {
    try {
      const parsed = JSON.parse(savedState) as {
        query?: string;
        typeFilter?: MediaType | 'tous';
        statusFilter?: FilterStatus;
        sortBy?: string;
        viewMode?: string;
        favoritesOnly?: boolean;
        hideCompleted?: boolean;
        yearFilter?: string;
      };

      if (parsed.typeFilter) setTypeFilter(parsed.typeFilter);
      if (parsed.statusFilter) setStatusFilter(parsed.statusFilter);
      if (parsed.sortBy) setSortBy(parsed.sortBy as 'title' | 'added' | 'year' | 'rating' | 'status');
      if (parsed.viewMode) setViewMode(parsed.viewMode as 'grid' | 'list');
      if (typeof parsed.favoritesOnly === 'boolean') setFavoritesOnly(parsed.favoritesOnly);
      if (typeof parsed.hideCompleted === 'boolean') setHideCompleted(parsed.hideCompleted);
      if (typeof parsed.yearFilter === 'string') setYearFilter(parsed.yearFilter);

      if (parsed.query && parsed.query.trim().length >= 2) {
        void handleSearch(parsed.query);
      } else if (typeof parsed.query === 'string') {
        setQuery(parsed.query);
      }
    } catch (error) {
      console.error('État de collection illisible :', error);
    }
  }

  if (savedScroll) {
    const value = Number(savedScroll);
    if (Number.isFinite(value)) setPendingScrollRestore(value);
  }

  // Important : on ne commence à sauvegarder les préférences qu'après
  // avoir relu l'état précédent. Sinon le premier rendu (A–Z par défaut)
  // écrase immédiatement le tri mémorisé avant que React applique "Ajout récent".
  setCollectionStateRestored(true);
}, []);

useEffect(() => {
  if (!collectionStateRestored) return;

  sessionStorage.setItem(
    'steldra_collection_state',
    JSON.stringify({ query, typeFilter, statusFilter, sortBy, viewMode, favoritesOnly, hideCompleted, yearFilter })
  );
}, [collectionStateRestored, query, typeFilter, statusFilter, sortBy, viewMode, favoritesOnly, hideCompleted, yearFilter]);

useEffect(() => {
  if (!initialDataReady || loading || pendingScrollRestore === null) return;

  // Les affiches distantes continuent parfois à modifier la hauteur de la grille
  // après le premier rendu. On restaure donc plusieurs fois la position mémorisée
  // pendant un court instant afin de revenir réellement à la carte quittée.
  const targetY = pendingScrollRestore;
  const delays = [0, 80, 180, 350, 650, 1000];
  const timers = delays.map((delay, index) =>
    window.setTimeout(() => {
      window.scrollTo({ top: targetY, behavior: 'auto' });

      if (index === delays.length - 1) {
        setPendingScrollRestore(null);
        sessionStorage.removeItem('steldra_collection_scroll_y');
      }
    }, delay)
  );

  return () => timers.forEach((timer) => window.clearTimeout(timer));
}, [initialDataReady, loading, pendingScrollRestore, results.length, Object.keys(myList).length]);

useEffect(() => {
  let scrollTimeout: NodeJS.Timeout;
  
  const handleScroll = () => {
    clearTimeout(scrollTimeout);
    scrollTimeout = setTimeout(() => {
      const isScrolled = window.scrollY > 400;
      setShowScrollTop(isScrolled);
      console.log('Scroll position:', window.scrollY, 'Show button:', isScrolled);
    }, 50);
  };
  
  window.addEventListener('scroll', handleScroll, { passive: true });
  return () => {
    window.removeEventListener('scroll', handleScroll);
    clearTimeout(scrollTimeout);
  };
}, []);

const scrollToTop = () => {
  window.document.documentElement.scrollTop = 0; // Pour la plupart des navigateurs
  window.document.body.scrollTop = 0;           // Pour Safari
};

// Fonction pour réinitialiser la recherche et les filtres
const handleReset = () => {
  setQuery('');
  setResults([]);
  setTypeFilter('tous');
  setStatusFilter('tout');
  setSelectedDecade(null);
  setYearFilter('all');
  setFavoritesOnly(false);
  setHideCompleted(false);
  setSelectedMedia(null);
};

// Fonction pour ouvrir la fiche détaillée d'un média
  const openMediaDetails = async (media: MediaItem) => {
  setSelectedMedia(media);
  setMediaDetails(null);
  setSeasonEpisodes([]);
  setActiveSeason(1);
  setDetailsLoading(true);

  const localSynopsis =
    media.synopsis || 'Aucun synopsis disponible.';

  const defaultSeasons = [
    'tv',
    'anime',
    'drama',
  ].includes(media.type)
    ? media.seasons || 1
    : 0;

try {
  const data = await getMediaDetails(media);

  console.log('DÉTAILS REÇUS :', data);
  console.log('RUNTIME FILM :', data.runtime);
  console.log(
    'RUNTIME ÉPISODE :',
    data.episode_runtime
  );

const enrichedMedia: MediaItem = {
  ...media,
  runtime:
    data.runtime ??
    media.runtime ??
    null,
  episode_runtime:
    data.episode_runtime ??
    media.episode_runtime ??
    null,
  genres: Array.isArray(data.genres) && data.genres.length > 0
    ? Array.from(new Set(data.genres.map(normalizeGenre)))
    : media.genres,
  genre_ids: data.genre_ids || media.genre_ids,
  rating: data.rating ?? media.rating ?? null,
};

setSelectedMedia(enrichedMedia);

const mediaKey = getMediaKey(enrichedMedia);

if (myList[mediaKey]) {
  const updatedEntry = {
    ...myList[mediaKey],
    media: enrichedMedia,
  };

  setMyList((current) => ({
    ...current,
    [mediaKey]: updatedEntry,
  }));

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) {
    const { error } = await supabase
      .from('media_progress')
      .update({
        media_data: enrichedMedia,
      })
      .eq('user_id', user.id)
      .eq('media_id', enrichedMedia.id.toString())
      .eq('media_type', enrichedMedia.type);

    if (error) {
      console.error(
        'Erreur sauvegarde du runtime :',
        error
      );
    }
  } else {
    const updatedList = {
      ...myList,
      [mediaKey]: updatedEntry,
    };

    localStorage.setItem(
      'steldra_multimedia_list_v1',
      JSON.stringify(updatedList)
    );
  }
}

setMediaDetails({
  synopsis:
    data.synopsis || localSynopsis,
  actors: data.actors || [],
  seasons_count:
    data.seasons_count || defaultSeasons,
  authors:
    data.authors ||
    data.creators ||
    [],
  runtime: data.runtime,
  episode_runtime:
    data.episode_runtime,
});

  loadReviews(media.id);

  if (defaultSeasons > 0) {
    loadSeasonEpisodes(media.id, 1);
  }
} finally {
    setDetailsLoading(false);
  }
};

// Fonction pour charger les épisodes d'une saison spécifique (ca marche pas)
  const loadSeasonEpisodes = async (
  mediaId: string | number,
  seasonNum: number
) => {
  setActiveSeason(seasonNum);
  setEpisodesLoading(true);

  try {
    const episodes = await getSeasonEpisodes(
      mediaId,
      seasonNum
    );

    setSeasonEpisodes(episodes);
  } catch (error) {
    console.error(
      'Erreur lors du chargement des épisodes :',
      error
    );

    setSeasonEpisodes([]);
  } finally {
    setEpisodesLoading(false);
  }
};

// Fonction pour ajouter ou retirer un média de la liste "À voir" ou "Vu"
const toggleStatus = async (media: MediaItem, status: 'vu' | 'a_voir', e: React.MouseEvent) => {
  e.stopPropagation();
  const updatedList = { ...myList };
  const mediaKey = `${media.type}_${media.id}`;
  const isRemoving = updatedList[mediaKey] && updatedList[mediaKey].status === status;

  if (isRemoving) {
    delete updatedList[mediaKey];
  } else {
    updatedList[mediaKey] = { media, status, watchCount: status === 'a_voir' ? 0 : (updatedList[mediaKey]?.watchCount || 1) };
  }


  setMyList(updatedList);
  localStorage.setItem('steldra_multimedia_list_v1', JSON.stringify(updatedList));

  const { data: { user } } = await supabase.auth.getUser();
  if (user) {
    if (isRemoving) {

      await supabase
        .from('media_progress')
        .delete()
        .eq('user_id', user.id)
        .eq('media_id', media.id.toString());
    } else {
const { error } = await supabase
  .from('media_progress')
  .upsert({
    user_id: user.id,
    media_id: media.id.toString(),
    media_type: media.type,
    media_data: media,
    status,
    watched_episodes: watchedEpisodes,
    manga_progress: mangaProgress[mediaKey] || 0,
    watch_count: status === 'a_voir' ? 0 : 1,
  });

if (error) {
  console.error(
    'Erreur Supabase lors de la sauvegarde :',
    error
  );
}    }
  }
};

const handleToggleFavorite = async (media: MediaItem) => {
  const key = getMediaKey(media);
  const current = myList[key];
  if (!current) return;

  const favorite = !current.favorite;
  const now = new Date().toISOString();
  const enrichedMedia: MediaItem = {
    ...current.media,
    favorite,
    steldra_added_at: current.addedAt || current.media.steldra_added_at || now,
    steldra_last_interaction_at: now,
  };

  const updatedEntry: MyListItem = {
    ...current,
    media: enrichedMedia,
    favorite,
    addedAt: enrichedMedia.steldra_added_at,
    lastInteractionAt: now,
  };

  const updatedList = { ...myList, [key]: updatedEntry };
  setMyList(updatedList);
  localStorage.setItem('steldra_multimedia_list_v1', JSON.stringify(updatedList));

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;

  const { error } = await supabase
    .from('media_progress')
    .update({ media_data: enrichedMedia })
    .eq('user_id', user.id)
    .eq('media_id', String(media.id))
    .eq('media_type', media.type);

  if (error) console.error('Erreur mise à jour favori :', error);
};


// Fonction pour effectuer la recherche de médias via l'API interne
const handleSearch = async (text: string) => {
  setQuery(text);

  if (text.trim().length < 2) {
    setResults([]);
    return;
  }

  setLoading(true);

  try {
    const mediaResults = await searchMedia(text);
    setResults(mediaResults);
  } catch (error) {
    console.error('Erreur de recherche :', error);
    setResults([]);
  } finally {
    setLoading(false);
  }
};

  // Fonction pour gérer la déconnexion de l'utilisateur
  const isSearching = query.trim().length >= 2;

console.log("Contenu de myList :", Object.values(myList));
let displayItems = isSearching ? results : Object.values(myList).map(item => item.media);

// Comptages des statuts
const itemsForCount = Object.values(myList).filter(item => typeFilter === 'tous' || item.media.type === typeFilter);
const totalCount = itemsForCount.length;
const termineCount = itemsForCount.filter(item => getFilterStatus(item.media, item.status) === 'termine').length;
const enCoursCount = itemsForCount.filter(item => getFilterStatus(item.media, item.status) === 'en_cours').length;
const aVoirCount = itemsForCount.filter(item => getFilterStatus(item.media, item.status) === 'a_voir').length;
const enPauseCount = itemsForCount.filter(item => getFilterStatus(item.media, item.status) === 'en_pause').length;
const abandonneCount = itemsForCount.filter(item => getFilterStatus(item.media, item.status) === 'abandonne').length;

const allCollectionEntries = Object.values(myList);
const globalTotalCount = allCollectionEntries.length;
const globalTermineCount = allCollectionEntries.filter((item) => getFilterStatus(item.media, item.status) === 'termine').length;

const collectionItemsForFacets = useMemo(
  () =>
    Object.values(myList)
      .map((entry) => entry.media)
      .filter(
        (media) =>
          typeFilter === 'tous' ||
          media.type === typeFilter
      ),
  [myList, typeFilter]
);

const activeAdvancedFiltersCount =
  (yearFilter !== 'all' ? 1 : 0) +
  (favoritesOnly ? 1 : 0) +
  (hideCompleted ? 1 : 0);

const clearAdvancedFilters = () => {
  setYearFilter('all');
  setFavoritesOnly(false);
  setHideCompleted(false);
  setSelectedDecade(null);
};


const availableYears = useMemo(() => {
  const counts = new Map<number, number>();

  collectionItemsForFacets.forEach((media) => {
    const year = getMediaYear(media);
    if (!year) return;

    counts.set(year, (counts.get(year) || 0) + 1);
  });

  return Array.from(counts.entries())
    .map(([year, count]) => ({ year, count }))
    .sort((a, b) => b.year - a.year);
}, [collectionItemsForFacets]);

useEffect(() => {
  if (yearFilter === 'all') return;

  const stillAvailable = availableYears.some(
    ({ year }) => String(year) === yearFilter
  );

  if (!stillAvailable) {
    setYearFilter('all');
  }
}, [availableYears, yearFilter]);

const availableDecades = useMemo(() => {
  const counts = new Map<number, number>();

  availableYears.forEach(({ year, count }) => {
    const decade = Math.floor(year / 10) * 10;
    counts.set(decade, (counts.get(decade) || 0) + count);
  });

  return Array.from(counts.entries())
    .map(([decade, count]) => ({ decade, count }))
    .sort((a, b) => b.decade - a.decade);
}, [availableYears]);

const yearsForSelectedDecade = useMemo(() => {
  if (selectedDecade === null) return [];

  return availableYears.filter(
    ({ year }) =>
      Math.floor(year / 10) * 10 === selectedDecade
  );
}, [availableYears, selectedDecade]);

useEffect(() => {
  if (selectedDecade === null) return;

  const decadeStillExists = availableDecades.some(
    ({ decade }) => decade === selectedDecade
  );

  if (!decadeStillExists) {
    setSelectedDecade(null);
    setYearFilter('all');
  }
}, [availableDecades, selectedDecade]);

displayItems = displayItems.filter(item => {
  const mediaType = (item.type || 'unknown').toLowerCase();
  const filterType = typeFilter.toLowerCase();
  const key = `${item.type}_${item.id}`;
  const listItem = myList[key];
  const matchesType = typeFilter === 'tous' || mediaType === filterType;
  const itemStatus = listItem ? getFilterStatus(item, listItem.status) : 'a_voir';
  const matchesStatus = isSearching || statusFilter === 'tout' || itemStatus === statusFilter;
  const matchesFavorite = isSearching || !favoritesOnly || Boolean(listItem?.favorite);
  const matchesCompleted = isSearching || !hideCompleted || itemStatus !== 'termine';
  const itemYear = getMediaYear(item);
  const matchesYear = isSearching || yearFilter === 'all' || Number(yearFilter) === itemYear;
  return (
    matchesType &&
    matchesStatus &&
    matchesFavorite &&
    matchesCompleted &&
    matchesYear
  );
});

const statusOrder: Record<string, number> = { en_cours: 0, en_pause: 1, a_voir: 2, termine: 3, abandonne: 4 };

useEffect(() => {
  setVisibleCount(120);
}, [query, statusFilter, typeFilter, sortBy, favoritesOnly, hideCompleted, yearFilter, viewMode]);

displayItems = [...displayItems].sort((a, b) => {
  if (isSearching) {
    const normalizedQuery = query.trim().toLowerCase();
    const titleA = (a.title || '').trim().toLowerCase();
    const titleB = (b.title || '').trim().toLowerCase();
    const startsWithA = titleA.startsWith(normalizedQuery);
    const startsWithB = titleB.startsWith(normalizedQuery);
    if (startsWithA && !startsWithB) return -1;
    if (!startsWithA && startsWithB) return 1;
    return titleA.localeCompare(titleB, 'fr', { numeric: true, sensitivity: 'base', ignorePunctuation: true });
  }

  const entryA = myList[getMediaKey(a)];
  const entryB = myList[getMediaKey(b)];

  if (sortBy === 'added') {
    return new Date(entryB?.addedAt || 0).getTime() - new Date(entryA?.addedAt || 0).getTime();
  }

  if (sortBy === 'year') {
    const yearA = getMediaYear(a) || 0;
    const yearB = getMediaYear(b) || 0;

    return (
      yearB - yearA ||
      a.title.localeCompare(b.title, 'fr')
    );
  }

  if (sortBy === 'rating') {
    const ratingA = Number(a.rating) || 0;
    const ratingB = Number(b.rating) || 0;
    return ratingB - ratingA || a.title.localeCompare(b.title, 'fr');
  }

  if (sortBy === 'status') {
    const aStatus = getFilterStatus(a, entryA?.status);
    const bStatus = getFilterStatus(b, entryB?.status);
    return (statusOrder[aStatus] ?? 9) - (statusOrder[bStatus] ?? 9) || a.title.localeCompare(b.title, 'fr');
  }

  return a.title.localeCompare(b.title, 'fr', { numeric: true, sensitivity: 'base', ignorePunctuation: true });
});

const visibleDisplayItems = isSearching ? displayItems : displayItems.slice(0, visibleCount);

const continueItems = Object.values(myList)
  .filter((entry) => getFilterStatus(entry.media, entry.status) === 'en_cours');
const movieContinueItems = continueItems.filter((entry) => entry.media.type === 'movie').slice(0, 8);
const seriesContinueItems = continueItems.filter((entry) => ['tv', 'drama', 'anime'].includes(entry.media.type)).slice(0, 8);
const visibleContinueItems = collectionContinueType === 'movies' ? movieContinueItems : seriesContinueItems;

const genreCounts = new Map<string, number>();
Object.values(myList).forEach((entry) => {
  getMediaGenres(entry.media).forEach((genre) => {
    genreCounts.set(genre, (genreCounts.get(genre) || 0) + 1);
  });
});
const topGenres = Array.from(genreCounts.entries())
  .sort((a, b) => b[1] - a[1])
  .slice(0, 5);


const displayName = userName?.trim() || 'STELDRA';
const displayInitial = displayName.charAt(0).toUpperCase();

return (
  <>
    <MainNav />

    <main className={styles.collectionOptionThreePage}>
      <section className={styles.collectionOptionHero}>
        <div className={styles.collectionOptionHeroCopy}>
          <span>MA COLLECTION</span>
          <h1>Collection</h1>
          <h2>Vos histoires. Vos émotions. À portée de main.</h2>
          <p>Un univers qui vous ressemble, organisé avec soin, pensé pour vous.</p>
        </div>
        <div className={styles.collectionOptionHeroScene} aria-hidden="true">
          <span className={styles.collectionOptionPlanet} />
          <span className={styles.collectionOptionFigure}>✦</span>
        </div>
        <div className={styles.collectionOptionHeroControls}>
          <div className={styles.collectionSearchPremium}>
            <span aria-hidden="true">⌕</span>
            <input
              type="search"
              value={query}
              onChange={(event) => handleSearch(event.target.value)}
              placeholder="Rechercher un film, une série, un acteur…"
              aria-label="Rechercher dans la collection"
            />
            {query && <button type="button" onClick={() => handleSearch('')} aria-label="Effacer">×</button>}
          </div>
          <div className={styles.collectionTypeTabs}>
            {[
              ['tous', 'Tous'], ['movie', 'Films'], ['tv', 'Séries'], ['drama', 'Dramas'],
              ['anime', 'Animés'], ['manga', 'Mangas'], ['manhwa', 'Manhwas'],
            ].map(([value, label]) => (
              <button key={value} type="button" className={typeFilter === value ? styles.collectionTypeActive : ''}
                onClick={() => setTypeFilter(value as MediaType | 'tous')}>{label}</button>
            ))}
          </div>
        </div>
      </section>

      <section className={styles.collectionOptionDashboard}>
        <article className={styles.collectionOptionPanel}>
          <header><span>Genres favoris</span></header>
          <div className={styles.collectionOptionChips}>
            {topGenres.length > 0 ? topGenres.map(([genre, count]) => <span key={genre}>{genre}<small>{count}</small></span>) : <p>Aucun genre disponible pour le moment.</p>}
          </div>
          <Link href="/discover">Découvrir selon mes envies →</Link>
        </article>

        <article className={styles.collectionOptionPanel}>
          <header><span>Listes rapides</span></header>
          <div className={styles.collectionOptionQuickLists}>
            {quickLists.length > 0 ? quickLists.map((list) => <Link key={list.id} href={`/lists/${list.id}`}><span>☷</span>{list.name}<b>›</b></Link>) : <Link href="/lists"><span>＋</span>Créer ma première liste<b>›</b></Link>}
          </div>
          <Link href="/lists">Gérer mes listes →</Link>
        </article>

        <article className={styles.collectionOptionPanel}>
          <header><span>Raccourcis</span></header>
          <div className={styles.collectionOptionShortcuts}>
            <Link href="/discover"><span>✦</span><small>Recommandations</small></Link>
            <Link href="/history"><span>◷</span><small>Activité récente</small></Link>
            <Link href="/lists"><span>☷</span><small>Mes listes</small></Link>
            <Link href="/statistiques"><span>⌁</span><small>Statistiques</small></Link>
          </div>
        </article>

        <article className={`${styles.collectionOptionPanel} ${styles.collectionOptionTools}`}>
          <header><span>Outils</span></header>
          <label>Statut
            <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as FilterStatus)}>
              <option value="tout">Tous</option><option value="termine">Vus</option><option value="a_voir">À voir</option>
              <option value="en_cours">En cours</option><option value="en_pause">En pause</option><option value="abandonne">Abandonnés</option>
            </select>
          </label>
          <label>Trier par
            <select value={sortBy} onChange={(event) => setSortBy(event.target.value as typeof sortBy)}>
              <option value="title">Titre A–Z</option><option value="added">Ajout récent</option><option value="year">Année</option>
              <option value="rating">Note</option><option value="status">Statut</option>
            </select>
          </label>
          <div className={styles.collectionOptionViewButtons}>
            <button type="button" className={viewMode === 'grid' ? styles.collectionViewActive : ''} onClick={() => setViewMode('grid')}>▦</button>
            <button type="button" className={viewMode === 'list' ? styles.collectionViewActive : ''} onClick={() => setViewMode('list')}>☷</button>
            <button type="button" className={favoritesOnly ? styles.collectionViewActive : ''} onClick={() => setFavoritesOnly((value) => !value)}>★</button>
          </div>
        </article>
      </section>

      {loading && <div className={styles.collectionLoading}>Recherche en cours…</div>}

      {!isSearching && continueItems.length > 0 && (
        <section className={styles.collectionOptionContinue}>
          <div className={styles.collectionOptionSectionHeading}>
            <h2>Reprendre le visionnage</h2>
            <div className={styles.continueTabs} role="tablist" aria-label="Type de média à reprendre">
              <button type="button" className={collectionContinueType === 'series' ? styles.continueTabActive : ''} onClick={() => setCollectionContinueType('series')}>Séries</button>
              <button type="button" className={collectionContinueType === 'movies' ? styles.continueTabActive : ''} onClick={() => setCollectionContinueType('movies')}>Films</button>
            </div>
          </div>
          {visibleContinueItems.length > 0 ? <div className={styles.collectionOptionContinueRail}>
            {visibleContinueItems.map((entry) => {
              const media = entry.media;
              return <Link key={getMediaKey(media)} href={`/media/${media.type}/${media.id}`} className={styles.collectionOptionContinueCard}>
                <img src={getPosterUrl(media, 'w342')} alt={media.title} onError={(event) => usePosterFallback(event.currentTarget)} />
                <div><strong>{media.title}</strong><small>{media.type === 'movie' ? 'Film' : media.type === 'tv' ? 'Série' : media.type === 'drama' ? 'Drama' : media.type === 'anime' ? 'Animé' : media.type}</small><span>▶ Reprendre</span></div>
              </Link>;
            })}
          </div> : <p className={styles.emptyDashboard}>Aucun {collectionContinueType === 'movies' ? 'film' : 'épisode de série'} en cours.</p>}
        </section>
      )}

      <section id="collection-medias" className={styles.collectionOptionLibrary}>
        <div className={styles.collectionOptionSectionHeading}>
          <div><h2>{isSearching ? 'Résultats de recherche' : 'Toute la collection'}</h2><span>{displayItems.length} média{displayItems.length > 1 ? 's' : ''}</span></div>
          <div className={styles.collectionOptionStatusBar}>
            {[
              ['tout', `Tous ${totalCount}`], ['termine', `Vus ${termineCount}`], ['a_voir', `À voir ${aVoirCount}`], ['en_cours', `En cours ${enCoursCount}`]
            ].map(([value, label]) => <button key={value} type="button" className={statusFilter === value ? styles.collectionStatusActive : ''} onClick={() => setStatusFilter(value as FilterStatus)}>{label}</button>)}
          </div>
        </div>

        <div className={viewMode === 'grid' || isSearching ? `${styles.liste} ${styles.collectionPremiumGrid} ${styles.collectionOptionMediaGrid}` : styles.collectionListView}>
          {visibleDisplayItems.map((item) => {
            const mediaKey = getMediaKey(item);
            const currentItem = myList[mediaKey];
            if (!isSearching && viewMode === 'list') {
              const status = getFilterStatus(item, currentItem?.status);
              const year = getMediaYear(item) || '';
              return <article key={mediaKey} className={`${styles.collectionListRow} ${styles.collectionPremiumListRow}`}>
                <button type="button" className={styles.collectionListOpen} onClick={() => {
                  sessionStorage.setItem('steldra_selected_media', JSON.stringify(item));
                  sessionStorage.setItem('steldra_collection_scroll_y', String(window.scrollY));
                  window.location.href = `/media/${item.type}/${item.id}`;
                }}><img src={getPosterUrl(item, 'w154')} alt={item.title} onError={(event) => usePosterFallback(event.currentTarget)} /><span><strong>{item.title}</strong><small>{item.type}{year ? ` · ${year}` : ''} · {status === 'termine' ? 'Vu' : status === 'en_cours' ? 'En cours' : status === 'en_pause' ? 'En pause' : status === 'abandonne' ? 'Abandonné' : 'À voir'}</small></span></button>
                <div className={styles.collectionListActions}><button type="button" className={currentItem?.favorite ? styles.favoriteActive : ''} onClick={() => void handleToggleFavorite(item)}>{currentItem?.favorite ? '★' : '☆'}</button><button type="button" className={currentItem?.status === 'en_cours' ? styles.collectionListProgressActive : ''} onClick={() => void handleToggleInProgress(item)}>En cours</button><button type="button" className={currentItem?.status === 'vu' ? styles.collectionListWatchedActive : ''} onClick={() => void handleMarkWatched(item)}>Vu</button><button type="button" className={currentItem?.status === 'a_voir' ? styles.collectionListToWatchActive : ''} onClick={() => void handleMarkToWatch(item)}>À voir</button></div>
              </article>;
            }
            return <MediaCard key={mediaKey} item={item} currentItem={currentItem} onMarkWatched={handleMarkWatched} onToggleInProgress={handleToggleInProgress} onMarkToWatch={handleMarkToWatch} onRemove={handleRemove} onToggleFavorite={handleToggleFavorite} showMeta />;
          })}
        </div>

        {!isSearching && visibleCount < displayItems.length && <div className={styles.collectionLoadMoreWrap}><button type="button" className={styles.collectionPremiumLoadMore} onClick={() => setVisibleCount((count) => count + 120)}>Afficher 120 médias de plus <span>{Math.min(visibleCount, displayItems.length)} / {displayItems.length}</span></button></div>}
      </section>

      <footer className={styles.collectionOptionFooter}><blockquote>« Le cinéma, ce n’est pas seulement une question de technique. C’est une question d’être humain. »</blockquote><span>— Andreï Tarkovski</span></footer>

      {/* Fiche détaillée "TV Time" */}
          <MediaModal
        selectedMedia={selectedMedia}
        detailsLoading={detailsLoading}
        mediaDetails={mediaDetails}

        reviews={
          selectedMedia
            ? reviewsByMedia[
                selectedMedia.id.toString()
              ] || []
            : []
        }
        reviewRating={reviewRating}
        reviewComment={reviewComment}
        userId={userId}
        userName={userName}
      
        mangaProgress={mangaProgress}

        activeSeason={activeSeason}
        seasonEpisodes={seasonEpisodes}
        episodesLoading={episodesLoading}
        watchedEpisodes={watchedEpisodes}

        onRatingChange={setReviewRating}
        onCommentChange={setReviewComment}

        onSubmitReview={() => {
          if (!selectedMedia || !reviewRating) return;

          submitReview(
            selectedMedia,
            reviewRating,
            reviewComment
          );
        }}

        onCancelReview={() => {
          setReviewComment('');
          setReviewRating(null);
        }}

        onDeleteReview={deleteReview}

        onChapterChange={handleChapterChange}
        onLoadSeason={loadSeasonEpisodes}
        onToggleEpisode={toggleEpisodeWatched}
      />

      <button
        onClick={scrollToTop}
        className={styles.floatS}
        aria-label="Retour en haut"
        title="Retour en haut"
      >
        S
      </button>
      </main>
  </>
);
}