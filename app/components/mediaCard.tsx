import type {
  MediaItem,
  MyListItem,
  WatchStatus,
} from '../types/media';

type MediaCardProps = {
  item: MediaItem;
  currentItem?: MyListItem;
  onOpen: (media: MediaItem) => void;
  onMarkWatched: (media: MediaItem) => void;
  onToggleInProgress: (media: MediaItem) => void;
  onMarkToWatch: (media: MediaItem) => void;
  onRemove: (media: MediaItem) => void;
};

export default function MediaCard({
  item,
  currentItem,
  onOpen,
  onMarkWatched,
  onToggleInProgress,
  onMarkToWatch,
  onRemove,
}: MediaCardProps) {
      const currentStatus: WatchStatus | undefined =
    currentItem?.status;

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

  const posterUrl = item.poster_path
    ? item.poster_path.startsWith('http')
      ? item.poster_path
      : `https://image.tmdb.org/t/p/w200${item.poster_path}`
    : 'https://via.placeholder.com/150x225?text=Pas+d’affiche';

  return (
    <div
      onClick={() => onOpen(item)}
      style={{
        position: 'relative',
        cursor: 'pointer',
        backgroundColor: 'transparent',
        border: 'none',
        boxShadow: 'none',
        padding: 0,
        margin: 0,
      }}
    >
      <button
        type="button"
        onClick={(event) => {
          event.stopPropagation();
          onMarkWatched(item);
        }}
        style={{
          position: 'absolute',
          top: '10px',
          left: '10px',
          zIndex: 10,
          padding: '0.3rem 0.6rem',
          fontSize: '0.75rem',
          cursor: 'pointer',
          borderRadius: '6px',
          border: 'none',
          backgroundColor:
            currentStatus === 'vu'
              ? '#4CAF50'
              : 'rgba(0,0,0,0.7)',
          color: '#FFF',
          fontWeight: 'bold',
        }}
      >
        {watchedLabel}
      </button>

      <button
        type="button"
        onClick={(event) => {
          event.stopPropagation();
          onToggleInProgress(item);
        }}
        style={{
          position: 'absolute',
          top: '10px',
          left: '50%',
          transform: 'translateX(-50%)',
          zIndex: 10,
          padding: '0.3rem 0.6rem',
          fontSize: '0.75rem',
          cursor: 'pointer',
          borderRadius: '6px',
          border: 'none',
          backgroundColor:
            currentStatus === 'en_cours'
              ? '#FF4C29'
              : 'rgba(0,0,0,0.7)',
          color: '#FFF',
          fontWeight: 'bold',
        }}
        aria-label={
          currentStatus === 'en_cours'
            ? 'Retirer des médias en cours'
            : 'Marquer comme en cours'
        }
      >
        {currentStatus === 'en_cours' ? '−' : '+'}
      </button>

      <button
        type="button"
        onClick={(event) => {
          event.stopPropagation();
          onMarkToWatch(item);
        }}
        style={{
          position: 'absolute',
          top: '10px',
          right: '10px',
          zIndex: 10,
          padding: '0.3rem 0.6rem',
          fontSize: '0.75rem',
          cursor: 'pointer',
          borderRadius: '6px',
          border: 'none',
          backgroundColor:
            currentStatus === 'a_voir'
              ? '#00ADB5'
              : 'rgba(0,0,0,0.7)',
          color: '#FFF',
          fontWeight: 'bold',
        }}
      >
        {isReadingType ? 'À lire' : 'À voir'}
      </button>

      <img
        src={posterUrl}
        alt={`Affiche de ${item.title}`}
        referrerPolicy="no-referrer"
        style={{
          display: 'block',
          width: '100%',
          borderRadius: '8px',
        }}
      />
{currentItem && (
  <button
    type="button"
    onClick={(event) => {
      event.stopPropagation();

      const confirmed = window.confirm(
        `Supprimer « ${item.title} » de ta collection ?`
      );

      if (confirmed) {
        onRemove(item);
      }
    }}
    aria-label={`Supprimer ${item.title}`}
    title="Supprimer de ma collection"
    style={{
      position: 'absolute',
      right: '8px',
      bottom: '8px',
      zIndex: 10,
      width: '32px',
      height: '32px',
      border: 'none',
      borderRadius: '50%',
      backgroundColor: 'rgba(190, 35, 35, 0.9)',
      color: '#ffffff',
      fontSize: '1rem',
      fontWeight: 'bold',
      cursor: 'pointer',
    }}
  >
    ×
  </button>
)}
    </div>
  );
}