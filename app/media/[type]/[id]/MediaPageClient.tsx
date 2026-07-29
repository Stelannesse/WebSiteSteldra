'use client';

import {
  useCallback,
  useEffect,
  useState,
} from 'react';

import MediaPageContent from '../../../components/mediaPageContent';

import useMediaDetails from '../../../hooks/useMediaDetails';
import useMediaProgress from '../../../hooks/useMediaProgress';
import useReviews from '../../../hooks/useReviews';

import { createClient } from '../../../lib/supabase';

import type {
  MediaItem,
  MediaType,
  MyListItem,
} from '../../../types/media';

type MediaPageClientProps = {
  type: MediaType;
  id: string;
};

export default function MediaPageClient({
  type,
  id,
}: MediaPageClientProps) {  /*
   * On ne recrée le client Supabase qu’une seule fois.
   */
  const [supabase] = useState(() => createClient());

  const [initialMedia, setInitialMedia] =
    useState<MediaItem | null>(null);

  const [initialLoading, setInitialLoading] =
    useState(true);

  const [pageError, setPageError] =
    useState<string | null>(null);

  const [userId, setUserId] =
    useState<string | null>(null);

  const [userName, setUserName] =
    useState<string | null>(null);

  const [myList, setMyList] = useState<{
    [key: string]: MyListItem;
  }>({});

  const [
    watchedEpisodes,
    setWatchedEpisodes,
  ] = useState<Record<string, boolean>>({});

  const [
    mangaProgress,
    setMangaProgress,
  ] = useState<Record<string, number>>({});

  const getMediaKey = useCallback(
    (
      media:
        | MediaItem
        | {
            type: string;
            id: string | number;
          }
    ) => `${media.type}_${media.id}`,
    []
  );

  /*
   * Chargement du synopsis, des acteurs,
   * de la durée et des épisodes.
   */
  const {
    media,
    mediaDetails,
    detailsLoading,
    detailsError,

    activeSeason,
    seasonEpisodes,
    episodesLoading,
    episodesError,

    loadSeasonEpisodes,
  } = useMediaDetails({
    initialMedia,
  });

  /*
   * Chargement et gestion des avis.
   */
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

  /*
   * Gestion de la progression :
   * chapitres et épisodes.
   */
const {
  toggleEpisodeWatched,
  markEpisodesUpTo,
  toggleWholeSeason,
  handleChapterChange,
} = useMediaProgress({    
    supabase,

    myList,
    setMyList,

    watchedEpisodes,
    setWatchedEpisodes,

    mangaProgress,
    setMangaProgress,

    selectedMedia: media,
    activeSeason,
    getMediaKey,
  });

  /*
   * Retrouve le média à partir :
   *
   * 1. de sessionStorage ;
   * 2. de Supabase ;
   * 3. de localStorage.
   */
  useEffect(() => {
    let cancelled = false;

    const loadInitialMedia = async () => {
      setInitialLoading(true);
      setPageError(null);

      try {
        const mediaKey = `${type}_${id}`;

        /*
         * Média mémorisé lors du clic
         * sur une MediaCard.
         */
        let cachedMedia: MediaItem | null = null;

        const cachedValue = sessionStorage.getItem(
          'steldra_selected_media'
        );

        if (cachedValue) {
          try {
            const parsedMedia =
              JSON.parse(cachedValue) as MediaItem;

            const matchesCurrentPage =
              parsedMedia.type === type &&
              parsedMedia.id.toString() === id;

            if (matchesCurrentPage) {
              cachedMedia = parsedMedia;
            }
          } catch (error) {
            console.error(
              'Média temporaire illisible :',
              error
            );
          }
        }

        const {
          data: { user },
        } = await supabase.auth.getUser();

        if (cancelled) {
          return;
        }

        if (user) {
          setUserId(user.id);

          setUserName(
            user.user_metadata?.full_name ||
              user.email?.split('@')[0] ||
              'Utilisateur'
          );

          const {
            data,
            error,
          } = await supabase
            .from('media_progress')
            .select('*')
            .eq('user_id', user.id)
            .eq('media_id', id)
            .eq('media_type', type)
            .maybeSingle();

          if (error) {
            console.error(
              'Erreur de récupération du média :',
              error
            );
          }

          if (cancelled) {
            return;
          }

          if (data) {
            const storedMedia = {
              ...(data.media_data || cachedMedia || {}),
              id: data.media_id,
              type: data.media_type,
            } as MediaItem;

            setInitialMedia(storedMedia);

            setMyList({
              [mediaKey]: {
                media: storedMedia,
                status: data.status,
                watchCount:
                  Number(data.watch_count) || 0,
              },
            });

            /*
             * Compatibilité temporaire avec les deux
             * noms de colonne rencontrés dans le projet.
             */
            const storedEpisodes =
              data.watched_episode ||
              data.watched_episodes ||
              {};

            setWatchedEpisodes(storedEpisodes);

            setMangaProgress({
              [mediaKey]:
                Number(data.manga_progress) || 0,
            });

            return;
          }
        }

        /*
         * Si le média n’est pas dans Supabase,
         * on utilise celui mémorisé au clic.
         */
        if (cachedMedia) {
          setInitialMedia(cachedMedia);
          return;
        }

        /*
         * Dernier recours pour un utilisateur
         * non connecté ou des données locales.
         */
        const savedList = localStorage.getItem(
          'steldra_multimedia_list_v1'
        );

        if (savedList) {
          try {
            const parsedList = JSON.parse(
              savedList
            ) as Record<string, MyListItem>;

            const localEntry = parsedList[mediaKey];

            if (localEntry?.media) {
              setInitialMedia(localEntry.media);
              setMyList({
                [mediaKey]: localEntry,
              });

              const savedEpisodes =
                localStorage.getItem(
                  'steldra_watched_episodes_v1'
                );

              if (savedEpisodes) {
                setWatchedEpisodes(
                  JSON.parse(savedEpisodes)
                );
              }

              const savedProgress =
                localStorage.getItem(
                  'steldra_manga_progress_v1'
                );

              if (savedProgress) {
                setMangaProgress(
                  JSON.parse(savedProgress)
                );
              }

              return;
            }
          } catch (error) {
            console.error(
              'Données locales illisibles :',
              error
            );
          }
        }

        setPageError(
          'Ce média est introuvable. Retourne dans ta collection et ouvre à nouveau sa fiche.'
        );
      } catch (error) {
        console.error(
          'Erreur pendant l’ouverture de la fiche :',
          error
        );

        if (!cancelled) {
          setPageError(
            'La fiche n’a pas pu être chargée.'
          );
        }
      } finally {
        if (!cancelled) {
          setInitialLoading(false);
        }
      }
    };

    void loadInitialMedia();

    return () => {
      cancelled = true;
    };
  }, [id, type, supabase]);

  /*
   * Charge les avis lorsque le média
   * devient disponible.
   */
  useEffect(() => {
    if (!media) {
      return;
    }

    void loadReviews(media.id);
  }, [media, loadReviews]);

  if (initialLoading) {
    return (
      <main
        style={{
          minHeight: '100vh',
          padding: '2rem',
          backgroundColor: '#222831',
          color: '#EEEEEE',
        }}
      >
        <p>Chargement de la fiche...</p>
      </main>
    );
  }

  if (pageError || !media) {
    return (
      <main
        style={{
          minHeight: '100vh',
          padding: '2rem',
          backgroundColor: '#222831',
          color: '#EEEEEE',
        }}
      >
        <h1>Fiche indisponible</h1>

        <p>
          {pageError ||
            'Le média demandé est introuvable.'}
        </p>

        <button
          type="button"
          onClick={() => window.history.back()}
          style={{
            minHeight: '44px',
            marginTop: '1rem',
            padding: '0.6rem 1rem',
            backgroundColor: '#00ADB5',
            color: '#071012',
            border: 'none',
            borderRadius: '10px',
            fontWeight: 'bold',
            cursor: 'pointer',
          }}
        >
          ← Retour
        </button>
      </main>
    );
  }

  const reviews =
    reviewsByMedia[media.id.toString()] || [];

return (
  <>
    {(detailsError || episodesError) && (
      <div>
        {detailsError || episodesError}
      </div>
    )}

    <MediaPageContent
      selectedMedia={media}
      detailsLoading={detailsLoading}
      mediaDetails={mediaDetails}

      reviews={reviews}
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
        void submitReview(
          media,
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

      onMarkEpisodesUpTo={markEpisodesUpTo}
      onToggleWholeSeason={toggleWholeSeason}
    />
  </>
);
}