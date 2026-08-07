'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import ReviewSection from './ReviewSection';
import type { LoadedMediaDetails } from '../hooks/useMediaDetails';
import type { MediaItem, MediaReview, ReviewRating, MyListItem, WatchStatus } from '../types/media';
import MediaCard from './mediaCard';

type Actor = {
  id: number | string;
  name: string;
  character?: string;
  profile_path?: string | null;
  image_url?: string | null;
  voice_actor?: string | null;
  language?: string | null;
};

type Episode = {
  id: number;
  episode_number: number;
  season_number?: number;
  name: string;
  overview?: string;
  air_date?: string | null;
  still_path?: string | null;
  runtime?: number | null;
};

type PageTab = 'overview' | 'episodes' | 'reviews' | 'cast';

type MediaPageContentProps = {
  selectedMedia: MediaItem | null;
  detailsLoading: boolean;
  mediaDetails: LoadedMediaDetails  | null;
  reviews: MediaReview[];
  reviewRating: ReviewRating | null;
  reviewComment: string;
  userId: string | null;
  userName: string | null;
  mangaProgress: Record<string, number>;
  activeSeason: number;
  seasonEpisodes: Episode[];
  episodesLoading: boolean;
  watchedEpisodes: Record<string, boolean>;
  onRatingChange: (rating: ReviewRating) => void;
  onCommentChange: (comment: string) => void;
  onSubmitReview: () => void;
  onCancelReview: () => void;
  onDeleteReview: (...args: any[]) => void;
  onChapterChange: (chapter: number) => void;
  onLoadSeason: (mediaId: string | number, seasonNumber: number) => void;
  onToggleEpisode: (episodeNumber: number) => void;
  onMarkEpisodesUpTo: (
  episodeNumber: number,
  episodeNumbers: number[]
) => void;
customLists: {
  id: string;
  name: string;
}[];

addingToList: boolean;

onAddToCustomList: (media: MediaItem, listId: string) => void;

myList: Record<string, MyListItem>;
onMarkWatched: (media: MediaItem) => void;
onToggleInProgress: (media: MediaItem) => void;
onMarkToWatch: (media: MediaItem) => void;
onSetStatus: (media: MediaItem, status: WatchStatus) => void;
onRemoveFromCollection: (media: MediaItem) => void;
onToggleFavorite: (media: MediaItem) => void;

recommendations: Array<MediaItem & { recommendation_reason?: 'collection' | 'director' | 'cast' | 'similar' | 'recommended'; recommendation_label?: string; release_date?: string }>;
recommendationsLoading: boolean;

onToggleWholeSeason: (
  episodeNumbers: number[]
) => void;
};

const panelStyle = {
  backgroundColor: '#222831',
  border: '1px solid #393E46',
  borderRadius: '16px',
} as const;

