'use client';

import ReviewSection from './ReviewSection';
import { useState } from 'react';
import type {
  MediaItem,
  MediaReview,
  ReviewRating,
} from '../types/media';

type Actor = {
  id: number | string;
  name: string;
  character?: string;
  profile_path?: string | null;
  image_url?: string | null;
  voice_actor?: string | null;
  language?: string | null;
};

type MediaDetails = {
  synopsis: string;
  actors: Actor[];
  seasons_count: number;
  authors?: any[];

  runtime?: number | null;
  episode_runtime?: number | null;
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
  seasonEpisodes: Episode[];
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
  const [showFullSynopsis, setShowFullSynopsis] =
    useState(false);

  const [expandedEpisodes, setExpandedEpisodes] =
    useState<Record<string, boolean>>({});

  if (!selectedMedia) {
    return null;
  }
const mediaKey =
    `${selectedMedia.type}_${selectedMedia.id}`;

    const synopsis =
  mediaDetails?.synopsis ||
  'Aucun synopsis disponible.';

const hasEpisodes =
  selectedMedia.type === 'tv' ||
  selectedMedia.type === 'anime' ||
  selectedMedia.type === 'drama';

const synopsisLimit = hasEpisodes ? 220 : 450;

const shouldShortenSynopsis =
  synopsis.length > synopsisLimit;

const displayedSynopsis =
  shouldShortenSynopsis && !showFullSynopsis
    ? `${synopsis
        .slice(0, synopsisLimit)
        .trim()}...`
    : synopsis;

const currentChapter =
  mangaProgress[mediaKey] || 0;

const totalChapters =
  Number(selectedMedia.chapters) || 0;

const totalVolumes =
  Number((selectedMedia as any).volumes) || 0;

const remainingChapters =
  totalChapters > 0
    ? Math.max(
        totalChapters - currentChapter,
        0
      )
    : null;

const nextChapter =
  totalChapters > 0
    ? Math.min(
        currentChapter + 1,
        totalChapters
      )
    : currentChapter + 1;

const mangaProgressPercentage =
  totalChapters > 0
    ? Math.min(
        Math.round(
          (currentChapter / totalChapters) *
            100
        ),
        100
      )
    : 0;

  const posterUrl = selectedMedia.poster_path
    ? selectedMedia.poster_path.startsWith('http')
      ? selectedMedia.poster_path
      : `https://image.tmdb.org/t/p/w200${selectedMedia.poster_path}`
    : 'https://via.placeholder.com/150x225';

const watchedCount = seasonEpisodes.filter(
  (episode) => {
    const episodeKey =
      `${selectedMedia.type}_${selectedMedia.id}` +
      `_S${activeSeason}E${episode.episode_number}`;

    return Boolean(watchedEpisodes[episodeKey]);
  }
).length;

const progressPercentage =
  seasonEpisodes.length > 0
    ? Math.round(
        (watchedCount / seasonEpisodes.length) * 100
      )
    : 0;

const today = new Date();
today.setHours(23, 59, 59, 999);

const formatEpisodeDate = (
  airDate?: string | null
) => {
  if (!airDate) {
    return 'Date inconnue';
  }

  return new Intl.DateTimeFormat('fr-FR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(new Date(airDate));
};

  return (
    <div
        style={{
        position: 'fixed',
        inset: 0,
        width: '100vw',
        height: '100dvh',
        backgroundColor: 'rgba(0,0,0,0.85)',
        zIndex: 5000,
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
        maxHeight: 'calc(100dvh - 2rem)',          borderRadius: '16px',
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

            {(mediaDetails?.runtime ||
  mediaDetails?.episode_runtime) && (
  <div
    style={{
      marginTop: '0.7rem',
      display: 'flex',
      gap: '0.5rem',
      flexWrap: 'wrap',
    }}
  >
    {mediaDetails.runtime && (
      <span
        style={{
          padding: '0.35rem 0.65rem',
          borderRadius: '20px',
          backgroundColor: '#393E46',
          fontSize: '0.8rem',
          fontWeight: 'bold',
        }}
      >
        {Math.floor(mediaDetails.runtime / 60) > 0
          ? `${Math.floor(
              mediaDetails.runtime / 60
            )} h ${mediaDetails.runtime % 60} min`
          : `${mediaDetails.runtime} min`}
      </span>
    )}

    {!mediaDetails.runtime &&
      mediaDetails.episode_runtime && (
        <span
          style={{
            padding: '0.35rem 0.65rem',
            borderRadius: '20px',
            backgroundColor: '#393E46',
            fontSize: '0.8rem',
            fontWeight: 'bold',
          }}
        >
          Environ {mediaDetails.episode_runtime} min
          par épisode
        </span>
      )}
  </div>
)}

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
                <div>
  <p
    style={{
      fontSize: '0.95rem',
      opacity: 0.85,
      lineHeight: '1.5',
      margin: 0,
    }}
  >
    {displayedSynopsis}
  </p>

  {shouldShortenSynopsis && (
    <button
      type="button"
      onClick={() =>
        setShowFullSynopsis((current) => !current)
      }
      style={{
        marginTop: '0.5rem',
        padding: 0,
        background: 'transparent',
        border: 'none',
        color: '#00ADB5',
        fontSize: '0.85rem',
        fontWeight: 'bold',
        cursor: 'pointer',
      }}
    >
      {showFullSynopsis
        ? 'Voir moins'
        : 'Voir plus'}
    </button>
  )}
</div>

{mediaDetails?.actors &&
  mediaDetails.actors.length > 0 && (
    <section
      style={{
        marginTop: '1.8rem',
        borderTop: '1px solid #393E46',
        paddingTop: '1.4rem',
      }}
    >
      <h3
        style={{
          margin: '0 0 1rem',
          fontSize: '1.1rem',
        }}
      >
        {selectedMedia.type === 'anime'
          ? 'Personnages et doubleurs'
          : 'Distribution'}
      </h3>

      <div
        style={{
          display: 'flex',
          gap: '0.9rem',
          overflowX: 'auto',
          paddingBottom: '0.6rem',
        }}
      >
        {mediaDetails.actors
          .slice(0, 15)
          .map((actor) => {
            const imageUrl =
              actor.image_url ||
              (actor.profile_path
                ? `https://image.tmdb.org/t/p/w185${actor.profile_path}`
                : null);

            return (
              <div
                key={`${actor.id}_${actor.name}`}
                style={{
                  flex: '0 0 120px',
                  backgroundColor: '#2d333b',
                  border: '1px solid #393E46',
                  borderRadius: '12px',
                  overflow: 'hidden',
                }}
              >
                {imageUrl ? (
                  <img
                    src={imageUrl}
                    alt={actor.name}
                    referrerPolicy="no-referrer"
                    style={{
                      width: '100%',
                      height: '155px',
                      objectFit: 'cover',
                    }}
                  />
                ) : (
                  <div
                    style={{
                      height: '155px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      backgroundColor: '#393E46',
                      fontSize: '2rem',
                    }}
                  >
                    👤
                  </div>
                )}

                <div
                  style={{
                    padding: '0.7rem',
                  }}
                >
                  <strong
                    style={{
                      display: 'block',
                      fontSize: '0.82rem',
                      lineHeight: 1.25,
                    }}
                  >
                    {actor.name}
                  </strong>

                  {actor.character && (
                    <span
                      style={{
                        display: 'block',
                        marginTop: '0.3rem',
                        fontSize: '0.72rem',
                        opacity: 0.7,
                        lineHeight: 1.3,
                      }}
                    >
                      {actor.character}
                    </span>
                  )}

                  {actor.voice_actor && (
                    <span
                      style={{
                        display: 'block',
                        marginTop: '0.35rem',
                        fontSize: '0.72rem',
                        color: '#00ADB5',
                        lineHeight: 1.3,
                      }}
                    >
                      Voix : {actor.voice_actor}
                    </span>
                  )}

                  {actor.language && (
                    <span
                      style={{
                        display: 'block',
                        marginTop: '0.2rem',
                        fontSize: '0.66rem',
                        opacity: 0.55,
                      }}
                    >
                      {actor.language}
                    </span>
                  )}
                </div>
              </div>
            );
          })}
      </div>
    </section>
  )}

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
        margin: '0 0 1rem',
      }}
    >
      Progression de lecture
    </h3>

    <div
      style={{
        display: 'grid',
        gridTemplateColumns:
          'repeat(auto-fit, minmax(140px, 1fr))',
        gap: '0.8rem',
        marginBottom: '1.2rem',
      }}
    >
      <div
        style={{
          backgroundColor: '#2d333b',
          border: '1px solid #393E46',
          borderRadius: '10px',
          padding: '1rem',
        }}
      >
        <div
          style={{
            opacity: 0.65,
            fontSize: '0.8rem',
            marginBottom: '0.35rem',
          }}
        >
          Chapitre actuel
        </div>

        <strong
          style={{
            color: '#00ADB5',
            fontSize: '1.4rem',
          }}
        >
          {currentChapter}
        </strong>
      </div>

      {totalChapters > 0 && (
    <div
  style={{
    backgroundColor: '#2d333b',
    border: '1px solid #393E46',
    borderRadius: '10px',
    padding: '1rem',
  }}
>
  <div
    style={{
      opacity: 0.65,
      fontSize: '0.8rem',
      marginBottom: '0.35rem',
    }}
  >
    Chapitres disponibles
  </div>

  <strong
    style={{
      fontSize: '1rem',
      opacity: 0.75,
    }}
  >
    Nombre inconnu
  </strong>
</div>
      )}

      {remainingChapters !== null && (
        <div
          style={{
            backgroundColor: '#2d333b',
            border: '1px solid #393E46',
            borderRadius: '10px',
            padding: '1rem',
          }}
        >
          <div
            style={{
              opacity: 0.65,
              fontSize: '0.8rem',
              marginBottom: '0.35rem',
            }}
          >
            Restant à lire
          </div>

          <strong
            style={{
              color:
                remainingChapters === 0
                  ? '#4CAF50'
                  : '#FFB347',
              fontSize: '1.4rem',
            }}
          >
            {remainingChapters}
          </strong>
        </div>
      )}

      {totalVolumes > 0 && (
        <div
          style={{
            backgroundColor: '#2d333b',
            border: '1px solid #393E46',
            borderRadius: '10px',
            padding: '1rem',
          }}
        >
          <div
            style={{
              opacity: 0.65,
              fontSize: '0.8rem',
              marginBottom: '0.35rem',
            }}
          >
            Tomes connus
          </div>

          <strong
            style={{
              fontSize: '1.4rem',
            }}
          >
            {totalVolumes}
          </strong>
        </div>
      )}
    </div>

    {totalChapters > 0 && (
      <div
        style={{
          marginBottom: '1.3rem',
        }}
      >
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: '0.5rem',
            fontSize: '0.9rem',
          }}
        >
          <span>
            {currentChapter} / {totalChapters}{' '}
            chapitres
          </span>

          <strong
            style={{
              color: '#00ADB5',
            }}
          >
            {mangaProgressPercentage} %
          </strong>
        </div>

        <div
          style={{
            width: '100%',
            height: '9px',
            backgroundColor: '#393E46',
            borderRadius: '20px',
            overflow: 'hidden',
          }}
        >
          <div
            style={{
              width: `${mangaProgressPercentage}%`,
              height: '100%',
              backgroundColor:
                mangaProgressPercentage === 100
                  ? '#4CAF50'
                  : '#00ADB5',
              borderRadius: '20px',
              transition: 'width 0.3s ease',
            }}
          />
        </div>
      </div>
    )}

    {remainingChapters === 0 &&
    totalChapters > 0 ? (
      <div
        style={{
          backgroundColor:
            'rgba(76, 175, 80, 0.12)',
          border:
            '1px solid rgba(76, 175, 80, 0.5)',
          borderRadius: '10px',
          padding: '1rem',
          marginBottom: '1rem',
          color: '#8BE28E',
          fontWeight: 'bold',
        }}
      >
        ✓ Tous les chapitres disponibles ont été
        lus.
      </div>
    ) : (
      <div
        style={{
          backgroundColor:
            'rgba(0, 173, 181, 0.12)',
          border:
            '1px solid rgba(0, 173, 181, 0.45)',
          borderRadius: '10px',
          padding: '1rem',
          marginBottom: '1rem',
        }}
      >
        <div
          style={{
            opacity: 0.7,
            fontSize: '0.8rem',
            marginBottom: '0.3rem',
          }}
        >
          Prochain chapitre à lire
        </div>

        <strong
          style={{
            color: '#00ADB5',
            fontSize: '1.25rem',
          }}
        >
          Chapitre {nextChapter}
        </strong>
      </div>
    )}

    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '0.6rem',
        flexWrap: 'wrap',
      }}
    >
      <button
        type="button"
        disabled={currentChapter <= 0}
        onClick={() =>
          onChapterChange(
            Math.max(currentChapter - 1, 0)
          )
        }
        style={{
          border: 'none',
          borderRadius: '8px',
          padding: '0.65rem 1rem',
          cursor:
            currentChapter > 0
              ? 'pointer'
              : 'not-allowed',
          backgroundColor: '#393E46',
          color: '#FFF',
          fontWeight: 'bold',
          opacity:
            currentChapter > 0 ? 1 : 0.5,
        }}
      >
        − 1
      </button>

