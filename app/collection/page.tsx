'use client'; // Permet d'utiliser les fonctionnalités côté client

import { createClient } from '../lib/supabase';
import { useState, useEffect, useMemo } from 'react'; // Gérer les données et les actions
import styles from '../page.module.css'; //Importer le style de la page
import MediaCard from '../components/mediaCard';
import useReviews from '../hooks/useReviews';
import MediaModal from '../components/mediaModal';
import useMediaProgress from '../hooks/useMediaProgress';
import Header from '../components/header';
import type { MediaType } from '../types/media';
import MainNav from '../components/mainNav';
import { sortMediaAlphabetically } from "../lib/sortMedia";
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
  const supabase = createClient();
  const [query, setQuery] = useState(''); // État pour la recherche
  const [results, setResults] = useState<MediaItem[]>([]); // État pour les résultats de recherche
  const [loading, setLoading] = useState(false); // État pour indiquer si la recherche est en cours
  const [userName, setUserName] = useState<string | null>(null); // État pour stocker le nom de l'utilisateur connecté
  const [userId, setUserId] = useState<string | null>(null); // État pour stocker l'ID de l'utilisateur connecté
  const [userCreatedAt, setUserCreatedAt] = useState<string | null>(null); // État pour stocker la date de création du compte de l'utilisateur connecté
  const [showScrollTop, setShowScrollTop] = useState(false);
  const [initialDataReady, setInitialDataReady] = useState(false);
  const [pendingScrollRestore, setPendingScrollRestore] = useState<number | null>(null);
  

  const [statusFilter, setStatusFilter] = useState<FilterStatus>('tout');
const [typeFilter, setTypeFilter] =useState<MediaType | 'tous'>('tous');  
const [sortBy, setSortBy] = useState<'title' | 'added' | 'year' | 'status'>('title');
const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
const [favoritesOnly, setFavoritesOnly] = useState(false);
const [hideCompleted, setHideCompleted] = useState(false);
const [yearFilter, setYearFilter] = useState('all');
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

  if (status === 'en_cours') {
    return 'en_cours';
  }

  if (hasStartedProgress(getMediaKey(media))) {
    return 'en_cours';
  }

  return 'a_voir';
};

  const handleLogout = async () => {
  await supabase.auth.signOut();
  window.location.href = '/login'; // Redirection vers la page de login
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

      
    const { data, error } = await supabase
      .from('media_progress')
      .select('*')
      .eq('user_id', user.id);
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
      if (parsed.sortBy) setSortBy(parsed.sortBy as 'title' | 'added' | 'year' | 'status');
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
}, []);

useEffect(() => {
  sessionStorage.setItem(
    'steldra_collection_state',
    JSON.stringify({ query, typeFilter, statusFilter, sortBy, viewMode, favoritesOnly, hideCompleted, yearFilter })
  );
}, [query, typeFilter, statusFilter, sortBy, viewMode, favoritesOnly, hideCompleted, yearFilter]);

useEffect(() => {
  if (!initialDataReady || loading || pendingScrollRestore === null) return;

  const timer = window.setTimeout(() => {
    window.scrollTo({ top: pendingScrollRestore, behavior: 'auto' });
    setPendingScrollRestore(null);
    sessionStorage.removeItem('steldra_collection_scroll_y');
  }, 80);

  return () => window.clearTimeout(timer);
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
    updatedList[mediaKey] = { media, status };
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

const availableYears = Array.from(
  new Set(
    Object.values(myList)
      .map((entry) => entry.media.year || Number((entry.media.release_date || entry.media.first_air_date || '').slice(0, 4)))
      .filter((year) => Number.isFinite(year) && Number(year) > 1900)
      .map(Number)
  )
).sort((a, b) => b - a);

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
  const itemYear = item.year || Number((item.release_date || item.first_air_date || '').slice(0, 4));
  const matchesYear = isSearching || yearFilter === 'all' || Number(yearFilter) === Number(itemYear);

  return matchesType && matchesStatus && matchesFavorite && matchesCompleted && matchesYear;
});

const statusOrder: Record<string, number> = { en_cours: 0, a_voir: 1, termine: 2 };

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
    const yearA = a.year || Number((a.release_date || a.first_air_date || '').slice(0, 4)) || 0;
    const yearB = b.year || Number((b.release_date || b.first_air_date || '').slice(0, 4)) || 0;
    return yearB - yearA || a.title.localeCompare(b.title, 'fr');
  }

  if (sortBy === 'status') {
    const aStatus = getFilterStatus(a, entryA?.status);
    const bStatus = getFilterStatus(b, entryB?.status);
    return (statusOrder[aStatus] ?? 9) - (statusOrder[bStatus] ?? 9) || a.title.localeCompare(b.title, 'fr');
  }

  return a.title.localeCompare(b.title, 'fr', { numeric: true, sensitivity: 'base', ignorePunctuation: true });
});

