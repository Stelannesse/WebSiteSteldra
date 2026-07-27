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
    .upsert({
      user_id: user.id,
      media_id: media.id.toString(),
      media_type: media.type,
      media_data: media,
      status,
      watched_episodes: watchedEpisodes,
      manga_progress: mangaProgress[mediaKey] || 0,
    });

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

  return {
  handleMarkWatched,
  handleToggleInProgress,
  handleMarkToWatch,
  toggleEpisodeWatched,
  handleChapterChange,
};
}