export default function MediaPageContent({
  selectedMedia,
  detailsLoading,
  mediaDetails,
  reviews,
  reviewRating,
  reviewComment,
  userId,
  userName,
  mangaProgress,
  activeSeason,
  seasonEpisodes,
  episodesLoading,
  watchedEpisodes,
  customLists,
  addingToList,
  onAddToCustomList,
  myList,
  onMarkWatched,
  onToggleInProgress,
  onMarkToWatch,
  onSetStatus,
  onRemoveFromCollection,
  onToggleFavorite,
  recommendations,
  recommendationsLoading,
  onRatingChange,
  onCommentChange,
  onSubmitReview,
  onCancelReview,
  onDeleteReview,
  onChapterChange,
  onLoadSeason,
  onToggleEpisode,
  onMarkEpisodesUpTo,
  onToggleWholeSeason,
  
}: MediaPageContentProps) {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<PageTab>('overview');
  const [showFullSynopsis, setShowFullSynopsis] = useState(false);
  const [expandedEpisodes, setExpandedEpisodes] = useState<Record<string, boolean>>({});

  if (!selectedMedia) return null;

  const isManga = selectedMedia.type === 'manga' || selectedMedia.type === 'manhwa';
  const hasEpisodes = ['tv', 'anime', 'drama'].includes(selectedMedia.type);
  const mediaKey = `${selectedMedia.type}_${selectedMedia.id}`;
  const synopsis = mediaDetails?.synopsis || 'Aucun synopsis disponible.';
  const synopsisLimit = hasEpisodes ? 260 : 500;
  const shouldShortenSynopsis = synopsis.length > synopsisLimit;
  const displayedSynopsis = shouldShortenSynopsis && !showFullSynopsis
    ? `${synopsis.slice(0, synopsisLimit).trim()}...`
    : synopsis;

  const posterUrl = selectedMedia.poster_path
    ? selectedMedia.poster_path.startsWith('http')
      ? selectedMedia.poster_path
      : `https://image.tmdb.org/t/p/w300${selectedMedia.poster_path}`
    : 'https://via.placeholder.com/200x300';

  const releaseYear =
    Number(mediaDetails?.year) ||
    Number(selectedMedia.year) ||
    Number(
      String(
        mediaDetails?.release_date ||
        mediaDetails?.first_air_date ||
        selectedMedia.release_date ||
        selectedMedia.first_air_date ||
        ''
      ).slice(0, 4)
    ) ||
    null;

  const watchedCount = seasonEpisodes.filter((episode) => {
    const key = `${selectedMedia.type}_${selectedMedia.id}_S${activeSeason}E${episode.episode_number}`;
    return Boolean(watchedEpisodes[key]);
  }).length;

  const progressPercentage = seasonEpisodes.length
    ? Math.round((watchedCount / seasonEpisodes.length) * 100)
    : 0;

  const currentChapter = mangaProgress[mediaKey] || 0;
  const totalChapters = Number(selectedMedia.chapters) || 0;
  const totalVolumes = Number((selectedMedia as any).volumes) || 0;
  const remainingChapters = totalChapters > 0 ? Math.max(totalChapters - currentChapter, 0) : null;
  const nextChapter = totalChapters > 0 ? Math.min(currentChapter + 1, totalChapters) : currentChapter + 1;
  const mangaProgressPercentage = totalChapters > 0
    ? Math.min(Math.round((currentChapter / totalChapters) * 100), 100)
    : 0;

  const today = new Date();
  today.setHours(23, 59, 59, 999);

  const releasedEpisodeNumbers = seasonEpisodes
  .filter((episode) => {
    if (!episode.air_date) {
      return true;
    }

    return new Date(episode.air_date) <= today;
  })
  .map((episode) => episode.episode_number);

const wholeSeasonWatched =
  releasedEpisodeNumbers.length > 0 &&
  releasedEpisodeNumbers.every(
    (episodeNumber) => {
      const episodeKey =
        `${mediaKey}_S${activeSeason}E${episodeNumber}`;

      return Boolean(
        watchedEpisodes[episodeKey]
      );
    }
  );

  const formatEpisodeDate = (airDate?: string | null) => {
    if (!airDate) return 'Date inconnue';
    return new Intl.DateTimeFormat('fr-FR', {
      day: 'numeric', month: 'long', year: 'numeric',
    }).format(new Date(airDate));
  };

  const tabs: Array<{ value: PageTab; label: string }> = [
    { value: 'overview', label: 'Aperçu' },
    ...(hasEpisodes ? [{ value: 'episodes' as const, label: 'Épisodes' }] : []),
    { value: 'reviews', label: 'Avis' },
    ...(mediaDetails?.actors?.length ? [{ value: 'cast' as const, label: 'Casting' }] : []),
  ];

  return (
    <main style={{ minHeight: '100vh', backgroundColor: '#1b1f24', color: '#EEEEEE', padding: 'clamp(1rem, 3vw, 2rem)' }}>
      <div style={{ maxWidth: '1050px', margin: '0 auto' }}>
        <button type="button" onClick={() => router.back()} style={{ marginBottom: '1rem', padding: 0, border: 'none', background: 'transparent', color: '#00ADB5', fontWeight: 'bold', cursor: 'pointer' }}>
          ← Retour
        </button>

        <section style={{ ...panelStyle, padding: 'clamp(1rem, 3vw, 1.5rem)' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'minmax(95px, 130px) minmax(0, 1fr)', gap: 'clamp(1rem, 3vw, 1.5rem)', alignItems: 'start' }}>
            <img src={posterUrl} alt={`Affiche de ${selectedMedia.title}`} referrerPolicy="no-referrer" style={{ width: '100%', borderRadius: '10px', objectFit: 'cover', aspectRatio: '2 / 3' }} />

            <div style={{ minWidth: 0 }}>
              <h1 style={{ margin: 0, color: '#00ADB5', fontSize: 'clamp(1.45rem, 4vw, 2rem)', lineHeight: 1.15 }}>{selectedMedia.title}</h1>

              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', marginTop: '0.75rem' }}>
                <span style={{ padding: '0.3rem 0.65rem', borderRadius: '20px', backgroundColor: '#393E46', fontSize: '0.75rem', fontWeight: 'bold', textTransform: 'uppercase' }}>{selectedMedia.type}</span>
                {releaseYear && (
                  <span
                    title="Année de sortie"
                    style={{
                      padding: '0.3rem 0.65rem',
                      borderRadius: '20px',
                      backgroundColor: '#393E46',
                      fontSize: '0.75rem',
                    }}
                  >
                    {releaseYear}
                  </span>
                )}
                {mediaDetails?.runtime ? (
                  <span style={{ padding: '0.3rem 0.65rem', borderRadius: '20px', backgroundColor: '#393E46', fontSize: '0.75rem' }}>
                    {Math.floor(mediaDetails.runtime / 60) > 0 ? `${Math.floor(mediaDetails.runtime / 60)} h ${mediaDetails.runtime % 60} min` : `${mediaDetails.runtime} min`}
                  </span>
                ) : mediaDetails?.episode_runtime ? (
                  <span style={{ padding: '0.3rem 0.65rem', borderRadius: '20px', backgroundColor: '#393E46', fontSize: '0.75rem' }}>{mediaDetails.episode_runtime} min / épisode</span>
                ) : null}
                {hasEpisodes && (mediaDetails?.seasons_count ?? 0) > 0 && (
                <span
                    style={{
                    padding: '0.3rem 0.65rem',
                    borderRadius: '20px',
                    backgroundColor: '#393E46',
                    fontSize: '0.75rem',
                    }}
                >
                    {mediaDetails?.seasons_count ?? 0}{' '}
                    {(mediaDetails?.seasons_count ?? 0) > 1
                    ? 'saisons'
                    : 'saison'}
                </span>
                )}
              </div>

              {hasEpisodes && seasonEpisodes.length > 0 && (
                <div style={{ marginTop: '1rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.4rem', fontSize: '0.82rem' }}>
                    <span style={{ opacity: 0.75 }}>Saison {activeSeason} · {watchedCount}/{seasonEpisodes.length} vus</span>
                    <strong style={{ color: '#00ADB5' }}>{progressPercentage} %</strong>
                  </div>
                  <div style={{ height: '7px', backgroundColor: '#393E46', borderRadius: '20px', overflow: 'hidden' }}>
                    <div style={{ width: `${progressPercentage}%`, height: '100%', backgroundColor: progressPercentage === 100 ? '#4CAF50' : '#00ADB5' }} />
                  </div>
                </div>
              )}

              {isManga && (
                <div style={{ marginTop: '1rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.4rem', fontSize: '0.82rem' }}>
                    <span style={{ opacity: 0.75 }}>Chapitre {currentChapter}{totalChapters > 0 ? ` sur ${totalChapters}` : ''}</span>
                    {totalChapters > 0 && <strong style={{ color: '#00ADB5' }}>{mangaProgressPercentage} %</strong>}
                  </div>
                  {totalChapters > 0 && (
                    <div style={{ height: '7px', backgroundColor: '#393E46', borderRadius: '20px', overflow: 'hidden' }}>
                      <div style={{ width: `${mangaProgressPercentage}%`, height: '100%', backgroundColor: mangaProgressPercentage === 100 ? '#4CAF50' : '#00ADB5' }} />
                    </div>
                  )}
                </div>
              )}


              <div style={{ marginTop: '1rem', display: 'flex', gap: '0.55rem', flexWrap: 'wrap' }}>
                <button type="button" onClick={() => onMarkWatched(selectedMedia)} style={{ minHeight: '38px', padding: '0.45rem 0.8rem', border: 'none', borderRadius: '10px', backgroundColor: myList[mediaKey]?.status === 'vu' ? '#4CAF50' : '#393E46', color: '#fff', fontWeight: 'bold', cursor: 'pointer' }}>
                  {isManga ? 'Lu' : 'Vu'}
                </button>
                <button type="button" onClick={() => onToggleInProgress(selectedMedia)} style={{ minHeight: '38px', padding: '0.45rem 0.8rem', border: 'none', borderRadius: '10px', backgroundColor: myList[mediaKey]?.status === 'en_cours' ? '#FF4C29' : '#393E46', color: '#fff', fontWeight: 'bold', cursor: 'pointer' }}>
                  En cours
                </button>
                <button type="button" onClick={() => onMarkToWatch(selectedMedia)} style={{ minHeight: '38px', padding: '0.45rem 0.8rem', border: 'none', borderRadius: '10px', backgroundColor: myList[mediaKey]?.status === 'a_voir' ? '#00ADB5' : '#393E46', color: '#fff', fontWeight: 'bold', cursor: 'pointer' }}>
                  {isManga ? 'À lire' : 'À voir'}
                </button>
                <button type="button" onClick={() => onSetStatus(selectedMedia, 'en_pause')} style={{ minHeight: '38px', padding: '0.45rem 0.8rem', border: 'none', borderRadius: '10px', backgroundColor: myList[mediaKey]?.status === 'en_pause' ? '#d69e2e' : '#393E46', color: '#fff', fontWeight: 'bold', cursor: 'pointer' }}>
                  En pause
                </button>
                <button type="button" onClick={() => onSetStatus(selectedMedia, 'abandonne')} style={{ minHeight: '38px', padding: '0.45rem 0.8rem', border: 'none', borderRadius: '10px', backgroundColor: myList[mediaKey]?.status === 'abandonne' ? '#8b5cf6' : '#393E46', color: '#fff', fontWeight: 'bold', cursor: 'pointer' }}>
                  Abandonné
                </button>
                {myList[mediaKey] && (
                  <button type="button" onClick={() => onToggleFavorite(selectedMedia)} style={{ minHeight: '38px', padding: '0.45rem 0.8rem', border: '1px solid rgba(0,173,181,.45)', borderRadius: '10px', backgroundColor: myList[mediaKey]?.favorite ? '#00ADB5' : 'transparent', color: myList[mediaKey]?.favorite ? '#071012' : '#7ce9ee', fontWeight: 'bold', cursor: 'pointer' }}>
                    {myList[mediaKey]?.favorite ? 'Favori' : 'Ajouter aux favoris'}
                  </button>
                )}
                {myList[mediaKey] && (
                  <button type="button" onClick={() => { if (window.confirm(`Supprimer « ${selectedMedia.title} » de ta collection ?`)) onRemoveFromCollection(selectedMedia); }} style={{ minHeight: '38px', padding: '0.45rem 0.8rem', border: '1px solid rgba(216,74,74,.65)', borderRadius: '10px', backgroundColor: 'transparent', color: '#ff8f8f', fontWeight: 'bold', cursor: 'pointer' }}>
                    Retirer de la collection
                  </button>
                )}
              </div>

              <div
                style={{
                  marginTop: '1rem',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.6rem',
                  flexWrap: 'wrap',
                }}
              >
                <span
                  style={{
                    fontSize: '0.82rem',
                    fontWeight: 'bold',
                  }}
                >
                  Ajouter à une liste
                </span>

                {customLists.length > 0 ? (
                  <select
                    defaultValue=""
                    disabled={addingToList}
                    onChange={(event) => {
                      const listId = event.target.value;

                      if (!listId) return;

                      onAddToCustomList(selectedMedia, listId);
                      event.target.value = '';
                    }}
                    style={{
                      minHeight: '38px',
                      padding: '0.45rem 0.8rem',
                      backgroundColor: '#393E46',
                      color: '#FFFFFF',
                      border: '1px solid #4b515a',
                      borderRadius: '10px',
                      fontWeight: 'bold',
                      cursor: addingToList
                        ? 'not-allowed'
                        : 'pointer',
                    }}
                  >
                    <option value="">
                      {addingToList
                        ? 'Ajout en cours…'
                        : '+ Choisir une liste'}
                    </option>

                    {customLists.map((list) => (
                      <option key={list.id} value={list.id}>
                        {list.name}
                      </option>
                    ))}
                  </select>
                ) : (
                  <button
                    type="button"
                    onClick={() => router.push('/lists')}
                    style={{
                      minHeight: '38px',
                      padding: '0.45rem 0.8rem',
                      backgroundColor: '#00ADB5',
                      color: '#071012',
                      border: 'none',
                      borderRadius: '10px',
                      fontWeight: 'bold',
                      cursor: 'pointer',
                    }}
                  >
                    + Créer une liste
                  </button>
                )}
              </div>
            </div>
          </div>
        </section>

        <nav style={{ display: 'flex', gap: '0.25rem', marginTop: '1rem', overflowX: 'auto', borderBottom: '1px solid #393E46' }}>
          {tabs.map((tab) => (
            <button key={tab.value} type="button" onClick={() => setActiveTab(tab.value)} style={{ padding: '0.85rem 1rem', border: 'none', borderBottom: activeTab === tab.value ? '3px solid #00ADB5' : '3px solid transparent', background: 'transparent', color: activeTab === tab.value ? '#00ADB5' : '#EEEEEE', fontWeight: 'bold', cursor: 'pointer', whiteSpace: 'nowrap' }}>
              {tab.label}
            </button>
          ))}
        </nav>

        <section style={{ ...panelStyle, marginTop: '1rem', padding: 'clamp(1rem, 3vw, 1.5rem)' }}>
          {activeTab === 'overview' && (
            <>
              <h2 style={{ margin: '0 0 0.8rem', fontSize: '1.15rem' }}>Synopsis</h2>
              {detailsLoading ? <p style={{ opacity: 0.55 }}>Chargement du résumé...</p> : (
                <>
                  <p style={{ margin: 0, lineHeight: 1.65, opacity: 0.86 }}>{displayedSynopsis}</p>
                  {shouldShortenSynopsis && (
                    <button type="button" onClick={() => setShowFullSynopsis((current) => !current)} style={{ marginTop: '0.65rem', padding: 0, border: 'none', background: 'transparent', color: '#00ADB5', fontWeight: 'bold', cursor: 'pointer' }}>
                      {showFullSynopsis ? 'Voir moins' : 'Voir plus'}
                    </button>
                  )}
                </>
              )}

              {isManga && (
                <div style={{ marginTop: '1.5rem', paddingTop: '1.5rem', borderTop: '1px solid #393E46' }}>
                  <h2 style={{ margin: '0 0 1rem', fontSize: '1.15rem' }}>Progression de lecture</h2>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(145px, 1fr))', gap: '0.75rem' }}>
                    <Stat label="Chapitre actuel" value={currentChapter} color="#00ADB5" />
                    {remainingChapters !== null && <Stat label="Restant à lire" value={remainingChapters} color={remainingChapters === 0 ? '#4CAF50' : '#FFB347'} />}
                    {totalVolumes > 0 && <Stat label="Tomes connus" value={totalVolumes} />}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '0.55rem', marginTop: '1rem' }}>
                    <ChapterButton disabled={currentChapter <= 0} onClick={() => onChapterChange(Math.max(currentChapter - 1, 0))} background="#393E46">− 1</ChapterButton>
                    <input type="number" min={0} step={0.1} max={totalChapters > 0 ? totalChapters : undefined} value={currentChapter} onChange={(event) => {
                      const value = Number.parseFloat(event.target.value) || 0;
                      onChapterChange(totalChapters > 0 ? Math.min(Math.max(value, 0), totalChapters) : Math.max(value, 0));
                    }} style={{ width: '85px', padding: '0.55rem', border: '1px solid #4b515a', borderRadius: '8px', backgroundColor: '#393E46', color: '#FFF', textAlign: 'center', fontWeight: 'bold' }} />
                    <ChapterButton disabled={totalChapters > 0 && currentChapter >= totalChapters} onClick={() => onChapterChange(nextChapter)} background="#00ADB5">+ 1</ChapterButton>
                    <ChapterButton disabled={totalChapters > 0 && currentChapter >= totalChapters} onClick={() => onChapterChange(nextChapter)} background="#4CAF50" pushRight>✓ Chapitre {nextChapter} lu</ChapterButton>
                  </div>
                </div>
              )}
            </>
          )}

          {activeTab === 'episodes' && hasEpisodes && (
            <>
              <div
  style={{
    display: 'flex',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: '0.6rem',
  }}
>
  {mediaDetails &&
    mediaDetails.seasons_count > 0 && (
      <select
        value={activeSeason}
        onChange={(event) =>
          onLoadSeason(
            selectedMedia.id,
            Number(event.target.value)
          )
        }
        style={{
          padding: '0.65rem 0.85rem',
          borderRadius: '8px',
          border: '1px solid #4b515a',
          backgroundColor: '#393E46',
          color: '#EEEEEE',
          fontWeight: 'bold',
          cursor: 'pointer',
        }}
      >
        {Array.from(
          {
            length:
              mediaDetails.seasons_count,
          },
          (_, index) => index + 1
        ).map((seasonNumber) => (
          <option
            key={seasonNumber}
            value={seasonNumber}
          >
            Saison {seasonNumber}
          </option>
        ))}
      </select>
    )}

  <button
    type="button"
    disabled={
      releasedEpisodeNumbers.length === 0
    }
    onClick={() =>
      onToggleWholeSeason(
        releasedEpisodeNumbers
      )
    }
    style={{
      border: 'none',
      borderRadius: '20px',
      padding: '0.6rem 0.9rem',
      backgroundColor:
        wholeSeasonWatched
          ? '#393E46'
          : '#4CAF50',
      color: '#FFF',
      fontWeight: 'bold',
      cursor:
        releasedEpisodeNumbers.length > 0
          ? 'pointer'
          : 'not-allowed',
      opacity:
        releasedEpisodeNumbers.length > 0
          ? 1
          : 0.5,
    }}
  >
    {wholeSeasonWatched
      ? '↩ Réinitialiser la saison'
      : '✓ Toute la saison vue'}
  </button>
</div>

              {episodesLoading ? <p style={{ padding: '2rem 0', textAlign: 'center', opacity: 0.55 }}>Chargement des épisodes...</p> : seasonEpisodes.length === 0 ? <p style={{ opacity: 0.65 }}>Aucun épisode disponible.</p> : (
                <div style={{ borderTop: '1px solid #393E46' }}>
                  {seasonEpisodes.map((episode) => {
                    const key = `${selectedMedia.type}_${selectedMedia.id}_S${activeSeason}E${episode.episode_number}`;
                    const isWatched = Boolean(watchedEpisodes[key]);
                    const airDate = episode.air_date ? new Date(episode.air_date) : null;
                    const isReleased = !airDate || airDate <= today;
                    const isExpanded = Boolean(expandedEpisodes[key]);
                    return (
                      <article key={episode.id} style={{ borderBottom: '1px solid #393E46', backgroundColor: isWatched ? 'rgba(76, 175, 80, 0.08)' : 'transparent', opacity: isReleased ? 1 : 0.6 }}>
                        <div style={{ display: 'grid', gridTemplateColumns: '52px minmax(0, 1fr) auto', gap: '0.75rem', alignItems: 'center', padding: '0.85rem 0.35rem' }}>
                          <button type="button" onClick={() => setExpandedEpisodes((current) => ({ ...current, [key]: !current[key] }))} style={{ padding: 0, border: 'none', background: 'transparent', color: '#00ADB5', fontWeight: 'bold', cursor: 'pointer', textAlign: 'left' }}>E{String(episode.episode_number).padStart(2, '0')}</button>
                          <button type="button" onClick={() => setExpandedEpisodes((current) => ({ ...current, [key]: !current[key] }))} style={{ minWidth: 0, padding: 0, border: 'none', background: 'transparent', color: '#EEEEEE', textAlign: 'left', cursor: 'pointer' }}>
                            <strong style={{ display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: '0.93rem' }}>{episode.name || `Épisode ${episode.episode_number}`}</strong>
                            <span style={{ display: 'block', marginTop: '0.2rem', fontSize: '0.75rem', opacity: 0.6 }}>{formatEpisodeDate(episode.air_date)}{episode.runtime ? ` · ${episode.runtime} min` : ''}</span>
                          </button>
                    <button
                    type="button"
                    disabled={!isReleased}
                    onClick={() => {
                        const selectedEpisodeNumber =
                        episode.episode_number;

                        /*
                        * Si l’épisode est déjà vu,
                        * le clic sert simplement à le décocher.
                        */
                        if (isWatched) {
                        onToggleEpisode(
                            selectedEpisodeNumber
                        );

                        return;
                        }

                        /*
                        * Vérifie s’il existe des épisodes
                        * précédents qui ne sont pas cochés.
                        */
                        const hasPreviousUnwatchedEpisodes =
                        seasonEpisodes.some(
                            (previousEpisode) => {
                            if (
                                previousEpisode.episode_number >=
                                selectedEpisodeNumber
                            ) {
                                return false;
                            }

                            const previousAirDate =
                                previousEpisode.air_date
                                ? new Date(
                                    previousEpisode.air_date
                                    )
                                : null;

                            const previousIsReleased =
                                !previousAirDate ||
                                previousAirDate <= today;

                            if (!previousIsReleased) {
                                return false;
                            }

                            const previousEpisodeKey =
                                `${mediaKey}_S${activeSeason}` +
                                `E${previousEpisode.episode_number}`;

                            return !watchedEpisodes[
                                previousEpisodeKey
                            ];
                            }
                        );

                        /*
                        * Si tous les épisodes précédents
                        * sont déjà cochés, on coche seulement
                        * l’épisode sélectionné.
                        */
                        if (!hasPreviousUnwatchedEpisodes) {
                        onToggleEpisode(
                            selectedEpisodeNumber
                        );

                        return;
                        }

                        const shouldMarkPreviousEpisodes =
                        window.confirm(
                            `Veux-tu également marquer tous les épisodes précédents comme vus ?\n\n` +
                            `OK : épisodes 1 à ${selectedEpisodeNumber}\n` +
                            `Annuler : seulement l’épisode ${selectedEpisodeNumber}`
                        );

                        if (shouldMarkPreviousEpisodes) {
                        onMarkEpisodesUpTo(
                            selectedEpisodeNumber,
                            releasedEpisodeNumbers
                        );
                        } else {
                        onToggleEpisode(
                            selectedEpisodeNumber
                        );
                        }
                    }}
                    style={{
                        border: 'none',
                        borderRadius: '20px',
                        padding: '0.45rem 0.75rem',
                        backgroundColor: !isReleased
                        ? '#393E46'
                        : isWatched
                            ? '#4CAF50'
                            : '#00ADB5',
                        color: '#FFF',
                        fontWeight: 'bold',
                        cursor: isReleased
                        ? 'pointer'
                        : 'not-allowed',
                        fontSize: '0.78rem',
                        whiteSpace: 'nowrap',
                    }}
                    >
                    {!isReleased
                        ? 'À venir'
                        : isWatched
                        ? '✓ Vu'
                        : 'À voir'}
                    </button>                        </div>
                        {isExpanded && <div style={{ padding: '0 0.35rem 1rem 4.1rem' }}><p style={{ margin: 0, lineHeight: 1.55, fontSize: '0.86rem', opacity: 0.82 }}>{episode.overview || 'Aucun résumé disponible pour cet épisode.'}</p></div>}
                      </article>
                    );
                  })}
                </div>
              )}
            </>
          )}

          {activeTab === 'reviews' && (
            <ReviewSection media={selectedMedia} reviews={reviews} reviewRating={reviewRating} reviewComment={reviewComment} userId={userId} userName={userName} onRatingChange={onRatingChange} onCommentChange={onCommentChange} onSubmit={onSubmitReview} onCancel={onCancelReview} onDelete={onDeleteReview} />
          )}

          {activeTab === 'cast' && (
            <>
              <h2 style={{ margin: '0 0 1rem', fontSize: '1.15rem' }}>{selectedMedia.type === 'anime' ? 'Personnages et doubleurs' : 'Distribution'}</h2>
              {mediaDetails?.actors?.length ? (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(125px, 1fr))', gap: '0.8rem' }}>
                  {mediaDetails.actors.slice(0, 20).map((actor) => {
                    const imageUrl = actor.image_url || (actor.profile_path ? `https://image.tmdb.org/t/p/w185${actor.profile_path}` : null);
                    return (
                      <article key={`${actor.id}_${actor.name}`} style={{ overflow: 'hidden', border: '1px solid #393E46', borderRadius: '10px', backgroundColor: '#2d333b' }}>
                        {imageUrl ? <img src={imageUrl} alt={actor.name} referrerPolicy="no-referrer" style={{ width: '100%', height: '155px', objectFit: 'cover' }} /> : <div style={{ height: '155px', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: '#393E46', fontSize: '2rem' }}>👤</div>}
                        <div style={{ padding: '0.65rem' }}>
                          <strong style={{ display: 'block', fontSize: '0.8rem', lineHeight: 1.25 }}>{actor.name}</strong>
                          {actor.character && <span style={{ display: 'block', marginTop: '0.25rem', fontSize: '0.7rem', opacity: 0.65 }}>{actor.character}</span>}
                          {actor.voice_actor && <span style={{ display: 'block', marginTop: '0.3rem', color: '#00ADB5', fontSize: '0.7rem' }}>Voix : {actor.voice_actor}</span>}
                        </div>
                      </article>
                    );
                  })}
                </div>
              ) : <p style={{ opacity: 0.65 }}>Aucun casting disponible.</p>}
            </>
          )}
        </section>

        <section style={{ ...panelStyle, marginTop: '1rem', padding: 'clamp(1rem, 3vw, 1.5rem)' }}>
          <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: '1rem', marginBottom: '1rem' }}>
            <div>
              <h2 style={{ margin: 0, fontSize: '1.15rem' }}>À voir aussi</h2>
              <p style={{ margin: '0.3rem 0 0', opacity: 0.65, fontSize: '0.8rem' }}>Même saga, même réalisateur, casting commun et titres similaires sont proposés en priorité.</p>
            </div>
          </div>

          {recommendationsLoading ? (
            <p style={{ opacity: 0.65 }}>Recherche de recommandations…</p>
          ) : recommendations.length === 0 ? (
            <p style={{ opacity: 0.65 }}>Aucune recommandation disponible pour ce média.</p>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(105px, 1fr))', gap: '0.85rem' }}>
              {recommendations.map((recommendation) => {
                const recommendationKey = `${recommendation.type}_${recommendation.id}`;

                return (
                  <div key={recommendationKey} style={{ minWidth: 0 }}>
                    <div style={{ position: 'relative' }}>
                      <MediaCard
                        item={recommendation}
                        currentItem={myList[recommendationKey]}
                        onMarkWatched={onMarkWatched}
                        onToggleInProgress={onToggleInProgress}
                        onMarkToWatch={onMarkToWatch}
                        onRemove={onRemoveFromCollection}
                        onToggleFavorite={onToggleFavorite}
                        navigationMode="replace"
                        rememberCollectionPosition={false}
                      />
                      {recommendation.recommendation_label && (
                        <span style={{ position: 'absolute', left: '6px', bottom: '6px', zIndex: 12, maxWidth: 'calc(100% - 12px)', overflow: 'hidden', padding: '0.25rem 0.45rem', borderRadius: '999px', background: 'rgba(0,173,181,.94)', color: '#071012', fontSize: '0.58rem', fontWeight: 900, pointerEvents: 'none', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{recommendation.recommendation_label}</span>
                      )}
                    </div>
                    <strong style={{ display: 'block', marginTop: '0.45rem', overflow: 'hidden', fontSize: '0.76rem', lineHeight: 1.25, textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{recommendation.title}</strong>

                    {customLists.length > 0 && (
                      <select
                        defaultValue=""
                        disabled={addingToList}
                        onChange={(event) => {
                          const listId = event.target.value;
                          if (!listId) return;
                          onAddToCustomList(recommendation, listId);
                          event.target.value = '';
                        }}
                        style={{ width: '100%', marginTop: '0.4rem', minHeight: '32px', padding: '0.3rem 0.4rem', backgroundColor: '#393E46', color: '#fff', border: '1px solid #4b515a', borderRadius: '8px', fontSize: '0.7rem', cursor: addingToList ? 'not-allowed' : 'pointer' }}
                      >
                        <option value="">+ Liste</option>
                        {customLists.map((list) => (
                          <option key={list.id} value={list.id}>{list.name}</option>
                        ))}
                      </select>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}

function Stat({ label, value, color = '#EEEEEE' }: { label: string; value: number; color?: string }) {
  return (
    <div style={{ backgroundColor: '#2d333b', borderRadius: '10px', padding: '0.9rem' }}>
      <div style={{ opacity: 0.65, fontSize: '0.76rem' }}>{label}</div>
      <strong style={{ display: 'block', marginTop: '0.25rem', color, fontSize: '1.35rem' }}>{value}</strong>
    </div>
  );
}

function ChapterButton({ disabled, onClick, background, pushRight = false, children }: { disabled: boolean; onClick: () => void; background: string; pushRight?: boolean; children: React.ReactNode }) {
  return (
    <button type="button" disabled={disabled} onClick={onClick} style={{ marginLeft: pushRight ? 'auto' : undefined, border: 'none', borderRadius: '20px', padding: '0.55rem 0.9rem', backgroundColor: background, color: '#FFF', fontWeight: 'bold', cursor: disabled ? 'not-allowed' : 'pointer', opacity: disabled ? 0.5 : 1 }}>
      {children}
    </button>
  );
}