return (
  <>
    <MainNav />

    <div className={styles.mainContainer}>          
<Header
  query={query}
  typeFilter={typeFilter}
  statusFilter={statusFilter}
  isSearching={isSearching}
  totalCount={totalCount}
  termineCount={termineCount}
  enCoursCount={enCoursCount}
  aVoirCount={aVoirCount}
  onSearchChange={handleSearch}
  onTypeFilterChange={setTypeFilter}
  onStatusFilterChange={setStatusFilter}
  onReset={handleReset}
  onLogout={handleLogout}
/>
      {loading && <p style={{ textAlign: 'center', color: '#393E46', fontWeight: 'bold', marginTop: '2rem' }}>Recherche en cours...</p>}

      {!isSearching && (
        <section className={styles.collectionToolbar}>
          <div className={styles.collectionToolbarGroup}>
            <label>
              Trier par
              <select value={sortBy} onChange={(event) => setSortBy(event.target.value as typeof sortBy)}>
                <option value="added">Date d’ajout</option>
                <option value="title">Titre</option>
                <option value="year">Année</option>
                <option value="status">Statut</option>
              </select>
            </label>

            <label>
              Année
              <select value={yearFilter} onChange={(event) => setYearFilter(event.target.value)}>
                <option value="all">Toutes</option>
                {availableYears.map((year) => <option key={year} value={year}>{year}</option>)}
              </select>
            </label>
          </div>

          <div className={styles.collectionToolbarActions}>
            <button type="button" className={favoritesOnly ? styles.collectionToggleActive : ''} onClick={() => setFavoritesOnly((value) => !value)}>
              Favoris uniquement
            </button>
            <button type="button" className={hideCompleted ? styles.collectionToggleActive : ''} onClick={() => setHideCompleted((value) => !value)}>
              Masquer les terminés
            </button>
            <div className={styles.viewSwitch}>
              <button type="button" className={viewMode === 'grid' ? styles.collectionToggleActive : ''} onClick={() => setViewMode('grid')}>Grille</button>
              <button type="button" className={viewMode === 'list' ? styles.collectionToggleActive : ''} onClick={() => setViewMode('list')}>Liste</button>
            </div>
          </div>
        </section>
      )}

<div className={viewMode === 'grid' || isSearching ? styles.liste : styles.collectionListView}>
  {displayItems.map((item) => {
    const mediaKey = getMediaKey(item);

    const currentItem = myList[mediaKey];

    if (!isSearching && viewMode === 'list') {
      const status = getFilterStatus(item, currentItem?.status);
      const year = item.year || Number((item.release_date || item.first_air_date || '').slice(0, 4)) || '';
      const poster = item.poster_path
        ? item.poster_path.startsWith('http')
          ? item.poster_path
          : `https://image.tmdb.org/t/p/w154${item.poster_path}`
        : 'https://via.placeholder.com/100x150?text=Steldra';

      return (
        <article key={mediaKey} className={styles.collectionListRow}>
          <button
            type="button"
            className={styles.collectionListOpen}
            onClick={() => {
              sessionStorage.setItem('steldra_selected_media', JSON.stringify(item));
              sessionStorage.setItem('steldra_collection_scroll_y', String(window.scrollY));
              window.location.href = `/media/${item.type}/${item.id}`;
            }}
          >
            <img src={poster} alt={item.title} />
            <span>
              <strong>{item.title}</strong>
              <small>{item.type}{year ? ` · ${year}` : ''} · {status === 'termine' ? 'Terminé' : status === 'en_cours' ? 'En cours' : 'À voir'}</small>
            </span>
          </button>
          <div className={styles.collectionListActions}>
            <button type="button" className={currentItem?.favorite ? styles.favoriteActive : ''} onClick={() => void handleToggleFavorite(item)}>{currentItem?.favorite ? '★' : '☆'}</button>
            <button type="button" onClick={() => void handleToggleInProgress(item)}>En cours</button>
            <button type="button" onClick={() => void handleMarkWatched(item)}>Vu</button>
            <button type="button" onClick={() => void handleMarkToWatch(item)}>À voir</button>
          </div>
        </article>
      );
    }

    return (
      <MediaCard
        key={mediaKey}
        item={item}
        currentItem={currentItem}
        onMarkWatched={handleMarkWatched}
        onToggleInProgress={handleToggleInProgress}
        onMarkToWatch={handleMarkToWatch}
        onRemove={handleRemove}
        onToggleFavorite={handleToggleFavorite}
      />
    );
  })}
</div>

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
        </div>
  </>
);
}