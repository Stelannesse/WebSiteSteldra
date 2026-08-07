import type {
  MediaItem,
  MyListItem,
  WatchStatus,
} from '../types/media';

type UseMediaProgressProps = {
  supabase: any;

  myList: Record<string, MyListItem>;

  setMyList: React.Dispatch<
    React.SetStateAction<Record<string, MyListItem>>
  >;

  watchedEpisodes: Record<string, boolean>;

  setWatchedEpisodes: React.Dispatch<
    React.SetStateAction<Record<string, boolean>>
  >;

  mangaProgress: Record<string, number>;

  setMangaProgress: React.Dispatch<
    React.SetStateAction<Record<string, number>>
  >;

  selectedMedia: MediaItem | null;

  activeSeason: number;

  getMediaKey: (media: MediaItem) => string;
};

export default function useMediaProgress({
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
}: UseMediaProgressProps) {
  const updateMediaInList = async (
    media: MediaItem,
    status: WatchStatus,
    watchCount = 0
  ) => {
    const mediaKey = getMediaKey(media);

    const currentItem = myList[mediaKey];
    const now = new Date().toISOString();
    const enrichedMedia: MediaItem = {
      ...media,
      favorite: currentItem?.favorite ?? media.favorite ?? false,
      steldra_added_at:
        currentItem?.addedAt || media.steldra_added_at || now,
      steldra_last_interaction_at: now,
    };

    const updatedList = {
      ...myList,
      [mediaKey]: {
        media: enrichedMedia,
        status,
        watchCount,
        favorite: enrichedMedia.favorite,
        addedAt: enrichedMedia.steldra_added_at,
        lastInteractionAt: enrichedMedia.steldra_last_interaction_at,
      },
    };

    setMyList(updatedList);

    localStorage.setItem(
      'steldra_multimedia_list_v1',
      JSON.stringify(updatedList)
    );

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) return;

    const { error } = await supabase
      .from('media_progress')
      .upsert(
        {
          user_id: user.id,
          media_id: String(media.id),
          media_type: media.type,
          status,
          media_data: enrichedMedia,
          watched_episode: watchedEpisodes,
          manga_progress:
            mangaProgress[mediaKey] ?? 0,
          watch_count: watchCount,
        },
        {
          onConflict: 'user_id,media_id',
        }
      );

    if (error) {
      console.error(
        'Erreur sauvegarde media_progress :',
        {
          code: error.code,
          message: error.message,
          details: error.details,
          hint: error.hint,
        }
      );
    }
  };

  const handleMarkWatched = async (
    media: MediaItem
  ) => {
    const mediaKey = getMediaKey(media);

    const currentItem = myList[mediaKey];

    const currentCount =
      currentItem?.watchCount ||
      (currentItem?.status === 'vu' ? 1 : 0);

    const nextCount =
      currentCount >= 7
        ? 1
        : currentCount + 1;

    await updateMediaInList(
      media,
      'vu',
      nextCount
    );
  };

  const handleToggleInProgress = async (
    media: MediaItem
  ) => {
    const mediaKey = getMediaKey(media);

    const currentItem = myList[mediaKey];

    const newStatus: WatchStatus =
      currentItem?.status === 'en_cours'
        ? 'a_voir'
        : 'en_cours';

    await updateMediaInList(
      media,
      newStatus,
      currentItem?.watchCount || 0
    );
  };

  const handleSetStatus = async (media: MediaItem, status: WatchStatus) => {
    const currentItem = myList[getMediaKey(media)];
    await updateMediaInList(media, status, currentItem?.watchCount || 0);
  };

  const handleMarkToWatch = async (
    media: MediaItem
  ) => {
    const mediaKey = getMediaKey(media);

    const currentItem = myList[mediaKey];

    await updateMediaInList(
      media,
      'a_voir',
      currentItem?.watchCount || 0
    );
  };

  const saveWatchedEpisodes = async (
    updatedEpisodes: Record<string, boolean>
  ) => {
    if (!selectedMedia) return;

    const mediaKey =
      getMediaKey(selectedMedia);

    setWatchedEpisodes(updatedEpisodes);

    localStorage.setItem(
      'steldra_watched_episodes_v1',
      JSON.stringify(updatedEpisodes)
    );

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) return;

    const currentItem = myList[mediaKey];

    const { error } = await supabase
      .from('media_progress')
      .upsert(
        {
          user_id: user.id,
          media_id: String(selectedMedia.id),
          media_type: selectedMedia.type,
          media_data: selectedMedia,
          status:
            currentItem?.status || 'a_voir',
          watched_episode: updatedEpisodes,
          manga_progress:
            mangaProgress[mediaKey] ?? 0,
          watch_count:
            currentItem?.watchCount ?? 0,
        },
        {
          onConflict: 'user_id,media_id',
        }
      );

    if (error) {
      console.error(
        'Erreur sauvegarde des épisodes :',
        {
          code: error.code,
          message: error.message,
          details: error.details,
          hint: error.hint,
        }
      );
    }
  };

  const toggleEpisodeWatched = async (
    episodeNumber: number
  ) => {
    if (!selectedMedia) return;

    const mediaKey =
      getMediaKey(selectedMedia);

    const episodeKey =
      `${mediaKey}_S${activeSeason}` +
      `E${episodeNumber}`;

    const updatedEpisodes = {
      ...watchedEpisodes,
      [episodeKey]:
        !watchedEpisodes[episodeKey],
    };

    await saveWatchedEpisodes(
      updatedEpisodes
    );
  };

  const markEpisodesUpTo = async (
    episodeNumber: number,
    episodeNumbers: number[]
  ) => {
    if (!selectedMedia) return;

    const mediaKey =
      getMediaKey(selectedMedia);

    const updatedEpisodes = {
      ...watchedEpisodes,
    };

    episodeNumbers.forEach(
      (currentEpisodeNumber) => {
        if (
          currentEpisodeNumber <=
          episodeNumber
        ) {
          const episodeKey =
            `${mediaKey}_S${activeSeason}` +
            `E${currentEpisodeNumber}`;

          updatedEpisodes[episodeKey] = true;
        }
      }
    );

    await saveWatchedEpisodes(
      updatedEpisodes
    );
  };

  const toggleWholeSeason = async (
    episodeNumbers: number[]
  ) => {
    if (
      !selectedMedia ||
      episodeNumbers.length === 0
    ) {
      return;
    }

    const mediaKey =
      getMediaKey(selectedMedia);

    const allEpisodesWatched =
      episodeNumbers.every(
        (episodeNumber) => {
          const episodeKey =
            `${mediaKey}_S${activeSeason}` +
            `E${episodeNumber}`;

          return Boolean(
            watchedEpisodes[episodeKey]
          );
        }
      );

    const updatedEpisodes = {
      ...watchedEpisodes,
    };

    episodeNumbers.forEach(
      (episodeNumber) => {
        const episodeKey =
          `${mediaKey}_S${activeSeason}` +
          `E${episodeNumber}`;

        updatedEpisodes[episodeKey] =
          !allEpisodesWatched;
      }
    );

    await saveWatchedEpisodes(
      updatedEpisodes
    );
  };

  const handleChapterChange = async (
    value: number
  ) => {
    if (!selectedMedia) return;

    const mediaKey =
      getMediaKey(selectedMedia);

    const newProgress =
      Math.max(0, value);

    const updatedProgress = {
      ...mangaProgress,
      [mediaKey]: newProgress,
    };

    setMangaProgress(updatedProgress);

    localStorage.setItem(
      'steldra_manga_progress_v1',
      JSON.stringify(updatedProgress)
    );

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) return;

    const currentItem = myList[mediaKey];

    const { error } = await supabase
      .from('media_progress')
      .upsert(
        {
          user_id: user.id,
          media_id: String(selectedMedia.id),
          media_type: selectedMedia.type,
          media_data: selectedMedia,
          status:
            currentItem?.status || 'a_voir',
          watched_episode:
            watchedEpisodes,
          manga_progress: newProgress,
          watch_count:
            currentItem?.watchCount ?? 0,
        },
        {
          onConflict: 'user_id,media_id',
        }
      );

    if (error) {
      console.error(
        'Erreur sauvegarde progression manga :',
        {
          code: error.code,
          message: error.message,
          details: error.details,
          hint: error.hint,
        }
      );
    }
  };

  const handleRemove = async (
    media: MediaItem
  ) => {
    const mediaKey =
      getMediaKey(media);

    const updatedList = {
      ...myList,
    };

    delete updatedList[mediaKey];

    setMyList(updatedList);

    localStorage.setItem(
      'steldra_multimedia_list_v1',
      JSON.stringify(updatedList)
    );

    const updatedEpisodes =
      Object.fromEntries(
        Object.entries(
          watchedEpisodes
        ).filter(
          ([episodeKey]) =>
            !episodeKey.startsWith(
              `${mediaKey}_S`
            )
        )
      );

    setWatchedEpisodes(
      updatedEpisodes
    );

    localStorage.setItem(
      'steldra_watched_episodes_v1',
      JSON.stringify(updatedEpisodes)
    );

    const updatedProgress = {
      ...mangaProgress,
    };

    delete updatedProgress[mediaKey];

    setMangaProgress(
      updatedProgress
    );

    localStorage.setItem(
      'steldra_manga_progress_v1',
      JSON.stringify(updatedProgress)
    );

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) return;

    const { error } = await supabase
      .from('media_progress')
      .delete()
      .eq('user_id', user.id)
      .eq(
        'media_id',
        String(media.id)
      )
      .eq(
        'media_type',
        media.type
      );

    if (error) {
      console.error(
        'Erreur lors de la suppression du média :',
        {
          code: error.code,
          message: error.message,
          details: error.details,
          hint: error.hint,
        }
      );
    }
  };

  return {
    handleMarkWatched,
    handleToggleInProgress,
    handleMarkToWatch,
    handleSetStatus,
    handleRemove,
    toggleEpisodeWatched,
    markEpisodesUpTo,
    toggleWholeSeason,
    handleChapterChange,
  };
}