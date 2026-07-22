'use client'; // Permet d'utiliser les fonctionnalités côté client

import { createClient } from './lib/supabase';
import { useState, useEffect, useMemo } from 'react'; // Gérer les données et les actions
import styles from './page.module.css'; //Importer le style de la page
import { useRouter } from 'next/navigation';  // Permet de changer de page

interface MediaItem { // Définition de l'interface pour les médias
  id: string | number; 
  title: string;
  poster_path?: string;
  runtime?: number;
  seasons?: number;
  episodes?: number;
  chapters?: number;
  synopsis?: string;
  type: 'movie' | 'tv' | 'drama' | 'anime' | 'manga' | 'manhwa';
}

export default function Home() {
  const supabase = createClient();
  const [query, setQuery] = useState(''); // État pour la recherche
  const [results, setResults] = useState<MediaItem[]>([]); // État pour les résultats de recherche
  const [loading, setLoading] = useState(false); // État pour indiquer si la recherche est en cours
  const router = useRouter(); // Permet de naviguer entre les pages
  const [isChecking, setIsChecking] = useState(true); // État pour vérifier si l'utilisateur est connecté
  const [userName, setUserName] = useState<string | null>(null); // État pour stocker le nom de l'utilisateur connecté
  const [userId, setUserId] = useState<string | null>(null); // État pour stocker l'ID de l'utilisateur connecté
  const [userEmail, setUserEmail] = useState<string | null>(null); // État pour stocker l'email de l'utilisateur connecté
  const [userAvatar, setUserAvatar] = useState<string | null>(null); // État pour stocker l'avatar de l'utilisateur connecté
  const [userRole, setUserRole] = useState<string | null>(null); // État pour stocker le rôle de l'utilisateur connecté
  const [userCreatedAt, setUserCreatedAt] = useState<string | null>(null); // État pour stocker la date de création du compte de l'utilisateur connecté
  const [showScrollTop, setShowScrollTop] = useState(false);
  const [sortOrder, setSortOrder] = useState<'default' | 'asc' | 'desc'>('asc'); // 'asc' pour A-Z par défaut

  type WatchStatus = 'vu' | 'a_voir';
  type FilterStatus = 'tout' | 'termine' | 'commence' | 'a_voir';

  const [statusFilter, setStatusFilter] = useState<FilterStatus>('tout');
  const [typeFilter, setTypeFilter] = useState<'tous' | 'movie' | 'tv' | 'drama' | 'anime' | 'manga' | 'manhwa'>('tous');

  const [myList, setMyList] = useState<{ 
  [key: string]: { 
    media: MediaItem; 
    status: WatchStatus; 
    watchCount?: number; // <--- Ajoute ceci ici pour dire à TypeScript que ça existe
  } 
}>({});
    
  // États pour la fiche détaillée "TV Time"
  const [selectedMedia, setSelectedMedia] = useState<MediaItem | null>(null);
  const [detailsLoading, setDetailsLoading] = useState(false);
  const [mediaDetails, setMediaDetails] = useState<{ synopsis: string; actors: any[]; seasons_count: number; authors?: any[] } | null>(null);
  const [activeSeason, setActiveSeason] = useState<number>(1);
  const [seasonEpisodes, setSeasonEpisodes] = useState<any[]>([]);
  const [episodesLoading, setEpisodesLoading] = useState(false);

  // Reviews (likes/dislikes + commentaire) par média
  const [reviewsByMedia, setReviewsByMedia] = useState<{ [key: string]: any[] }>({});
  const [reviewRating, setReviewRating] = useState<'like' | 'dislike'>('like');
  const [reviewComment, setReviewComment] = useState('');

  // Distribution calculée à partir de la liste personnelle
  const distribution = useMemo(() => {
    const counts: { [k: string]: number } = { movie: 0, tv: 0, drama: 0, anime: 0, manga: 0, manhwa: 0 };
    Object.values(myList).forEach((entry: any) => {
      const t = entry.media.type;
      counts[t] = (counts[t] || 0) + 1;
    });
    return counts;
  }, [myList]);

  // Charge les avis depuis Supabase (ou fallback localStorage)
  const loadReviews = async (mediaId: string | number) => {
    const mediaKey = mediaId.toString();
    try {
      const { data, error } = await supabase.from('media_reviews').select('*').eq('media_id', mediaKey).order('created_at', { ascending: false });
      if (error) throw error;
      setReviewsByMedia((p) => ({ ...p, [mediaKey]: data || [] }));
    } catch (err) {
      console.error('Erreur loadReviews:', err);
      const local = JSON.parse(localStorage.getItem(`steldra_reviews_${mediaKey}`) || '[]');
      setReviewsByMedia((p) => ({ ...p, [mediaKey]: local }));
    }
  };

  // Soumet un avis (Supabase, sinon fallback local)
  const submitReview = async (media: MediaItem, rating: 'like' | 'dislike', comment: string) => {
    const mediaKey = media.id.toString();
    const payload: any = {
      user_id: userId || null,
      user_name: userName || 'Anonyme',
      media_id: mediaKey,
      media_type: media.type,
      rating,
      comment,
      created_at: new Date().toISOString()
    };
    

    try {
      const { data, error } = await supabase.from('media_reviews').insert(payload).select().single();
      if (error) throw error;
      // insère le nouvel avis au début
      setReviewsByMedia((p) => ({ ...p, [mediaKey]: [data, ...(p[mediaKey] || [])] }));
      setReviewComment('');
      setReviewRating('like');
    } catch (err) {
      console.error('Erreur submitReview:', err);
      const existing = JSON.parse(localStorage.getItem(`steldra_reviews_${mediaKey}`) || '[]');
      const entry = { id: Date.now(), ...payload };
      existing.unshift(entry);
      localStorage.setItem(`steldra_reviews_${mediaKey}`, JSON.stringify(existing));
      setReviewsByMedia((p) => ({ ...p, [mediaKey]: existing }));
      setReviewComment('');
      setReviewRating('like');
    }
  };

  // Supprimer un avis (si propriétaire) — Supabase et fallback local
  const deleteReview = async (reviewId: string | number, mediaId: string | number, reviewUserId?: string | null, reviewUserName?: string | null) => {
    const mediaKey = mediaId.toString();

    // Autorisation basique : l'utilisateur courant doit être l'auteur
    if (reviewUserId && userId && reviewUserId === userId) {
      // ok
    } else if (reviewUserName && userName && reviewUserName === userName) {
      // ok
    } else if (!userId) {
      // Si pas connecté et l'avis vient d'un fallback local avec id numérique, on autorise suppression locale
      // mais sinon on refuse
    }

    try {
      // Essayer de supprimer côté Supabase
      const { error } = await supabase.from('media_reviews').delete().eq('id', reviewId);
      if (error) throw error;
      setReviewsByMedia((p) => ({ ...p, [mediaKey]: (p[mediaKey] || []).filter((r: any) => r.id !== reviewId) }));
    } catch (err) {
      console.warn('deleteReview supabase failed, falling back to local removal:', err);
      // fallback localStorage
      const existing = JSON.parse(localStorage.getItem(`steldra_reviews_${mediaKey}`) || '[]');
      const filtered = existing.filter((r: any) => r.id !== reviewId);
      localStorage.setItem(`steldra_reviews_${mediaKey}`, JSON.stringify(filtered));
      setReviewsByMedia((p) => ({ ...p, [mediaKey]: filtered }));
    }
  };
  
  // Suivi des épisodes vus et progression chapitres
  const [watchedEpisodes, setWatchedEpisodes] = useState<{ [key: string]: boolean }>({});
  const [mangaProgress, setMangaProgress] = useState<{ [key: string]: number }>({});  

  const getMediaKey = (media: MediaItem | { type: string; id: string | number }) => `${media.type}_${media.id}`;
  const hasStartedProgress = (mediaKey: string) => {
    const hasWatched = Object.keys(watchedEpisodes).some((key) => key.startsWith(`${mediaKey}_S`) && watchedEpisodes[key]);
    const progressValue = mangaProgress[mediaKey] || 0;
    return hasWatched || progressValue > 0;
  };

  const getFilterStatus = (media: MediaItem, currentStatus?: WatchStatus): FilterStatus => {
    const status = currentStatus || myList[getMediaKey(media)]?.status || 'a_voir';
    if (status === 'vu') return 'termine';
    return hasStartedProgress(getMediaKey(media)) ? 'commence' : 'a_voir';
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
    
      // Dans ton useEffect, change ceci :
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
        media: { ...media, type: mediaType, id: mediaId }, 
        status: item.status 
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
  const handleReset = (e: React.MouseEvent) => {
    e.preventDefault();
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

    const localSynopsis = media.synopsis || 'Aucun synopsis disponible.';
    
    // On définit un nombre de saisons par défaut pour forcer l'affichage
    const defaultSeasons = ['tv', 'anime', 'drama'].includes(media.type) ? (media.seasons || 1) : 0;

    try {
      let apiType = media.type === 'movie' ? 'movie' : 'tv';
      const res = await fetch(`/api/media-details?id=${media.id}&type=${apiType}`);
      const data = await res.json();

      setMediaDetails({
        synopsis: data.synopsis || localSynopsis,
        actors: data.actors || [],
        seasons_count: data.seasons_count || defaultSeasons,
        authors: data.authors || data.creators || []
      });

      // Charger les avis pour ce média
      loadReviews(media.id);

      // Appel immédiat des épisodes
      if (defaultSeasons > 0) loadSeasonEpisodes(media.id, 1);
      
    } catch (err) {
      setMediaDetails({ synopsis: localSynopsis, actors: [], seasons_count: defaultSeasons });
      if (defaultSeasons > 0) loadSeasonEpisodes(media.id, 1);
    } finally {
      setDetailsLoading(false);
    }
  };
// Fonction pour charger les épisodes d'une saison spécifique
  const loadSeasonEpisodes = async (mediaId: string | number, seasonNum: number) => {
    setActiveSeason(seasonNum);
    setEpisodesLoading(true);
    try {
      const res = await fetch(`/api/tv-season?id=${mediaId}&season=${seasonNum}`);
      const data = await res.json();
      // On s'assure que c'est un tableau, sinon on met vide
      setSeasonEpisodes(Array.isArray(data.episodes) ? data.episodes : []);
    } catch (err) {
      setSeasonEpisodes([]);
    } finally {
      setEpisodesLoading(false);
    }
  };
// Fonction pour marquer un épisode comme vu ou non vu
const toggleEpisodeWatched = async (episodeNum: number) => {
  if (!selectedMedia) return;
  const mediaKey = `${selectedMedia.type}_${selectedMedia.id}`;
  const epKey = `${mediaKey}_S${activeSeason}E${episodeNum}`;
  const updated = { ...watchedEpisodes, [epKey]: !watchedEpisodes[epKey] };
  
  setWatchedEpisodes(updated);
  localStorage.setItem('steldra_watched_episodes_v1', JSON.stringify(updated));

  const { data: { user } } = await supabase.auth.getUser();
  if (user) {
    await supabase.from('media_progress').upsert({
      user_id: user.id,
      media_id: selectedMedia.id.toString(),
      media_type: selectedMedia.type,
      media_data: selectedMedia,
      status: myList[mediaKey]?.status || 'a_voir',
      watched_episodes: updated
    });
  }
};

// Fonction pour gérer la progression des chapitres pour les mangas et manhwas
const handleChapterChange = async (value: number) => {
  if (!selectedMedia) return;
  const mediaKey = `${selectedMedia.type}_${selectedMedia.id}`;
  const updated = { ...mangaProgress, [mediaKey]: Math.max(0, value) };
  
  setMangaProgress(updated);
  localStorage.setItem('steldra_manga_progress_v1', JSON.stringify(updated));

  const { data: { user } } = await supabase.auth.getUser();
  if (user) {
    await supabase.from('media_progress').upsert({
      user_id: user.id,
      media_id: selectedMedia.id.toString(),
      media_type: selectedMedia.type,
      media_data: selectedMedia,
      status: myList[mediaKey]?.status || 'a_voir',
      manga_progress: Math.max(0, value)
    });
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
  const searchMedia = async (text: string) => {
    setQuery(text);
    if (text.trim().length < 2) {
      setResults([]);
      return;
    }
    
    setLoading(true);
    try {
      const res = await fetch(`/api/search?q=${encodeURIComponent(text)}`);
      const data = await res.json();
      console.log("Données reçues de l'API :", data.results); // AJOUTE CECI

      setResults(data.results || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  // Fonction pour gérer la déconnexion de l'utilisateur
  const isSearching = query.trim().length >= 2;
  // AJOUTE CECI JUSTE AVANT LA LIGNE "let displayItems = ..."
console.log("Contenu de myList :", Object.values(myList));
let displayItems = isSearching ? results : Object.values(myList).map(item => item.media);

// AJOUT TRI ALPHABÉTIQUE :
  displayItems.sort((a, b) => {
    if (sortOrder === 'asc') {
      return a.title.localeCompare(b.title);
    } else {
      return b.title.localeCompare(a.title);
    }
  });

const itemsForCount = Object.values(myList).filter(item => typeFilter === 'tous' || item.media.type === typeFilter);
const totalCount = itemsForCount.length;
const termineCount = itemsForCount.filter(item => getFilterStatus(item.media, item.status) === 'termine').length;
const commenceCount = itemsForCount.filter(item => getFilterStatus(item.media, item.status) === 'commence').length;
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
      
      <header className={styles.header}>
  {/* Ligne 1 : Logo + User + Déconnexion */}
  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
    <a href="#" className={styles.logo} onClick={handleReset}>Steldra</a>
  </div>

  {/* Ligne 3 : Filtres */}
      
        <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
          <button className={`${styles.filterBtn} ${typeFilter === 'tous' ? styles.active : ''}`} onClick={() => setTypeFilter('tous')}>Tout</button>
          <button className={`${styles.filterBtn} ${typeFilter === 'movie' ? styles.active : ''}`} onClick={() => setTypeFilter('movie')}>Films</button>
          <button className={`${styles.filterBtn} ${typeFilter === 'tv' ? styles.active : ''}`} onClick={() => setTypeFilter('tv')}>Séries</button>
          <button className={`${styles.filterBtn} ${typeFilter === 'drama' ? styles.active : ''}`} onClick={() => setTypeFilter('drama')}>Dramas</button>
          <button className={`${styles.filterBtn} ${typeFilter === 'anime' ? styles.active : ''}`} onClick={() => setTypeFilter('anime')}>Animes</button>
          <button className={`${styles.filterBtn} ${typeFilter === 'manga' ? styles.active : ''}`} onClick={() => setTypeFilter('manga')}>Mangas</button>
          <button className={`${styles.filterBtn} ${typeFilter === 'manhwa' ? styles.active : ''}`} onClick={() => setTypeFilter('manhwa')}>Manhwas</button>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
    {/* La recherche est seule ici */}
    <div className={styles.searchContainer}>
      <input 
        type="text" 
        placeholder="Rechercher..." 
        className={styles.searchInput} 
        value={query} 
        onChange={(e) => searchMedia(e.target.value)} 
      />
    </div>

    {/* Le bouton est isolé ici */}
    <button 
      onClick={handleLogout} 
      className={styles.logoutBtn}
      style={{ 
        padding: '0.5rem 1rem', 
        cursor: 'pointer', 
        backgroundColor: '#FF4757', 
        color: 'white', 
        border: 'none', 
        borderRadius: '6px',
        fontWeight: 'bold'
      }}
    >
      Déconnexion
    </button>
  </div>
</header>

<div style={{ display: 'flex', justifyContent: 'flex-end', padding: '1rem 1.6rem 0 1.6rem', maxWidth: '1400px', margin: '0 auto', width: '100%' }}>
        <select 
          value={sortOrder} 
          onChange={(e) => setSortOrder(e.target.value as 'asc' | 'desc')}
          style={{ background: '#2a2e35', color: '#EEEEEE', padding: '0.5rem 1rem', borderRadius: '20px', border: '1px solid rgba(0, 173, 181, 0.3)', cursor: 'pointer', outline: 'none' }}
        >
          <option value="asc">Ordre Alphabétique (A-Z)</option>
          <option value="desc">Ordre Alphabétique (Z-A)</option>
        </select>
      </div>

 {/*Ligne 4 : Résultats de recherche ou liste personnelle*/}
      {!isSearching && (
        <nav className={styles.navFilters} style={{ marginTop: '1.5rem', padding: '0 2rem' }}>
          <button className={`${styles.filterBtn} ${statusFilter === 'tout' ? styles.active : ''}`} onClick={() => setStatusFilter('tout')}>Tout ({totalCount})</button>
          <button className={`${styles.filterBtn} ${statusFilter === 'termine' ? styles.active : ''}`} onClick={() => setStatusFilter('termine')}>Terminé ({termineCount})</button>
          <button className={`${styles.filterBtn} ${statusFilter === 'commence' ? styles.active : ''}`} onClick={() => setStatusFilter('commence')}>Commencé ({commenceCount})</button>
          <button className={`${styles.filterBtn} ${statusFilter === 'a_voir' ? styles.active : ''}`} onClick={() => setStatusFilter('a_voir')}>À voir ({aVoirCount})</button>
        </nav>
      )}

      {loading && <p style={{ textAlign: 'center', color: '#393E46', fontWeight: 'bold', marginTop: '2rem' }}>Recherche en cours...</p>}

<div className={styles.liste}>
  {displayItems.map((media) => {
    const mediaKey = `${media.type}_${media.id}`;
    
    // Récupération sécurisée du nombre de visionnages
    const currentItem = myList[mediaKey];
    let watchCount = currentItem?.watchCount || (currentItem?.status === 'vu' ? 1 : 0);
    
    // Gestion de l'image (Films/Séries TMDB vs Mangas/Manhwas)
    const imageSrc = media.poster_path 
      ? (media.poster_path.startsWith('http') 
          ? media.poster_path 
          : `https://image.tmdb.org/t/p/w500${media.poster_path}`)
      : ((media as any).cover_image || (media as any).image_url || '/placeholder.png');

    const isReadingType = media.type === 'manga' || media.type === 'manhwa';

    // Détermine le texte du bouton jusqu'à x7
    let vuLabel = 'Vu';
    if (watchCount === 2) vuLabel = 'Vu x2';
    else if (watchCount === 3) vuLabel = 'Vu x3';
    else if (watchCount === 4) vuLabel = 'Vu x4';
    else if (watchCount === 5) vuLabel = 'Vu x5';
    else if (watchCount === 6) vuLabel = 'Vu x6';
    else if (watchCount === 7) vuLabel = 'Vu x7';
    else if (watchCount > 7) vuLabel = `Vu x${watchCount}`;

    return (
      <div 
        key={mediaKey} 
        className={styles.card} 
        onClick={() => openMediaDetails(media)}
      >
        {/* L'affiche pure */}
        <img 
          src={imageSrc} 
          alt={media.title} 
          className={styles.poster} 
        />
        
        {/* Bouton "Vu" / "Vu x2" ... jusqu'à "Vu x7" en haut à gauche */}
        <button 
          className={`${styles.btnTopLeft} ${watchCount > 0 ? styles.active : ''}`}
          onClick={async (e) => {
            e.stopPropagation();
            
            // Logique d'incrémentation : monte jusqu'à 7, puis reboucle à 1
            let nextCount = watchCount + 1;
            if (nextCount > 7) {
              nextCount = 1; 
            }
            
            // Mise à jour locale de l'état myList
            const updatedList = { ...myList };
            updatedList[mediaKey] = {
              media,
              status: 'vu',
              watchCount: nextCount
            };
            setMyList(updatedList);
            localStorage.setItem('steldra_multimedia_list_v1', JSON.stringify(updatedList));

            // Sauvegarde dans Supabase si l'utilisateur est connecté
            const { data: { user } } = await supabase.auth.getUser();
            if (user) {
              await supabase.from('media_progress').upsert({
                user_id: user.id,
                media_id: media.id.toString(),
                media_type: media.type,
                media_data: media,
                status: 'vu',
                watchCount: nextCount,
                watched_episodes: watchedEpisodes,
                manga_progress: mangaProgress[mediaKey] || 0
              });
            }
          }}
        >
          {watchCount === 0 ? 'Vu' : vuLabel}
        </button>

        {/* Bouton "À voir" ou "À lire" en haut à droite */}
        <button 
          className={`${styles.btnTopRight} ${currentItem?.status === 'a_voir' ? styles.active : ''}`}
          onClick={async (e) => {
            e.stopPropagation();
            
            const updatedList = { ...myList };
            updatedList[mediaKey] = {
              media,
              status: 'a_voir',
              watchCount: currentItem?.watchCount || 0
            };
            setMyList(updatedList);
            localStorage.setItem('steldra_multimedia_list_v1', JSON.stringify(updatedList));

            const { data: { user } } = await supabase.auth.getUser();
            if (user) {
              await supabase.from('media_progress').upsert({
                user_id: user.id,
                media_id: media.id.toString(),
                media_type: media.type,
                media_data: media,
                status: 'a_voir',
                watched_episodes: watchedEpisodes,
                manga_progress: mangaProgress[mediaKey] || 0
              });
            }
          }}
        >
          {isReadingType ? 'À lire' : 'À voir'}
        </button>
      </div>
    );
  })}
</div>

      {/* Fiche détaillée "TV Time" */}
      {selectedMedia && (
        <div style={{ position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', backgroundColor: 'rgba(0,0,0,0.85)', zIndex: 999, display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '1rem' }} onClick={() => setSelectedMedia(null)}>
          <div style={{ backgroundColor: '#222831', color: '#EEEEEE', width: '100%', maxWidth: '750px', maxHeight: '85vh', borderRadius: '16px', overflowY: 'auto', padding: '2rem', position: 'relative', border: '1px solid #393E46' }} onClick={(e) => e.stopPropagation()}>
            <button style={{ position: 'absolute', top: '1.5rem', right: '1.5rem', background: 'none', border: 'none', color: '#EEEEEE', fontSize: '1.5rem', cursor: 'pointer' }} onClick={() => setSelectedMedia(null)}>✕</button>
            
            <div style={{ display: 'flex', gap: '1.5rem', flexWrap: 'wrap', alignItems: 'flex-start' }}>
              <div style={{ width: '130px', flexShrink: 0 }}>
                <img style={{ width: '100%', borderRadius: '8px', objectFit: 'cover', aspectRatio: '2/3' }} 
                referrerPolicy="no-referrer"
                src={(() => {
                  
                  const rawImg = selectedMedia.poster_path || (selectedMedia as any).cover_image || (selectedMedia as any).image_url || (selectedMedia as any).image;
                  if (!rawImg) return 'https://via.placeholder.com/150x225';
                  return rawImg.startsWith('http') ? rawImg : `https://image.tmdb.org/t/p/w200${rawImg}`;
                })()} 
                alt="" />
              </div>

              <div style={{ flex: 1, minWidth: '250px' }}>
                <h2 style={{ margin: '0 0 0.5rem 0', fontSize: '1.8rem', color: '#00ADB5' }}>{selectedMedia.title}</h2>
                <span style={{ textTransform: 'uppercase', fontSize: '0.75rem', fontWeight: 'bold', padding: '0.2rem 0.6rem', borderRadius: '4px', background: '#393E46' }}>{selectedMedia.type}</span>
                
                <h3 style={{ margin: '1.2rem 0 0.5rem 0', fontSize: '1.1rem' }}>Synopsis</h3>
                {detailsLoading ? (
                  <p style={{ opacity: 0.5 }}>Chargement du résumé...</p>
                ) : (
                  <>
                    <p style={{ fontSize: '0.95rem', opacity: 0.85, lineHeight: '1.4', margin: 0 }}>{mediaDetails?.synopsis}</p>

                    {/* Auteur / Scénariste pour mangas / manhwas */}
                    {(selectedMedia.type === 'manga' || selectedMedia.type === 'manhwa') && (
                      <div style={{ marginTop: '0.8rem', color: '#EEEEEE' }}>
                        <strong>Auteur / Scénariste : </strong>
                        {mediaDetails?.authors && mediaDetails.authors.length > 0 ? (
                          Array.isArray(mediaDetails.authors) ? mediaDetails.authors.join(', ') : mediaDetails.authors
                        ) : (
                          'Non renseigné'
                        )}
                      </div>
                    )}

                    {/* Section Avis */}
                    <div style={{ marginTop: '1.2rem', borderTop: '1px solid #393E46', paddingTop: '1rem' }}>
                      <h3 style={{ fontSize: '1.1rem', marginBottom: '0.6rem' }}>Avis des utilisateurs</h3>

                      <div style={{ display: 'flex', gap: '0.6rem', alignItems: 'center', marginBottom: '0.6rem' }}>
                        <button onClick={() => setReviewRating('like')} style={{ padding: '0.4rem 0.8rem', borderRadius: '6px', border: reviewRating === 'like' ? '2px solid #00ADB5' : '1px solid #393E46', background: reviewRating === 'like' ? '#00ADB5' : '#2a2e35', color: reviewRating === 'like' ? '#222831' : '#FFF', cursor: 'pointer' }}>👍 J'aime</button>
                        <button onClick={() => setReviewRating('dislike')} style={{ padding: '0.4rem 0.8rem', borderRadius: '6px', border: reviewRating === 'dislike' ? '2px solid #FF6B6B' : '1px solid #393E46', background: reviewRating === 'dislike' ? '#FF6B6B' : '#2a2e35', color: reviewRating === 'dislike' ? '#222831' : '#FFF', cursor: 'pointer' }}>👎 Je n'aime pas</button>
                      </div>

                      <textarea value={reviewComment} onChange={(e) => setReviewComment(e.target.value)} placeholder="Laisser un commentaire (optionnel)" style={{ width: '100%', minHeight: '60px', padding: '0.6rem', borderRadius: '8px', background: '#222831', border: '1px solid #393E46', color: '#EEE', marginBottom: '0.6rem' }} />

                      <div style={{ display: 'flex', gap: '0.6rem' }}>
                        <button onClick={() => submitReview(selectedMedia, reviewRating, reviewComment)} style={{ padding: '0.6rem 1rem', background: '#00ADB5', border: 'none', color: '#222831', fontWeight: 'bold', borderRadius: '8px', cursor: 'pointer' }}>Envoyer</button>
                        <button onClick={() => { setReviewComment(''); setReviewRating('like'); }} style={{ padding: '0.6rem 1rem', background: '#393E46', border: 'none', color: '#EEE', borderRadius: '8px', cursor: 'pointer' }}>Annuler</button>
                      </div>

                      {/* Liste d'avis */}
                      <div style={{ marginTop: '1rem' }}>
                        {(reviewsByMedia[selectedMedia.id] || []).length === 0 ? (
                          <p style={{ opacity: 0.6 }}>Pas encore d'avis — soyez le premier !</p>
                        ) : (
                          (reviewsByMedia[selectedMedia.id] || []).map((r: any) => {
                            // Vérifie si l'utilisateur courant est l'auteur (ou si l'avis est stocké localement)
                            let canDelete = false;
                            try {
                              const local = JSON.parse(localStorage.getItem(`steldra_reviews_${selectedMedia.id}`) || '[]');
                              const isLocal = local.some((x:any) => x.id === r.id);
                              canDelete = (r.user_id && userId && r.user_id === userId) || (r.user_name && userName && r.user_name === userName) || isLocal;
                            } catch (e) { canDelete = (r.user_id && userId && r.user_id === userId) || (r.user_name && userName && r.user_name === userName); }

                            return (
                              <div key={r.id} style={{ padding: '0.6rem', background: '#2a2e35', borderRadius: '8px', marginBottom: '0.6rem', border: '1px solid #393E46' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.8rem' }}>
                                  <strong>{r.user_name || 'Utilisateur'}</strong>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                                    <span style={{ opacity: 0.7, fontSize: '0.85rem' }}>{new Date(r.created_at).toLocaleString()}</span>
                                    {canDelete && (
                                      <button onClick={() => deleteReview(r.id, selectedMedia.id, r.user_id, r.user_name)} style={{ background: 'transparent', border: '1px solid rgba(255,255,255,0.08)', color: '#EEE', padding: '0.25rem 0.5rem', borderRadius: '6px', cursor: 'pointer', fontSize: '0.8rem' }}>Supprimer</button>
                                    )}
                                  </div>
                                </div>
                                <div style={{ marginTop: '0.4rem' }}>{r.rating === 'like' ? '👍 J\'aime' : '👎 Je n\'aime pas'}</div>
                                {r.comment && <div style={{ marginTop: '0.4rem', opacity: 0.9 }}>{r.comment}</div>}
                              </div>
                            );
                          })
                        )}
                      </div>

                    </div>
                  </>
                )}
              </div>
            </div>

            {/* Progression Mangas / Manhwas */}
            {(selectedMedia.type === 'manga' || selectedMedia.type === 'manhwa') && (
              <div style={{ marginTop: '2rem', borderTop: '1px solid #393E46', paddingTop: '1.5rem' }}>
                <h3 style={{ fontSize: '1.1rem', marginBottom: '1rem' }}>Progression de lecture</h3>
                <div style={{ marginBottom: '0.8rem', color: '#EEEEEE', display: 'flex', flexWrap: 'wrap', gap: '0.75rem' }}>
                  {selectedMedia.chapters && <span>{selectedMedia.chapters} chapitres</span>}
                  {(selectedMedia as any).volumes && <span>{(selectedMedia as any).volumes} tomes</span>}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
                  <span style={{ fontSize: '0.95rem' }}>Chapitre actuel :</span>
                  <input 
                    type="number" 
                    value={mangaProgress[`${selectedMedia.type}_${selectedMedia.id}`] || 0} 
                    onChange={(e) => handleChapterChange(parseInt(e.target.value) || 0)}
                    style={{ backgroundColor: '#393E46', border: 'none', color: '#FFF', padding: '0.5rem', borderRadius: '6px', width: '80px', textAlign: 'center', fontWeight: 'bold', fontSize: '1rem' }}
                  />
                  {selectedMedia.chapters && (
                    <span style={{ opacity: 0.6, fontSize: '0.9rem' }}> / {selectedMedia.chapters} chapitres au total</span>
                  )}
                </div>
              </div>
            )}

            {/* Liste des Épisodes */}
            {mediaDetails && mediaDetails.seasons_count > 0 && (
              <div style={{ marginTop: '2rem', borderTop: '1px solid #393E46', paddingTop: '1.5rem' }}>
                <h3 style={{ fontSize: '1.1rem', marginBottom: '1rem' }}>Épisodes</h3>
                
                <div style={{ display: 'flex', gap: '0.5rem', overflowX: 'auto', paddingBottom: '0.8rem', marginBottom: '1.2rem' }}>
                  {Array.from({ length: mediaDetails.seasons_count }, (_, i) => i + 1).map((sNum) => (
                    <button key={sNum} onClick={() => loadSeasonEpisodes(selectedMedia.id, sNum)} style={{ padding: '0.5rem 1.2rem', borderRadius: '8px', border: 'none', cursor: 'pointer', fontWeight: 'bold', whiteSpace: 'nowrap', backgroundColor: activeSeason === sNum ? '#00ADB5' : '#393E46', color: activeSeason === sNum ? '#222831' : '#FFF' }}>
                      Saison {sNum}
                    </button>
                  ))}
                </div>
 
                {!episodesLoading && seasonEpisodes.length > 0 && (
                  <p style={{ opacity: 0.75, fontSize: '0.9rem', marginBottom: '0.8rem' }}>
                    {seasonEpisodes.filter((ep: any) => !!watchedEpisodes[`${selectedMedia.type}_${selectedMedia.id}_S${activeSeason}E${ep.episode_number}`]).length}/{seasonEpisodes.length} épisodes vus
                  </p>
                )}
 
                {episodesLoading ? (
                  <p style={{ opacity: 0.5, textAlign: 'center' }}>Chargement des épisodes...</p>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem', maxHeight: '300px', overflowY: 'auto' }}>
                    {seasonEpisodes.map((ep: any) => {
                      const epKey = `${selectedMedia.type}_${selectedMedia.id}_S${activeSeason}E${ep.episode_number}`;
                      const isWatched = !!watchedEpisodes[epKey];
 
                      return (
                        <div key={ep.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.75rem 1rem', backgroundColor: '#2d333b', borderRadius: '8px', border: '1px solid #393E46' }}>
                          <span style={{ fontSize: '0.9rem' }}>
                            Épisode {ep.episode_number}/{seasonEpisodes.length} <span style={{ opacity: 0.6, marginLeft: '0.5rem' }}>{ep.name}</span>
                          </span>
                          <button 
                            onClick={() => toggleEpisodeWatched(ep.episode_number)} 
                            style={{ padding: '0.4rem 1rem', borderRadius: '20px', border: 'none', fontWeight: 'bold', cursor: 'pointer', backgroundColor: isWatched ? '#4CAF50' : '#00ADB5', color: '#FFF' }}
                          >
                            {isWatched ? '✓ Vu' : 'À voir'}
                          </button>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

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