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

type CustomListSummary = {
  id: string;
  name: string;
};

export default function MediaPageClient({
  type,
  id,
}: MediaPageClientProps) {
  /*
   * Le client Supabase est créé une seule fois.
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

  /*
   * Nouvelles listes personnalisées.
   */
  const [customLists, setCustomLists] =
    useState<CustomListSummary[]>([]);

  const [addingToList, setAddingToList] =
    useState(false);

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
   * Chargement des informations détaillées.
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
   * Avis.
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
   * Progression des épisodes et des chapitres.
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
   * Chargement initial du média.
   */
  useEffect(() => {
    let cancelled = false;

    const loadInitialMedia = async () => {
      setInitialLoading(true);
      setPageError(null);

      try {
        const mediaKey = `${type}_${id}`;

        /*
         * Média conservé lors du clic sur une carte.
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
         * Média non encore enregistré dans Supabase.
         */
        if (cachedMedia) {
          setInitialMedia(cachedMedia);
          return;
        }

        /*
         * Dernier recours : stockage local.
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
   * Chargement des avis lorsque le média est disponible.
   */
  useEffect(() => {
    if (!media) {
      return;
    }

    void loadReviews(media.id);
  }, [media, loadReviews]);

  /*
   * Chargement des listes personnalisées de l’utilisateur.
   */
  useEffect(() => {
    if (!userId) {
      setCustomLists([]);
      return;
    }

    const loadCustomLists = async () => {
      const { data, error } = await supabase
        .from('custom_lists')
        .select('id, name')
        .eq('user_id', userId)
        .order('created_at', {
          ascending: false,
        });

      if (error) {
        console.error(
          'Erreur chargement des listes personnalisées :',
          error
        );

        setCustomLists([]);
        return;
      }

      setCustomLists(data || []);
    };

    void loadCustomLists();
  }, [userId, supabase]);

  /*
   * Ajoute le média à une liste personnalisée.
   */
  const addMediaToCustomList = async (
    listId: string
  ) => {
    if (!media) {
      window.alert(
        'Le média n’est pas encore chargé.'
      );
      return;
    }

    if (!userId) {
      window.alert(
        'Vous devez être connecté pour utiliser les listes.'
      );
      return;
    }

    if (addingToList) {
      return;
    }

    setAddingToList(true);

    try {
      /*
       * Vérification du doublon.
       */
      const {
        data: existingItem,
        error: existingError,
      } = await supabase
        .from('custom_list_items')
        .select('id')
        .eq('list_id', listId)
        .eq('media_id', media.id.toString())
        .eq('media_type', media.type)
        .maybeSingle();

      if (existingError) {
        throw existingError;
      }

      if (existingItem) {
        window.alert(
          `"${media.title}" est déjà présent dans cette liste.`
        );
        return;
      }

      /*
       * Recherche de la dernière position.
       */
      const {
        data: lastItems,
        error: positionError,
      } = await supabase
        .from('custom_list_items')
        .select('position')
        .eq('list_id', listId)
        .order('position', {
          ascending: false,
        })
        .limit(1);

      if (positionError) {
        throw positionError;
      }

      const lastPosition =
        lastItems && lastItems.length > 0
          ? Number(lastItems[0].position)
          : -1;

      /*
       * Insertion du média.
       */
      const { error: insertError } =
        await supabase
          .from('custom_list_items')
          .insert({
            list_id: listId,
            media_id: media.id.toString(),
            media_type: media.type,
            media_data: media,
            position: lastPosition + 1,
          });

      if (insertError) {
        throw insertError;
      }

      const selectedList =
        customLists.find(
          (list) => list.id === listId
        );

      window.alert(
        selectedList
          ? `"${media.title}" a été ajouté à la liste "${selectedList.name}".`
          : `"${media.title}" a bien été ajouté à la liste.`
      );
    } catch (error) {
      console.error(
        'Erreur ajout du média à la liste :',
        error
      );

      window.alert(
        'Impossible d’ajouter ce média à la liste.'
      );
    } finally {
      setAddingToList(false);
    }
  };

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

        customLists={customLists}
        addingToList={addingToList}
        onAddToCustomList={addMediaToCustomList}

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

        onToggleEpisode={
          toggleEpisodeWatched
        }

        onMarkEpisodesUpTo={
          markEpisodesUpTo
        }

        onToggleWholeSeason={
          toggleWholeSeason
        }
      />
    </>
  );
}