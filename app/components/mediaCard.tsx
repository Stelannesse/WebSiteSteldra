import type {
  MediaItem,
  MyListItem,
  WatchStatus,
} from '../types/media';
import { useRouter } from 'next/navigation';
import styles from './mediaCard.module.css';
import { getPosterUrl, usePosterFallback } from '../lib/poster';

type MediaCardProps = {
  item: MediaItem;
  currentItem?: MyListItem;
  onMarkWatched: (media: MediaItem) => void;
  onToggleInProgress: (media: MediaItem) => void;
  onMarkToWatch: (media: MediaItem) => void;
  onRemove: (media: MediaItem) => void;
  navigationMode?: 'push' | 'replace';
  rememberCollectionPosition?: boolean;
  onToggleFavorite?: (media: MediaItem) => void;
};

export default function MediaCard({
  item,
  currentItem,
  onMarkWatched,
  onToggleInProgress,
  onMarkToWatch,
  onRemove,
  navigationMode = 'push',
  rememberCollectionPosition = true,
  onToggleFavorite,
}: MediaCardProps) {
      const currentStatus: WatchStatus | undefined =
    currentItem?.status;

    const router = useRouter();

const openDetails = () => {
  sessionStorage.setItem(
    'steldra_selected_media',
    JSON.stringify(item)
  );

  if (rememberCollectionPosition) {
    sessionStorage.setItem(
      'steldra_collection_scroll_y',
      String(window.scrollY)
    );
  }

  const href = `/media/${item.type}/${item.id}`;

  if (navigationMode === 'replace') {
    router.replace(href);
  } else {
    router.push(href);
  }
};

  const watchCount =
    currentItem?.watchCount ||
    (currentStatus === 'vu' ? 1 : 0);

  const isReadingType =
    item.type === 'manga' || item.type === 'manhwa';

  const watchedLabel = isReadingType
    ? watchCount > 1
      ? `Lu x${watchCount}`
      : 'Lu'
    : watchCount > 1
      ? `Vu x${watchCount}`
      : 'Vu';

  const posterUrl = getPosterUrl(item, 'w342');

  return (
    <div onClick={openDetails} className={styles.card}>
      <button
        type="button"
        onClick={(event) => {
          event.stopPropagation();
          onMarkWatched(item);
        }}
        className={`${styles.action} ${styles.left} ${currentStatus === 'vu' ? styles.watched : ''}`}
      >
        {watchedLabel}
      </button>

      <button
        type="button"
        onClick={(event) => {
          event.stopPropagation();
          onToggleInProgress(item);
        }}
        className={`${styles.action} ${styles.center} ${currentStatus === 'en_cours' ? styles.inProgress : ''}`}
        aria-label={currentStatus === 'en_cours' ? 'Retirer des médias en cours' : 'Marquer comme en cours'}
        title={currentStatus === 'en_cours' ? 'Retirer des médias en cours' : 'Marquer comme en cours'}
      >
        {currentStatus === 'en_cours' ? '−' : '+'}
      </button>

      <button
        type="button"
        onClick={(event) => {
          event.stopPropagation();
          onMarkToWatch(item);
        }}
        className={`${styles.action} ${styles.right} ${currentStatus === 'a_voir' ? styles.toWatch : ''}`}
      >
        {isReadingType ? 'À lire' : 'À voir'}
      </button>

      <img
        src={posterUrl}
        alt={`Affiche de ${item.title}`}
        referrerPolicy="no-referrer"
        className={styles.poster}
        onError={(event) => usePosterFallback(event.currentTarget)}
      />

      {currentItem && onToggleFavorite && (
        <button
          type="button"
          onClick={(event) => {
            event.stopPropagation();
            onToggleFavorite(item);
          }}
          aria-label={currentItem.favorite ? `Retirer ${item.title} des favoris` : `Ajouter ${item.title} aux favoris`}
          title={currentItem.favorite ? 'Retirer des favoris' : 'Ajouter aux favoris'}
          className={`${styles.roundAction} ${styles.favorite} ${currentItem.favorite ? styles.favoriteActive : ''}`}
        >
          {currentItem.favorite ? '★' : '☆'}
        </button>
      )}

      {currentItem && (
        <button
          type="button"
          onClick={(event) => {
            event.stopPropagation();
            const confirmed = window.confirm(`Supprimer « ${item.title} » de ta collection ?`);
            if (confirmed) onRemove(item);
          }}
          aria-label={`Supprimer ${item.title}`}
          title="Supprimer de ma collection"
          className={`${styles.roundAction} ${styles.remove}`}
        >
          ×
        </button>
      )}
    </div>
  );
}
