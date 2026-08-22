'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import ReviewSection from './ReviewSection';
import MainNav from './mainNav';
import type { LoadedMediaDetails } from '../hooks/useMediaDetails';
import type { MediaItem, MediaReview, ReviewRating, MyListItem, WatchStatus } from '../types/media';
import MediaCard from './mediaCard';
import { getPosterUrl, usePosterFallback } from '../lib/poster';
import styles from './mediaPageContent.module.css';

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

type PageTab = 'overview' | 'cast' | 'reviews' | 'trailers' | 'episodes';

type MediaPageContentProps = {
  selectedMedia: MediaItem | null;
  detailsLoading: boolean;
  mediaDetails: LoadedMediaDetails | null;
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
  onMarkEpisodesUpTo: (episodeNumber: number, episodeNumbers: number[]) => void;
  customLists: { id: string; name: string }[];
  addingToList: boolean;
  onAddToCustomList: (media: MediaItem, listId: string) => void;
  myList: Record<string, MyListItem>;
  onMarkWatched: (media: MediaItem) => void;
  onToggleInProgress: (media: MediaItem) => void;
  onMarkToWatch: (media: MediaItem) => void;
  onSetStatus: (media: MediaItem, status: WatchStatus) => void;
  onRemoveFromCollection: (media: MediaItem) => void;
  onToggleFavorite: (media: MediaItem) => void;
  recommendations: Array<MediaItem & {
    recommendation_reason?: 'collection' | 'director' | 'cast' | 'similar' | 'recommended';
    recommendation_label?: string;
    release_date?: string;
  }>;
  recommendationsLoading: boolean;
  onToggleWholeSeason: (episodeNumbers: number[]) => void;
};

