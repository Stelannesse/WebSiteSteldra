'use client';

import ReviewSection from './ReviewSection';
import type {
  MediaItem,
  MediaReview,
  ReviewRating,
} from '../types/media';

type MediaDetails = {
  synopsis: string;
  actors: any[];
  seasons_count: number;
  authors?: any[];
};

type MediaModalProps = {
  selectedMedia: MediaItem | null;
  detailsLoading: boolean;
  mediaDetails: MediaDetails | null;

  reviews: MediaReview[];
  reviewRating: ReviewRating;
  reviewComment: string;
  userId: string | null;
  userName: string | null;

  mangaProgress: Record<string, number>;

  activeSeason: number;
  seasonEpisodes: any[];
  episodesLoading: boolean;
  watchedEpisodes: Record<string, boolean>;

  onClose: () => void;
  onRatingChange: (rating: ReviewRating) => void;
  onCommentChange: (comment: string) => void;
  onSubmitReview: () => void;
  onCancelReview: () => void;
  onDeleteReview: (...args: any[]) => void;

  onChapterChange: (chapter: number) => void;
  onLoadSeason: (
    mediaId: string | number,
    seasonNumber: number
  ) => void;
  onToggleEpisode: (episodeNumber: number) => void;
};

export default function MediaModal({
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

  onClose,
  onRatingChange,
  onCommentChange,
  onSubmitReview,
  onCancelReview,
  onDeleteReview,

  onChapterChange,
  onLoadSeason,
  onToggleEpisode,
}: MediaModalProps) {
  if (!selectedMedia) {
    return null;
  }

  const mediaKey =
    `${selectedMedia.type}_${selectedMedia.id}`;

  const posterUrl = selectedMedia.poster_path
    ? selectedMedia.poster_path.startsWith('http')
      ? selectedMedia.poster_path
      : `https://image.tmdb.org/t/p/w200${selectedMedia.poster_path}`
    : 'https://via.placeholder.com/150x225';

  const watchedCount = seasonEpisodes.filter(
    (episode: any) => {
      const episodeKey =
        `${selectedMedia.type}_${selectedMedia.id}` +
        `_S${activeSeason}E${episode.episode_number}`;

      return Boolean(watchedEpisodes[episodeKey]);
    }
  ).length;

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        width: '100vw',
        height: '100vh',
        backgroundColor: 'rgba(0,0,0,0.85)',
        zIndex: 999,
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        padding: '1rem',
      }}
      onClick={onClose}
    >
      <div
        style={{
          backgroundColor: '#222831',
          color: '#EEEEEE',
          width: '100%',
          maxWidth: '750px',
          maxHeight: '85vh',
          borderRadius: '16px',
          overflowY: 'auto',
          padding: '2rem',
          position: 'relative',
          border: '1px solid #393E46',
        }}
        onClick={(event) => event.stopPropagation()}
      >
        <button
          type="button"
          style={{
            position: 'absolute',
            top: '1.5rem',
            right: '1.5rem',
            background: 'none',
            border: 'none',
            color: '#EEEEEE',
            fontSize: '1.5rem',
            cursor: 'pointer',
          }}
          onClick={onClose}
          aria-label="Fermer"
        >
          ✕
        </button>

        <div
          style={{
            display: 'flex',
            gap: '1.5rem',
            flexWrap: 'wrap',
            alignItems: 'flex-start',
          }}
        >
          <div
            style={{
              width: '130px',
              flexShrink: 0,
            }}
          >
            <img
              style={{
                width: '100%',
                borderRadius: '8px',
                objectFit: 'cover',
                aspectRatio: '2/3',
              }}
              referrerPolicy="no-referrer"
              src={posterUrl}
              alt={`Affiche de ${selectedMedia.title}`}
            />
          </div>

          <div
            style={{
              flex: 1,
              minWidth: '250px',
            }}
          >
            <h2
              style={{
                margin: '0 0 0.5rem 0',
                fontSize: '1.8rem',
                color: '#00ADB5',
              }}
            >
              {selectedMedia.title}
            </h2>

            <span
              style={{
                textTransform: 'uppercase',
                fontSize: '0.75rem',
                fontWeight: 'bold',
                padding: '0.2rem 0.6rem',
                borderRadius: '4px',
                background: '#393E46',
              }}
            >
              {selectedMedia.type}
            </span>

            <h3
              style={{
                margin: '1.2rem 0 0.5rem 0',
                fontSize: '1.1rem',
              }}
            >
              Synopsis
            </h3>

            {detailsLoading ? (
              <p style={{ opacity: 0.5 }}>
                Chargement du résumé...
              </p>
            ) : (
              <>
                <p
                  style={{
                    fontSize: '0.95rem',
                    opacity: 0.85,
                    lineHeight: '1.4',
                    margin: 0,
                  }}
                >
                  {mediaDetails?.synopsis ||
                    'Aucun synopsis disponible.'}
                </p>

                {(selectedMedia.type === 'manga' ||
                  selectedMedia.type === 'manhwa') && (
                  <div
                    style={{
                      marginTop: '0.8rem',
                      color: '#EEEEEE',
                    }}
                  >
                    <strong>
                      Auteur / Scénariste :
                    </strong>{' '}
                    {mediaDetails?.authors &&
                    mediaDetails.authors.length > 0
                      ? Array.isArray(
                          mediaDetails.authors
                        )
                        ? mediaDetails.authors.join(', ')
                        : mediaDetails.authors
                      : 'Non renseigné'}
                  </div>
                )}

                <ReviewSection
                  media={selectedMedia}
                  reviews={reviews}
                  reviewRating={reviewRating}
                  reviewComment={reviewComment}
                  userId={userId}
                  userName={userName}
                  onRatingChange={onRatingChange}
                  onCommentChange={onCommentChange}
                  onSubmit={onSubmitReview}
                  onCancel={onCancelReview}
                  onDelete={onDeleteReview}
                />
              </>
            )}
          </div>
        </div>

        {(selectedMedia.type === 'manga' ||
          selectedMedia.type === 'manhwa') && (
          <div
            style={{
              marginTop: '2rem',
              borderTop: '1px solid #393E46',
              paddingTop: '1.5rem',
            }}
          >
            <h3
              style={{
                fontSize: '1.1rem',
                marginBottom: '1rem',
              }}
            >
              Progression de lecture
            </h3>

            <div
              style={{
                marginBottom: '0.8rem',
                color: '#EEEEEE',
                display: 'flex',
                flexWrap: 'wrap',
                gap: '0.75rem',
              }}
            >
              {selectedMedia.chapters && (
                <span>
                  {selectedMedia.chapters} chapitres
                </span>
              )}

              {(selectedMedia as any).volumes && (
                <span>
                  {(selectedMedia as any).volumes} tomes
                </span>
              )}
            </div>

            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '1rem',
                flexWrap: 'wrap',
              }}
            >
              <span style={{ fontSize: '0.95rem' }}>
                Chapitre actuel :
              </span>

              <input
                type="number"
                min={0}
                value={mangaProgress[mediaKey] || 0}
                onChange={(event) =>
                  onChapterChange(
                    Number.parseInt(
                      event.target.value,
                      10
                    ) || 0
                  )
                }
                style={{
                  backgroundColor: '#393E46',
                  border: 'none',
                  color: '#FFF',
                  padding: '0.5rem',
                  borderRadius: '6px',
                  width: '80px',
                  textAlign: 'center',
                  fontWeight: 'bold',
                  fontSize: '1rem',
                }}
              />

              {selectedMedia.chapters && (
                <span
                  style={{
                    opacity: 0.6,
                    fontSize: '0.9rem',
                  }}
                >
                  / {selectedMedia.chapters} chapitres
                  au total
                </span>
              )}
            </div>
          </div>
        )}

        {mediaDetails &&
          mediaDetails.seasons_count > 0 && (
            <div
              style={{
                marginTop: '2rem',
                borderTop: '1px solid #393E46',
                paddingTop: '1.5rem',
              }}
            >
              <h3
                style={{
                  fontSize: '1.1rem',
                  marginBottom: '1rem',
                }}
              >
                Épisodes
              </h3>

              <div
                style={{
                  display: 'flex',
                  gap: '0.5rem',
                  overflowX: 'auto',
                  paddingBottom: '0.8rem',
                  marginBottom: '1.2rem',
                }}
              >
                {Array.from(
                  {
                    length:
                      mediaDetails.seasons_count,
                  },
                  (_, index) => index + 1
                ).map((seasonNumber) => (
                  <button
                    key={seasonNumber}
                    type="button"
                    onClick={() =>
                      onLoadSeason(
                        selectedMedia.id,
                        seasonNumber
                      )
                    }
                    style={{
                      padding: '0.5rem 1.2rem',
                      borderRadius: '8px',
                      border: 'none',
                      cursor: 'pointer',
                      fontWeight: 'bold',
                      whiteSpace: 'nowrap',
                      backgroundColor:
                        activeSeason === seasonNumber
                          ? '#00ADB5'
                          : '#393E46',
                      color:
                        activeSeason === seasonNumber
                          ? '#222831'
                          : '#FFF',
                    }}
                  >
                    Saison {seasonNumber}
                  </button>
                ))}
              </div>

              {!episodesLoading &&
                seasonEpisodes.length > 0 && (
                  <p
                    style={{
                      opacity: 0.75,
                      fontSize: '0.9rem',
                      marginBottom: '0.8rem',
                    }}
                  >
                    {watchedCount}/
                    {seasonEpisodes.length} épisodes vus
                  </p>
                )}

              {episodesLoading ? (
                <p
                  style={{
                    opacity: 0.5,
                    textAlign: 'center',
                  }}
                >
                  Chargement des épisodes...
                </p>
              ) : (
                <div
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '0.6rem',
                    maxHeight: '300px',
                    overflowY: 'auto',
                  }}
                >
                  {seasonEpisodes.map(
                    (episode: any) => {
                      const episodeKey =
                        `${selectedMedia.type}_${selectedMedia.id}` +
                        `_S${activeSeason}E${episode.episode_number}`;

                      const isWatched = Boolean(
                        watchedEpisodes[episodeKey]
                      );

                      return (
                        <div
                          key={episode.id}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent:
                              'space-between',
                            padding: '0.75rem 1rem',
                            backgroundColor:
                              '#2d333b',
                            borderRadius: '8px',
                            border:
                              '1px solid #393E46',
                          }}
                        >
                          <span
                            style={{
                              fontSize: '0.9rem',
                            }}
                          >
                            Épisode{' '}
                            {episode.episode_number}/
                            {seasonEpisodes.length}

                            <span
                              style={{
                                opacity: 0.6,
                                marginLeft: '0.5rem',
                              }}
                            >
                              {episode.name}
                            </span>
                          </span>

                          <button
                            type="button"
                            onClick={() =>
                              onToggleEpisode(
                                episode.episode_number
                              )
                            }
                            style={{
                              padding:
                                '0.4rem 1rem',
                              borderRadius: '20px',
                              border: 'none',
                              fontWeight: 'bold',
                              cursor: 'pointer',
                              backgroundColor:
                                isWatched
                                  ? '#4CAF50'
                                  : '#00ADB5',
                              color: '#FFF',
                            }}
                          >
                            {isWatched
                              ? '✓ Vu'
                              : 'À voir'}
                          </button>
                        </div>
                      );
                    }
                  )}
                </div>
              )}
            </div>
          )}
      </div>
    </div>
  );
}