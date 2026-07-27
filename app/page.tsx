'use client'; // Permet d'utiliser les fonctionnalités côté client

import { createClient } from './lib/supabase';
import { useState, useEffect, useMemo } from 'react'; // Gérer les données et les actions
import styles from './page.module.css'; //Importer le style de la page
import MediaCard from './components/mediaCard';
import useReviews from './hooks/useReviews';
import MediaModal from './components/mediaModal';
import useMediaProgress from './hooks/useMediaProgress';
import Header from './components/header';
import type {
  MediaItem,
  MyListItem,
  WatchStatus,
  FilterStatus,
} from './types/media';

import {
  searchMedia,
  getMediaDetails,
  getSeasonEpisodes,
} from './lib/mediaService';

export default function Home() {
  const supabase = createClient();
  const [query, setQuery] = useState(''); // État pour la recherche
  const [results, setResults] = useState<MediaItem[]>([]); // État pour les résultats de recherche
  const [loading, setLoading] = useState(false); // État pour indiquer si la recherche est en cours
  const [userName, setUserName] = useState<string | null>(null); // État pour stocker le nom de l'utilisateur connecté
  const [userId, setUserId] = useState<string | null>(null); // État pour stocker l'ID de l'utilisateur connecté
  const [userCreatedAt, setUserCreatedAt] = useState<string | null>(null); // État pour stocker la date de création du compte de l'utilisateur connecté
  const [showScrollTop, setShowScrollTop] = useState(false);

  const [statusFilter, setStatusFilter] = useState<FilterStatus>('tout');
  const [typeFilter, setTypeFilter] = useState<'tous' | 'movie' | 'tv' | 'drama' | 'anime' | 'manga' | 'manhwa'>('tous');
  
const [myList, setMyList] = useState<{
  [key: string]: MyListItem;
}>({});
  
  // États pour la fiche détaillée "TV Time"
  const [selectedMedia, setSelectedMedia] = useState<MediaItem | null>(null);
  const [detailsLoading, setDetailsLoading] = useState(false);
  const [mediaDetails, setMediaDetails] = useState<{ synopsis: string; actors: any[]; seasons_count: number; authors?: any[] } | null>(null);
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

  const getFilterStatus = (media: MediaItem, currentStatus?: WatchStatus): FilterStatus => {
    const status = currentStatus || myList[getMediaKey(media)]?.status || 'a_voir';
    if (status === 'vu') return 'termine';
    return hasStartedProgress(getMediaKey(media)) ? 'en_cours' : 'a_voir';
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
  watchCount: item.watchCount || 0,
};
    
    // 4. On stocke le reste
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
  };

      // On met à jour l'état pour indiquer que la vérification est terminée
  loadInitialData();
}, []);  

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

    setMediaDetails({
      synopsis: data.synopsis || localSynopsis,
      actors: data.actors || [],
      seasons_count:
        data.seasons_count || defaultSeasons,
      authors: data.authors || data.creators || [],
    });

    loadReviews(media.id);

    if (defaultSeasons > 0) {
      loadSeasonEpisodes(media.id, 1);
    }
  } catch (error) {
    console.error(
      'Erreur lors du chargement des détails :',
      error
    );

    setMediaDetails({
      synopsis: localSynopsis,
      actors: [],
      seasons_count: defaultSeasons,
      authors: [],
    });

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
      await supabase.from('media_progress').upsert({ 
        user_id: user.id, 
        media_id: media.id.toString(), 
        media_type: media.type,
        media_data: media, 
        status: status,
        watched_episodes: watchedEpisodes,
        manga_progress: mangaProgress[mediaKey] || 0
      });
    }
  }
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

//filtrage
const itemsForCount = Object.values(myList).filter(item => typeFilter === 'tous' || item.media.type === typeFilter);
const totalCount = itemsForCount.length;
const termineCount = itemsForCount.filter(item => getFilterStatus(item.media, item.status) === 'termine').length;
const enCoursCount = itemsForCount.filter(item => getFilterStatus(item.media, item.status) === 'en_cours').length;
const aVoirCount = itemsForCount.filter(item => getFilterStatus(item.media, item.status) === 'a_voir').length;

displayItems = displayItems.filter(item => {
  const mediaType = (item.type || 'unknown').toLowerCase();
  const filterType = typeFilter.toLowerCase();
    
  // 1. Filtrage par type : Si on est en "Tout", on affiche tout, sinon on filtre par type.
  const matchesType = typeFilter === 'tous' || mediaType === filterType;
    
  // 2. Filtrage par statut :
  // Si on est en train de chercher (isSearching), on ignore le filtre de statut 
  // car les résultats de l'API ne sont pas encore dans "myList".
  // Si on n'est pas en recherche, on applique le filtre de statut habituel.
  let matchesStatus = true;
  if (!isSearching) {
    const status = getFilterStatus(item, myList[`${item.type}_${item.id}`]?.status);
    matchesStatus = statusFilter === 'tout' || status === statusFilter;
  }
    
  return matchesType && matchesStatus;
});

  return (
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

<div className={styles.liste}>
  {displayItems.map((item) => {
    const mediaKey = getMediaKey(item);

    return (
      <MediaCard
        key={mediaKey}
        item={item}
        currentItem={myList[mediaKey]}
        onOpen={openMediaDetails}
        onMarkWatched={handleMarkWatched}
        onToggleInProgress={handleToggleInProgress}
        onMarkToWatch={handleMarkToWatch}
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

        onClose={() => setSelectedMedia(null)}
        onRatingChange={setReviewRating}
        onCommentChange={setReviewComment}

        onSubmitReview={() => {
          if (!selectedMedia) return;

          submitReview(
            selectedMedia,
            reviewRating,
            reviewComment
          );
        }}

        onCancelReview={() => {
          setReviewComment('');
          setReviewRating('like');
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
    
  );
}