export default function MediaPageContent(props: MediaPageContentProps) {
  const {
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
  } = props;

  const router = useRouter();
  const [activeTab, setActiveTab] = useState<PageTab>('overview');
  const [showFullSynopsis, setShowFullSynopsis] = useState(false);
  const [expandedEpisodes, setExpandedEpisodes] = useState<Record<string, boolean>>({});

  if (!selectedMedia) return null;

  const isManga = selectedMedia.type === 'manga' || selectedMedia.type === 'manhwa';
  const hasEpisodes = ['tv', 'anime', 'drama'].includes(selectedMedia.type);
  const mediaKey = `${selectedMedia.type}_${selectedMedia.id}`;
  const currentItem = myList[mediaKey];
  const synopsis = mediaDetails?.synopsis || selectedMedia.synopsis || 'Aucun synopsis disponible.';
  const synopsisLimit = 620;
  const shouldShortenSynopsis = synopsis.length > synopsisLimit;
  const displayedSynopsis = shouldShortenSynopsis && !showFullSynopsis
    ? `${synopsis.slice(0, synopsisLimit).trim()}…`
    : synopsis;

  const posterUrl = getPosterUrl(selectedMedia, 'w500');
  const rawBackdrop = mediaDetails?.backdrop_path;
  const backdropUrl = rawBackdrop
    ? rawBackdrop.startsWith('http')
      ? rawBackdrop
      : `https://image.tmdb.org/t/p/original${rawBackdrop}`
    : '/images/steldra-night.png';

  const releaseYear =
    Number(mediaDetails?.year) ||
    Number(selectedMedia.year) ||
    Number(String(mediaDetails?.release_date || mediaDetails?.first_air_date || selectedMedia.release_date || selectedMedia.first_air_date || '').slice(0, 4)) ||
    null;

  const formatRuntime = () => {
    const runtime = Number(mediaDetails?.runtime || 0);
    if (runtime > 0) {
      const hours = Math.floor(runtime / 60);
      const minutes = runtime % 60;
      return hours > 0 ? `${hours} h ${minutes ? `${minutes} min` : ''}`.trim() : `${runtime} min`;
    }
    const episodeRuntime = Number(mediaDetails?.episode_runtime || 0);
    return episodeRuntime > 0 ? `${episodeRuntime} min / épisode` : null;
  };

  const watchedCount = seasonEpisodes.filter((episode) => {
    const key = `${selectedMedia.type}_${selectedMedia.id}_S${activeSeason}E${episode.episode_number}`;
    return Boolean(watchedEpisodes[key]);
  }).length;
  const progressPercentage = seasonEpisodes.length ? Math.round((watchedCount / seasonEpisodes.length) * 100) : 0;

  const currentChapter = mangaProgress[mediaKey] || 0;
  const totalChapters = Number(selectedMedia.chapters) || 0;
  const totalVolumes = Number(selectedMedia.volumes) || 0;
  const remainingChapters = totalChapters > 0 ? Math.max(totalChapters - currentChapter, 0) : null;
  const nextChapter = totalChapters > 0 ? Math.min(currentChapter + 1, totalChapters) : currentChapter + 1;
  const mangaProgressPercentage = totalChapters > 0 ? Math.min(Math.round((currentChapter / totalChapters) * 100), 100) : 0;

  const today = new Date();
  today.setHours(23, 59, 59, 999);
  const releasedEpisodeNumbers = seasonEpisodes
    .filter((episode) => !episode.air_date || new Date(episode.air_date) <= today)
    .map((episode) => episode.episode_number);
  const wholeSeasonWatched = releasedEpisodeNumbers.length > 0 && releasedEpisodeNumbers.every((episodeNumber) => {
    const episodeKey = `${mediaKey}_S${activeSeason}E${episodeNumber}`;
    return Boolean(watchedEpisodes[episodeKey]);
  });

  const formatEpisodeDate = (airDate?: string | null) => {
    if (!airDate) return 'Date inconnue';
    return new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' }).format(new Date(airDate));
  };

  const trailers = mediaDetails?.trailers || [];
  const tabs: Array<{ value: PageTab; label: string }> = [
    { value: 'overview', label: 'À propos' },
    ...(mediaDetails?.actors?.length ? [{ value: 'cast' as const, label: 'Casting' }] : []),
    { value: 'reviews', label: 'Avis' },
    ...(trailers.length ? [{ value: 'trailers' as const, label: 'Bandes-annonces' }] : []),
    ...(hasEpisodes ? [{ value: 'episodes' as const, label: 'Saisons & épisodes' }] : []),
  ];

  const creators = (mediaDetails?.directors?.length ? mediaDetails.directors : mediaDetails?.creators || []).join(', ');
  const formatStatus = (value?: string | null) => {
    if (!value) return '—';
    const map: Record<string, string> = {
      Released: 'Sorti', Ended: 'Terminée', ReturningSeries: 'En cours', 'Returning Series': 'En cours',
      'Post Production': 'Post-production', InProduction: 'En production', 'In Production': 'En production',
    };
    return map[value] || value;
  };

  const renderCast = (limit = 20) => {
    if (!mediaDetails?.actors?.length) return <p className={styles.empty}>Aucun casting disponible.</p>;
    return (
      <div className={styles.castRail}>
        {mediaDetails.actors.slice(0, limit).map((actor) => {
          const imageUrl = actor.image_url || actor.profile_path || null;
          return (
            <article key={`${actor.id}_${actor.name}`} className={styles.castCard}>
              {imageUrl ? (
                <img className={styles.castImage} src={imageUrl} alt={actor.name} referrerPolicy="no-referrer" />
              ) : (
                <div className={styles.castPlaceholder}>👤</div>
              )}
              <div className={styles.castInfo}>
                <strong className={styles.castName}>{actor.name}</strong>
                {actor.character && <span className={styles.castRole}>{actor.character}</span>}
                {actor.voice_actor && <span className={styles.castVoice}>Voix : {actor.voice_actor}</span>}
              </div>
            </article>
          );
        })}
      </div>
    );
  };

  return (
    <div className={styles.page}>
      <MainNav />
      <main className={styles.shell}>
        <button type="button" className={styles.backButton} onClick={() => router.back()}>← Retour</button>

        <section className={styles.hero}>
          <img className={styles.backdrop} src={backdropUrl} alt="" aria-hidden="true" referrerPolicy="no-referrer" />
          <div className={styles.heroContent}>
            <img
              className={styles.poster}
              src={posterUrl}
              alt={`Affiche de ${selectedMedia.title}`}
              referrerPolicy="no-referrer"
              onError={(event) => usePosterFallback(event.currentTarget)}
            />

            <div className={styles.heroMain}>
              <div className={styles.kicker}>{hasEpisodes ? 'Série' : isManga ? 'Lecture' : 'Film'} · STELDRA</div>
              <h1 className={styles.title}>{selectedMedia.title}</h1>
              {mediaDetails?.tagline && <p className={styles.tagline}>{mediaDetails.tagline}</p>}

              <div className={styles.metaRow}>
                {releaseYear && <span>{releaseYear}</span>}
                {formatRuntime() && <span className={styles.metaDot}>{formatRuntime()}</span>}
                {hasEpisodes && (mediaDetails?.seasons_count || 0) > 0 && (
                  <span className={styles.metaDot}>{mediaDetails?.seasons_count} {(mediaDetails?.seasons_count || 0) > 1 ? 'saisons' : 'saison'}</span>
                )}
              </div>

              {typeof mediaDetails?.rating === 'number' && mediaDetails.rating > 0 && (
                <div className={styles.rating}>★ {mediaDetails.rating.toFixed(1)} / 10</div>
              )}

              {(mediaDetails?.genres?.length || selectedMedia.genres?.length) ? (
                <div className={styles.genreRow}>
                  {(mediaDetails?.genres?.length ? mediaDetails.genres : selectedMedia.genres || []).slice(0, 7).map((genre) => (
                    <span key={genre} className={styles.genrePill}>{genre}</span>
                  ))}
                </div>
              ) : null}

              {hasEpisodes && seasonEpisodes.length > 0 && (
                <div className={styles.progressBlock}>
                  <div className={styles.progressMeta}>
                    <span>Saison {activeSeason} · {watchedCount}/{seasonEpisodes.length} épisodes vus</span>
                    <strong>{progressPercentage} %</strong>
                  </div>
                  <div className={styles.progressTrack}><div className={styles.progressFill} style={{ width: `${progressPercentage}%` }} /></div>
                </div>
              )}

              {isManga && totalChapters > 0 && (
                <div className={styles.progressBlock}>
                  <div className={styles.progressMeta}><span>Chapitre {currentChapter} sur {totalChapters}</span><strong>{mangaProgressPercentage} %</strong></div>
                  <div className={styles.progressTrack}><div className={styles.progressFill} style={{ width: `${mangaProgressPercentage}%` }} /></div>
                </div>
              )}

              <div className={styles.actionRow}>
                <button type="button" onClick={() => onMarkWatched(selectedMedia)} className={`${styles.actionButton} ${currentItem?.status === 'vu' ? styles.activeWatched : ''}`}>✓ {isManga ? 'Lu' : 'Vu'}</button>
                <button type="button" onClick={() => onToggleInProgress(selectedMedia)} className={`${styles.actionButton} ${currentItem?.status === 'en_cours' ? styles.activeProgress : ''}`}> En cours</button>
                <button type="button" onClick={() => onMarkToWatch(selectedMedia)} className={`${styles.actionButton} ${currentItem?.status === 'a_voir' ? styles.activeWatchlist : ''}`}>◉ {isManga ? 'À lire' : 'À voir'}</button>
                <button type="button" onClick={() => onSetStatus(selectedMedia, 'en_pause')} className={`${styles.actionButton} ${currentItem?.status === 'en_pause' ? styles.activePause : ''}`}>Ⅱ En pause</button>
                <button type="button" onClick={() => onSetStatus(selectedMedia, 'abandonne')} className={`${styles.actionButton} ${currentItem?.status === 'abandonne' ? styles.activeAbandoned : ''}`}>× Abandonné</button>
                {currentItem && (
                  <button type="button" onClick={() => onToggleFavorite(selectedMedia)} className={`${styles.favoriteButton} ${currentItem.favorite ? styles.favoriteActive : ''}`}>
                    {currentItem.favorite ? '♥ Favori' : '♡ Favori'}
                  </button>
                )}
                {currentItem && (
                  <button type="button" onClick={() => { if (window.confirm(`Supprimer « ${selectedMedia.title} » de ta collection ?`)) onRemoveFromCollection(selectedMedia); }} className={styles.dangerButton}>Retirer</button>
                )}
              </div>

              <div className={styles.listPicker}>
                <span>+ Ajouter à une liste</span>
                {customLists.length > 0 ? (
                  <select defaultValue="" disabled={addingToList} onChange={(event) => {
                    const listId = event.target.value;
                    if (!listId) return;
                    onAddToCustomList(selectedMedia, listId);
                    event.target.value = '';
                  }}>
                    <option value="">{addingToList ? 'Ajout en cours…' : 'Choisir une liste'}</option>
                    {customLists.map((list) => <option key={list.id} value={list.id}>{list.name}</option>)}
                  </select>
                ) : (
                  <button type="button" onClick={() => router.push('/lists')}>Créer une liste</button>
                )}
              </div>
            </div>

            <aside className={styles.sideCard}>
              <InfoRow label={selectedMedia.type === 'tv' ? 'Création' : 'Réalisation'} value={creators || '—'} />
              <InfoRow label="Pays" value={mediaDetails?.countries?.join(', ') || '—'} />
              <InfoRow label="Statut" value={formatStatus(mediaDetails?.status)} />
              <InfoRow label="Sortie" value={mediaDetails?.release_date || mediaDetails?.first_air_date || (releaseYear ? String(releaseYear) : '—')} />
            </aside>
          </div>
        </section>

        <nav className={styles.tabs} aria-label="Informations du média">
          {tabs.map((tab) => (
            <button key={tab.value} type="button" onClick={() => setActiveTab(tab.value)} className={`${styles.tab} ${activeTab === tab.value ? styles.tabActive : ''}`}>
              {tab.label}
            </button>
          ))}
        </nav>

        {activeTab === 'overview' && (
          <>
            <section className={styles.section}>
              <div className={styles.overviewGrid}>
                <div>
                  <div className={styles.sectionHeader}>
                    <div><h2 className={styles.sectionTitle}>Synopsis</h2><p className={styles.sectionSubtitle}>L’histoire en quelques lignes</p></div>
                  </div>
                  {detailsLoading ? <p className={styles.empty}>Chargement du résumé…</p> : (
                    <>
                      <p className={styles.synopsis}>{displayedSynopsis}</p>
                      {shouldShortenSynopsis && <button type="button" className={styles.linkButton} onClick={() => setShowFullSynopsis((value) => !value)}>{showFullSynopsis ? 'Voir moins' : 'Voir plus'}</button>}
                    </>
                  )}
                </div>
                <div className={styles.techGrid}>
                  <TechItem label="Type" value={hasEpisodes ? (selectedMedia.type === 'anime' ? 'Animé' : selectedMedia.type === 'drama' ? 'Drama' : 'Série') : isManga ? selectedMedia.type : 'Film'} />
                  <TechItem label="Année" value={releaseYear ? String(releaseYear) : '—'} />
                  <TechItem label="Durée" value={formatRuntime() || '—'} />
                  {mediaDetails?.original_title && mediaDetails.original_title !== selectedMedia.title && <TechItem label="Titre original" value={mediaDetails.original_title} />}
                  {creators && <TechItem label={selectedMedia.type === 'tv' ? 'Création' : 'Réalisation'} value={creators} />}
                </div>
              </div>
            </section>

            {mediaDetails?.actors?.length ? (
              <section className={styles.section}>
                <div className={styles.sectionHeader}>
                  <div><h2 className={styles.sectionTitle}>Casting principal</h2><p className={styles.sectionSubtitle}>Les visages derrière l’histoire</p></div>
                  <button type="button" className={styles.linkButton} onClick={() => setActiveTab('cast')}>Tout voir →</button>
                </div>
                {renderCast(10)}
              </section>
            ) : null}

            {isManga && (
              <section className={styles.section}>
                <div className={styles.sectionHeader}><div><h2 className={styles.sectionTitle}>Progression de lecture</h2><p className={styles.sectionSubtitle}>Continue exactement où tu t’es arrêté</p></div></div>
                <div className={styles.mangaStats}>
                  <Stat label="Chapitre actuel" value={currentChapter} />
                  {remainingChapters !== null && <Stat label="Restant à lire" value={remainingChapters} />}
                  {totalVolumes > 0 && <Stat label="Tomes connus" value={totalVolumes} />}
                </div>
                <div className={styles.chapterControls}>
                  <button type="button" className={styles.chapterButton} disabled={currentChapter <= 0} onClick={() => onChapterChange(Math.max(currentChapter - 1, 0))}>− 1</button>
                  <input type="number" min={0} step={0.1} max={totalChapters > 0 ? totalChapters : undefined} value={currentChapter} onChange={(event) => {
                    const value = Number.parseFloat(event.target.value) || 0;
                    onChapterChange(totalChapters > 0 ? Math.min(Math.max(value, 0), totalChapters) : Math.max(value, 0));
                  }} />
                  <button type="button" className={styles.chapterButton} disabled={totalChapters > 0 && currentChapter >= totalChapters} onClick={() => onChapterChange(nextChapter)}>+ 1</button>
                  <button type="button" className={styles.chapterButton} disabled={totalChapters > 0 && currentChapter >= totalChapters} onClick={() => onChapterChange(nextChapter)}>✓ Chapitre {nextChapter} lu</button>
                </div>
              </section>
            )}
          </>
        )}

        {activeTab === 'cast' && (
          <section className={styles.section}>
            <div className={styles.sectionHeader}><div><h2 className={styles.sectionTitle}>{selectedMedia.type === 'anime' ? 'Personnages et doubleurs' : 'Distribution'}</h2><p className={styles.sectionSubtitle}>Casting principal</p></div></div>
            {renderCast(24)}
          </section>
        )}

        {activeTab === 'reviews' && (
          <section className={styles.section}>
            <div className={styles.sectionHeader}><div><h2 className={styles.sectionTitle}>Avis</h2><p className={styles.sectionSubtitle}>{reviews.length ? `${reviews.length} avis STELDRA` : 'Partage ton ressenti'}</p></div></div>
            <ReviewSection media={selectedMedia} reviews={reviews} reviewRating={reviewRating} reviewComment={reviewComment} userId={userId} userName={userName} onRatingChange={onRatingChange} onCommentChange={onCommentChange} onSubmit={onSubmitReview} onCancel={onCancelReview} onDelete={onDeleteReview} />
          </section>
        )}

        {activeTab === 'trailers' && (
          <section className={styles.section}>
            <div className={styles.sectionHeader}><div><h2 className={styles.sectionTitle}>Bandes-annonces</h2><p className={styles.sectionSubtitle}>Vidéos disponibles pour ce titre</p></div></div>
            {trailers.length ? (
              <div className={styles.trailerGrid}>
                {trailers.map((trailer) => (
                  <article key={trailer.key} className={styles.trailerCard}>
                    <iframe className={styles.trailerFrame} src={`https://www.youtube-nocookie.com/embed/${trailer.key}`} title={trailer.name} loading="lazy" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowFullScreen />
                    <div className={styles.trailerName}>{trailer.name}</div>
                  </article>
                ))}
              </div>
            ) : <p className={styles.empty}>Aucune bande-annonce disponible.</p>}
          </section>
        )}

        {activeTab === 'episodes' && hasEpisodes && (
          <section className={styles.section}>
            <div className={styles.sectionHeader}><div><h2 className={styles.sectionTitle}>Saisons & épisodes</h2><p className={styles.sectionSubtitle}>Coche les épisodes réellement vus</p></div></div>
            <div className={styles.seasonTools}>
              {(mediaDetails?.seasons_count || 0) > 0 && (
                <select value={activeSeason} onChange={(event) => onLoadSeason(selectedMedia.id, Number(event.target.value))}>
                  {Array.from({ length: mediaDetails?.seasons_count || 0 }, (_, index) => index + 1).map((seasonNumber) => <option key={seasonNumber} value={seasonNumber}>Saison {seasonNumber}</option>)}
                </select>
              )}
              <button type="button" className={styles.seasonAction} disabled={releasedEpisodeNumbers.length === 0} onClick={() => onToggleWholeSeason(releasedEpisodeNumbers)}>
                {wholeSeasonWatched ? '↩ Réinitialiser la saison' : '✓ Toute la saison vue'}
              </button>
            </div>

            {episodesLoading ? <p className={styles.empty}>Chargement des épisodes…</p> : seasonEpisodes.length === 0 ? <p className={styles.empty}>Aucun épisode disponible.</p> : (
              <div className={styles.episodeList}>
                {seasonEpisodes.map((episode) => {
                  const key = `${selectedMedia.type}_${selectedMedia.id}_S${activeSeason}E${episode.episode_number}`;
                  const isWatched = Boolean(watchedEpisodes[key]);
                  const airDate = episode.air_date ? new Date(episode.air_date) : null;
                  const isReleased = !airDate || airDate <= today;
                  const isExpanded = Boolean(expandedEpisodes[key]);
                  return (
                    <article key={episode.id} className={`${styles.episode} ${isWatched ? styles.episodeWatched : ''}`} style={{ opacity: isReleased ? 1 : .55 }}>
                      <div className={styles.episodeMain}>
                        <button type="button" className={styles.episodeNumber} onClick={() => setExpandedEpisodes((current) => ({ ...current, [key]: !current[key] }))}>E{String(episode.episode_number).padStart(2, '0')}</button>
                        <button type="button" className={styles.episodeTitleButton} onClick={() => setExpandedEpisodes((current) => ({ ...current, [key]: !current[key] }))}>
                          <strong className={styles.episodeTitle}>{episode.name || `Épisode ${episode.episode_number}`}</strong>
                          <span className={styles.episodeMeta}>{formatEpisodeDate(episode.air_date)}{episode.runtime ? ` · ${episode.runtime} min` : ''}</span>
                        </button>
                        <button type="button" disabled={!isReleased} className={`${styles.episodeStatus} ${isWatched ? styles.episodeStatusWatched : ''}`} onClick={() => {
                          const selectedEpisodeNumber = episode.episode_number;
                          if (isWatched) { onToggleEpisode(selectedEpisodeNumber); return; }
                          const hasPreviousUnwatchedEpisodes = seasonEpisodes.some((previousEpisode) => {
                            if (previousEpisode.episode_number >= selectedEpisodeNumber) return false;
                            const previousAirDate = previousEpisode.air_date ? new Date(previousEpisode.air_date) : null;
                            if (previousAirDate && previousAirDate > today) return false;
                            const previousEpisodeKey = `${mediaKey}_S${activeSeason}E${previousEpisode.episode_number}`;
                            return !watchedEpisodes[previousEpisodeKey];
                          });
                          if (!hasPreviousUnwatchedEpisodes) { onToggleEpisode(selectedEpisodeNumber); return; }
                          const shouldMarkPreviousEpisodes = window.confirm(`Veux-tu également marquer tous les épisodes précédents comme vus ?\n\nOK : épisodes 1 à ${selectedEpisodeNumber}\nAnnuler : seulement l’épisode ${selectedEpisodeNumber}`);
                          if (shouldMarkPreviousEpisodes) onMarkEpisodesUpTo(selectedEpisodeNumber, releasedEpisodeNumbers);
                          else onToggleEpisode(selectedEpisodeNumber);
                        }}>
                          {!isReleased ? 'À venir' : isWatched ? '✓ Vu' : 'À voir'}
                        </button>
                      </div>
                      {isExpanded && <p className={styles.episodeOverview}>{episode.overview || 'Aucun résumé disponible pour cet épisode.'}</p>}
                    </article>
                  );
                })}
              </div>
            )}
          </section>
        )}

        <section className={styles.section}>
          <div className={styles.sectionHeader}>
            <div><h2 className={styles.sectionTitle}>À voir aussi</h2><p className={styles.sectionSubtitle}>Saga, réalisateur, casting commun et titres similaires en priorité</p></div>
          </div>
          {recommendationsLoading ? <p className={styles.empty}>Recherche de recommandations…</p> : recommendations.length === 0 ? <p className={styles.empty}>Aucune recommandation disponible pour ce média.</p> : (
            <div className={styles.recommendationGrid}>
              {recommendations.map((recommendation) => {
                const recommendationKey = `${recommendation.type}_${recommendation.id}`;
                return (
                  <div key={recommendationKey} className={styles.recommendationItem}>
                    <MediaCard item={recommendation} currentItem={myList[recommendationKey]} onMarkWatched={onMarkWatched} onToggleInProgress={onToggleInProgress} onMarkToWatch={onMarkToWatch} onRemove={onRemoveFromCollection} onToggleFavorite={onToggleFavorite} navigationMode="replace" rememberCollectionPosition={false} />
                    <strong className={styles.recommendationTitle}>{recommendation.title}</strong>
                    {recommendation.recommendation_label && <span className={styles.reason}>{recommendation.recommendation_label}</span>}
                    {customLists.length > 0 && (
                      <select className={styles.recommendationSelect} defaultValue="" disabled={addingToList} onChange={(event) => {
                        const listId = event.target.value;
                        if (!listId) return;
                        onAddToCustomList(recommendation, listId);
                        event.target.value = '';
                      }}>
                        <option value="">+ Liste</option>
                        {customLists.map((list) => <option key={list.id} value={list.id}>{list.name}</option>)}
                      </select>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return <div className={styles.infoRow}><span className={styles.infoLabel}>{label}</span><strong className={styles.infoValue}>{value}</strong></div>;
}

function TechItem({ label, value }: { label: string; value: string }) {
  return <div className={styles.techItem}><span>{label}</span><strong>{value}</strong></div>;
}

function Stat({ label, value }: { label: string; value: number }) {
  return <div className={styles.statCard}><span className={styles.statLabel}>{label}</span><strong className={styles.statValue}>{value}</strong></div>;
}