<input
        type="number"
        min={0}
        step={0.1}     
        max={
          totalChapters > 0
            ? totalChapters
            : undefined
        }
        value={currentChapter}
        onChange={(event) => {
            const value =
            Number.parseFloat(event.target.value) || 0;
          const safeValue =
            totalChapters > 0
              ? Math.min(
                  Math.max(value, 0),
                  totalChapters
                )
              : Math.max(value, 0);

          onChapterChange(safeValue);
        }}
        style={{
          backgroundColor: '#393E46',
          border: '1px solid #4b515a',
          color: '#FFF',
          padding: '0.65rem',
          borderRadius: '8px',
          width: '85px',
          textAlign: 'center',
          fontWeight: 'bold',
          fontSize: '1rem',
        }}
      />

      <button
        type="button"
        disabled={
          totalChapters > 0 &&
          currentChapter >= totalChapters
        }
        onClick={() =>
          onChapterChange(nextChapter)
        }
        style={{
          border: 'none',
          borderRadius: '8px',
          padding: '0.65rem 1rem',
          cursor:
            totalChapters > 0 &&
            currentChapter >= totalChapters
              ? 'not-allowed'
              : 'pointer',
          backgroundColor: '#00ADB5',
          color: '#FFF',
          fontWeight: 'bold',
          opacity:
            totalChapters > 0 &&
            currentChapter >= totalChapters
              ? 0.5
              : 1,
        }}
      >
        + 1
      </button>

      <button
        type="button"
        disabled={
          totalChapters > 0 &&
          currentChapter >= totalChapters
        }
        onClick={() =>
          onChapterChange(nextChapter)
        }
        style={{
          marginLeft: 'auto',
          border: 'none',
          borderRadius: '20px',
          padding: '0.7rem 1.2rem',
          cursor:
            totalChapters > 0 &&
            currentChapter >= totalChapters
              ? 'not-allowed'
              : 'pointer',
          backgroundColor: '#4CAF50',
          color: '#FFF',
          fontWeight: 'bold',
          opacity:
            totalChapters > 0 &&
            currentChapter >= totalChapters
              ? 0.5
              : 1,
        }}
      >
        ✓ Chapitre {nextChapter} lu
      </button>
    </div>
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

        {mediaDetails &&
            selectedMedia.type !== 'manga' &&
            selectedMedia.type !== 'manhwa' &&
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
                <div
                style={{
                    marginBottom: '1.2rem',
                }}
                >
                <div
                    style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    marginBottom: '0.5rem',
                    fontSize: '0.9rem',
                    }}
                >
                    <span>
                    {watchedCount} / {seasonEpisodes.length}{' '}
                    épisodes vus
                    </span>

                    <strong style={{ color: '#00ADB5' }}>
                    {progressPercentage} %
                    </strong>
                </div>

                <div
                    style={{
                    width: '100%',
                    height: '8px',
                    backgroundColor: '#393E46',
                    borderRadius: '20px',
                    overflow: 'hidden',
                    }}
                >
                    <div
                    style={{
                        width: `${progressPercentage}%`,
                        height: '100%',
                        backgroundColor: '#00ADB5',
                        borderRadius: '20px',
                        transition: 'width 0.3s ease',
                    }}
                    />
                </div>
                </div>
            )
            }
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
                    maxHeight: '500px',
                    overflowY: 'auto',
                  }}
                >
                  {seasonEpisodes.map((episode) => {
                    const episodeKey =
                        `${selectedMedia.type}_${selectedMedia.id}` +
                        `_S${activeSeason}E${episode.episode_number}`;

                    const isWatched = Boolean(
                        watchedEpisodes[episodeKey]
                    );

                    const airDate = episode.air_date
                        ? new Date(episode.air_date)
                        : null;

                    const isReleased =
                        !airDate || airDate <= today;

                    const episodeImage = episode.still_path
                        ? `https://image.tmdb.org/t/p/w500${episode.still_path}`
                        : null;

                        const episodeExpandKey =
                        `${selectedMedia.type}_${selectedMedia.id}` +
                        `_S${activeSeason}E${episode.episode_number}`;

                        const episodeOverview =
                        episode.overview ||
                        'Aucun résumé disponible pour cet épisode.';

                        const episodeOverviewLimit = 160;

                        const shouldShortenEpisode =
                        episodeOverview.length > episodeOverviewLimit;

                        const isEpisodeExpanded =
                        Boolean(expandedEpisodes[episodeExpandKey]);

                        const displayedEpisodeOverview =
                        shouldShortenEpisode && !isEpisodeExpanded
                            ? `${episodeOverview
                                .slice(0, episodeOverviewLimit)
                                .trim()}...`
                            : episodeOverview;

                    return (
                        <div
                        key={episode.id}
                        style={{
                            display: 'flex',
                            gap: '1rem',
                            padding: '1rem',
                            backgroundColor: isWatched
                            ? 'rgba(76, 175, 80, 0.12)'
                            : '#2d333b',
                            borderRadius: '12px',
                            border: isWatched
                            ? '1px solid rgba(76, 175, 80, 0.5)'
                            : '1px solid #393E46',
                            opacity: isReleased ? 1 : 0.65,
                        }}
                        >
                        {episodeImage && (
                            <img
                            src={episodeImage}
                            alt={`Image de l’épisode ${episode.episode_number}`}
                            referrerPolicy="no-referrer"
                            style={{
                                width: '150px',
                                height: '85px',
                                objectFit: 'cover',
                                borderRadius: '8px',
                                flexShrink: 0,
                            }}
                            />
                        )}

                        <div
                            style={{
                            flex: 1,
                            minWidth: 0,
                            }}
                        >
                            <div
                            style={{
                                display: 'flex',
                                justifyContent: 'space-between',
                                gap: '1rem',
                                alignItems: 'flex-start',
                            }}
                            >
                            <div>
                                <div
                                style={{
                                    color: '#00ADB5',
                                    fontSize: '0.8rem',
                                    fontWeight: 'bold',
                                    textTransform: 'uppercase',
                                    marginBottom: '0.25rem',
                                }}
                                >
                                Saison {activeSeason} · Épisode{' '}
                                {episode.episode_number}
                                </div>

                                <h4
                                style={{
                                    margin: 0,
                                    fontSize: '1rem',
                                    color: '#EEEEEE',
                                }}
                                >
                                {episode.name ||
                                    `Épisode ${episode.episode_number}`}
                                </h4>
                            </div>

                            <button
                                type="button"
                                disabled={!isReleased}
                                onClick={() =>
                                onToggleEpisode(
                                    episode.episode_number
                                )
                                }
                                style={{
                                padding: '0.45rem 0.9rem',
                                borderRadius: '20px',
                                border: 'none',
                                fontWeight: 'bold',
                                cursor: isReleased
                                    ? 'pointer'
                                    : 'not-allowed',
                                backgroundColor: !isReleased
                                    ? '#393E46'
                                    : isWatched
                                    ? '#4CAF50'
                                    : '#00ADB5',
                                color: '#FFF',
                                whiteSpace: 'nowrap',
                                }}
                            >
                                {!isReleased
                                ? 'À venir'
                                : isWatched
                                    ? '✓ Vu'
                                    : 'À voir'}
                            </button>
                            </div>

                            <div
                            style={{
                                display: 'flex',
                                flexWrap: 'wrap',
                                gap: '0.8rem',
                                marginTop: '0.6rem',
                                fontSize: '0.8rem',
                                opacity: 0.7,
                            }}
                            >
                            <span>
                                {formatEpisodeDate(episode.air_date)}
                            </span>

                            {episode.runtime && (
                                <span>{episode.runtime} min</span>
                            )}
                            </div>

<div
  style={{
    marginTop: '0.7rem',
  }}
>
  <p
    style={{
      margin: 0,
      lineHeight: 1.45,
      fontSize: '0.88rem',
      opacity: 0.85,
    }}
  >
    {displayedEpisodeOverview}
  </p>

  {shouldShortenEpisode && (
    <button
      type="button"
      onClick={() =>
        setExpandedEpisodes((current) => ({
          ...current,
          [episodeExpandKey]:
            !current[episodeExpandKey],
        }))
      }
      style={{
        marginTop: '0.45rem',
        padding: 0,
        background: 'transparent',
        border: 'none',
        color: '#00ADB5',
        fontSize: '0.82rem',
        fontWeight: 'bold',
        cursor: 'pointer',
      }}
    >
      {isEpisodeExpanded
        ? 'Voir moins'
        : 'Voir plus'}
    </button>
  )}
</div>
      </div>
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