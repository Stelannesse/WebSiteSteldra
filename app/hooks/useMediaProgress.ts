import type {
  MediaItem,
  MyListItem,
  WatchStatus,
} from '../types/media';

type UseMediaProgressProps = {
  supabase: any;

  setWatchedEpisodes: React.Dispatch<
  React.SetStateAction<Record<string, boolean>>
>;

setMangaProgress: React.Dispatch<
  React.SetStateAction<Record<string, number>>
>;

selectedMedia: MediaItem | null;

activeSeason: number;

  myList: Record<string, MyListItem>;
  setMyList: React.Dispatch<
    React.SetStateAction<Record<string, MyListItem>>
  >;

  watchedEpisodes: Record<string, boolean>;

  mangaProgress: Record<string, number>;

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

  const updatedList = {
    ...myList,
    [mediaKey]: {
      media,
      status,
      watchCount,
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
      media_data: media,
      watched_episode: watchedEpisodes,
      manga_progress: mangaProgress[mediaKey] ?? 0,
      watch_count: watchCount,
    },
    {
      onConflict: 'user_id,media_id',
    }
  );

if (error) {
  console.error('Erreur sauvegarde media_progress :', {
    code: error.code,
    message: error.message,
    details: error.details,
    hint: error.hint,
  });
}

  if (error) {
    console.error(
      'Erreur sauvegarde media_progress :',
      error
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
      currentCount >= 7 ? 1 : currentCount + 1;

    await updateMediaInList(
      media,
      'vu',
      nextCount
    );
  };

  // Fonction pour marquer un épisode comme vu ou non vu
const toggleEpisodeWatched = async (
  episodeNum: number
) => {
  if (!selectedMedia) return;

  const mediaKey = getMediaKey(selectedMedia);
  const epKey =
    `${mediaKey}_S${activeSeason}E${episodeNum}`;

  const updated = {
    ...watchedEpisodes,
    [epKey]: !watchedEpisodes[epKey],
  };

  setWatchedEpisodes(updated);

  localStorage.setItem(
    'steldra_watched_episodes_v1',
    JSON.stringify(updated)
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
        status: currentItem?.status || 'a_voir',

        // Singulier, comme dans Supabase
        watched_episode: updated,

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

// Fonction pour gérer la progression des chapitres pour les mangas et manhwas
const handleChapterChange = async (
  value: number
) => {
  if (!selectedMedia) return;

  const mediaKey = getMediaKey(selectedMedia);
  const newProgress = Math.max(0, value);

  const updated = {
    ...mangaProgress,
    [mediaKey]: newProgress,
  };

  setMangaProgress(updated);

  localStorage.setItem(
    'steldra_manga_progress_v1',
    JSON.stringify(updated)
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
        status: currentItem?.status || 'a_voir',
        watched_episode: watchedEpisodes,
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

const handleRemove = async (media: MediaItem) => {
  const mediaKey = getMediaKey(media);

  // Suppression de la liste
  setMyList((current) => {
    const updatedList = { ...current };
    delete updatedList[mediaKey];

    localStorage.setItem(
      'steldra_multimedia_list_v1',
      JSON.stringify(updatedList)
    );

    return updatedList;
  });

  // Suppression des épisodes associés
  setWatchedEpisodes((current) => {
    const updatedEpisodes = Object.fromEntries(
      Object.entries(current).filter(
        ([episodeKey]) =>
          !episodeKey.startsWith(`${mediaKey}_S`)
      )
    );

    localStorage.setItem(
      'steldra_watched_episodes_v1',
      JSON.stringify(updatedEpisodes)
    );

    return updatedEpisodes;
  });

  // Suppression de la progression manga
  setMangaProgress((current) => {
    const updatedProgress = { ...current };
    delete updatedProgress[mediaKey];

    localStorage.setItem(
      'steldra_manga_progress_v1',
      JSON.stringify(updatedProgress)
    );

    return updatedProgress;
  });

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return;

  const { error } = await supabase
    .from('media_progress')
    .delete()
    .eq('user_id', user.id)
    .eq('media_id', media.id.toString())
    .eq('media_type', media.type);

  if (error) {
    console.error(
      'Erreur lors de la suppression du média :',
      error
    );
  }
};

return {
  handleMarkWatched,
  handleToggleInProgress,
  handleMarkToWatch,
  handleRemove,
  toggleEpisodeWatched,
  handleChapterChange,
};
}