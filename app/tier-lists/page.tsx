'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import MainNav from '../components/mainNav';
import type { MediaItem, MyListItem, MediaType } from '../types/media';
import styles from './tierLists.module.css';

type TierRow = {
  id: string;
  label: string;
  title: string;
  media: MediaItem[];
};

type TierListData = {
  title: string;
  rows: TierRow[];
  unranked: MediaItem[];
};

const defaultRows: TierRow[] = [
  {
    id: 's',
    label: 'S',
    title: 'Exceptionnel',
    media: [],
  },
  {
    id: 'a',
    label: 'A',
    title: 'Excellent',
    media: [],
  },
  {
    id: 'b',
    label: 'B',
    title: 'Très bien',
    media: [],
  },
  {
    id: 'c',
    label: 'C',
    title: 'Moyen',
    media: [],
  },
  {
    id: 'd',
    label: 'D',
    title: 'Décevant',
    media: [],
  },
];

const mediaLabels: Record<MediaType | 'tous', string> = {
  tous: 'Tout',
  movie: 'Films',
  tv: 'Séries',
  drama: 'Dramas',
  anime: 'Animés',
  manga: 'Mangas',
  manhwa: 'Manhwas',
};

export default function TierListsPage() {
  const tierListRef = useRef<HTMLDivElement | null>(null);

  const [title, setTitle] = useState('Ma tier list');
  const [rows, setRows] = useState<TierRow[]>(defaultRows);
  const [unranked, setUnranked] = useState<MediaItem[]>([]);
  const [filter, setFilter] = useState<MediaType | 'tous'>('tous');
  const [search, setSearch] = useState('');
  const [draggedMedia, setDraggedMedia] = useState<MediaItem | null>(null);
  const [dragOverRank, setDragOverRank] = useState<string | null>(null);
  const [savedMessage, setSavedMessage] = useState('');

  useEffect(() => {
    const savedTierList = localStorage.getItem('steldra_tier_list_v1');

    if (savedTierList) {
      try {
        const parsed: TierListData = JSON.parse(savedTierList);

        setTitle(parsed.title || 'Ma tier list');
        setRows(parsed.rows?.length ? parsed.rows : defaultRows);
        setUnranked(parsed.unranked || []);
        return;
      } catch (error) {
        console.error('Tier list illisible :', error);
      }
    }

    const savedCollection = localStorage.getItem(
      'steldra_multimedia_list_v1'
    );

    if (!savedCollection) return;

    try {
      const parsedCollection: {
        [key: string]: MyListItem;
      } = JSON.parse(savedCollection);

      const collectionMedia = Object.values(parsedCollection).map(
        (entry) => entry.media
      );

      setUnranked(collectionMedia);
    } catch (error) {
      console.error('Collection illisible :', error);
    }
  }, []);

  const filteredUnranked = useMemo(() => {
    return unranked.filter((media) => {
      const matchesType =
        filter === 'tous' || media.type === filter;

      const matchesSearch = media.title
        .toLowerCase()
        .includes(search.trim().toLowerCase());

      return matchesType && matchesSearch;
    });
  }, [unranked, filter, search]);

  const removeMediaEverywhere = (media: MediaItem) => {
    const mediaKey = `${media.type}_${media.id}`;

    setRows((currentRows) =>
      currentRows.map((row) => ({
        ...row,
        media: row.media.filter(
          (item) => `${item.type}_${item.id}` !== mediaKey
        ),
      }))
    );

    setUnranked((current) =>
      current.filter(
        (item) => `${item.type}_${item.id}` !== mediaKey
      )
    );
  };

  const moveToRow = (media: MediaItem, rowId: string) => {
    removeMediaEverywhere(media);

    setRows((currentRows) =>
      currentRows.map((row) =>
        row.id === rowId
          ? {
              ...row,
              media: [...row.media, media],
            }
          : row
      )
    );
  };

  const moveToUnranked = (media: MediaItem) => {
    removeMediaEverywhere(media);

    setUnranked((current) => [...current, media]);
  };

  const handleDragStart = (media: MediaItem) => {
    setDraggedMedia(media);
  };

  const handleDropOnRow = (
    event: React.DragEvent<HTMLDivElement>,
    rowId: string
  ) => {
    event.preventDefault();

    if (!draggedMedia) return;

    moveToRow(draggedMedia, rowId);
    setDraggedMedia(null);
  };

  const handleDropOnUnranked = (
    event: React.DragEvent<HTMLDivElement>
  ) => {
    event.preventDefault();

    if (!draggedMedia) return;

    moveToUnranked(draggedMedia);
    setDraggedMedia(null);
  };

  const updateRowTitle = (rowId: string, value: string) => {
    setRows((currentRows) =>
      currentRows.map((row) =>
        row.id === rowId
          ? {
              ...row,
              title: value,
            }
          : row
      )
    );
  };

  const updateRowLabel = (
  rowId: string,
  value: string
) => {
  setRows((currentRows) =>
    currentRows.map((row) =>
      row.id === rowId
        ? {
            ...row,
            label: value.toUpperCase().slice(0, 3),
          }
        : row
    )
  );
};

const addRow = () => {
  const usedLabels = rows.map((row) =>
    row.label.toUpperCase()
  );

  const availableLabels = [
    'S',
    'A',
    'B',
    'C',
    'D',
    'E',
    'F',
    'G',
    'H',
  ];

  const nextLabel =
    availableLabels.find(
      (label) => !usedLabels.includes(label)
    ) ?? `R${rows.length + 1}`;

  const newRow: TierRow = {
    id:
      typeof crypto !== 'undefined' &&
      crypto.randomUUID
        ? crypto.randomUUID()
        : `row-${Date.now()}`,
    label: nextLabel,
    title: 'Nouveau rang',
    media: [],
  };

  setRows((currentRows) => [
    ...currentRows,
    newRow,
  ]);
};

const deleteRow = (rowId: string) => {
  const rowToDelete = rows.find(
    (row) => row.id === rowId
  );

  if (!rowToDelete) return;

  const confirmed = window.confirm(
    `Supprimer le rang ${rowToDelete.label} ?`
  );

  if (!confirmed) return;

  setUnranked((currentMedia) => {
    const allMedia = [
      ...currentMedia,
      ...rowToDelete.media,
    ];

    return Array.from(
      new Map(
        allMedia.map((media) => [
          `${media.type}_${media.id}`,
          media,
        ])
      ).values()
    );
  });

  setRows((currentRows) =>
    currentRows.filter(
      (row) => row.id !== rowId
    )
  );

  setDragOverRank(null);
};

  const saveTierList = () => {
    const data: TierListData = {
      title,
      rows,
      unranked,
    };

    localStorage.setItem(
      'steldra_tier_list_v1',
      JSON.stringify(data)
    );

    setSavedMessage('Tier list enregistrée');

    window.setTimeout(() => {
      setSavedMessage('');
    }, 2200);
  };

  const resetTierList = () => {
    const allMedia = [
      ...unranked,
      ...rows.flatMap((row) => row.media),
    ];

    const uniqueMedia = Array.from(
      new Map(
        allMedia.map((media) => [
          `${media.type}_${media.id}`,
          media,
        ])
      ).values()
    );

    setRows(defaultRows);
    setUnranked(uniqueMedia);
    setTitle('Ma tier list');
  };

  const downloadTierList = async () => {
    if (!tierListRef.current) return;

    try {
      const htmlToImage = await import('html-to-image');

      const dataUrl = await htmlToImage.toPng(
        tierListRef.current,
        {
          cacheBust: true,
          pixelRatio: 2,
          backgroundColor: '#222831',
        }
      );

      const link = document.createElement('a');

      link.download = `${title
        .trim()
        .toLowerCase()
        .replaceAll(' ', '-') || 'tier-list'}.png`;

      link.href = dataUrl;
      link.click();
    } catch (error) {
      console.error(
        'Erreur pendant le téléchargement :',
        error
      );

      alert(
        "Le téléchargement n'a pas pu être effectué."
      );
    }
  };

  const getPosterUrl = (media: MediaItem) => {
    if (!media.poster_path) {
      return '/placeholder-poster.png';
    }

    if (media.poster_path.startsWith('http')) {
      return media.poster_path;
    }

    return `https://image.tmdb.org/t/p/w342${media.poster_path}`;
  };

  return (
    <>
      <MainNav />

      <main className={styles.page}>
        <section className={styles.pageHeader}>
          <div>
            <p className={styles.eyebrow}>
              Classement personnel
            </p>

            <h1>Créer une tier list</h1>

            <p className={styles.description}>
              Classe les œuvres de ta collection selon tes
              préférences, puis enregistre ou télécharge le
              résultat.
            </p>
          </div>

          <div className={styles.headerActions}>
  <button
    type="button"
    className={styles.addRowButton}
    onClick={addRow}
  >
    + Ajouter un rang
  </button>

  <button
    type="button"
    className={styles.secondaryButton}
    onClick={resetTierList}
  >
    Réinitialiser
  </button>

  <button
    type="button"
    className={styles.secondaryButton}
    onClick={saveTierList}
  >
    Enregistrer
  </button>

  <button
    type="button"
    className={styles.primaryButton}
    onClick={downloadTierList}
  >
    Télécharger
  </button>
</div>
        </section>

        {savedMessage && (
          <p className={styles.savedMessage}>
            {savedMessage}
          </p>
        )}

        <section
          ref={tierListRef}
          className={styles.tierListExport}
        >
          <input
            className={styles.titleInput}
            value={title}
            onChange={(event) =>
              setTitle(event.target.value)
            }
            aria-label="Titre de la tier list"
          />

          
           <div className={styles.rows}>
            {rows.map((row, rowIndex) => (                
<div
  key={row.id}
  className={`${styles.tierRow} ${
    dragOverRank === row.id
      ? styles.tierRowDragOver
      : ''
  }`}
  onDragOver={(event) => {
    event.preventDefault();
    setDragOverRank(row.id);
  }}
  onDragLeave={(event) => {
    const nextElement =
      event.relatedTarget as Node | null;

    if (
      !nextElement ||
      !event.currentTarget.contains(nextElement)
    ) {
      setDragOverRank(null);
    }
  }}
  onDrop={(event) => {
    setDragOverRank(null);
    handleDropOnRow(event, row.id);
  }}
>
  <div
    className={styles.rankLabel}
    style={{
      backgroundColor: [
        '#f87171',
        '#fb923c',
        '#facc15',
        '#4ade80',
        '#60a5fa',
        '#a78bfa',
        '#f472b6',
        '#22d3ee',
      ][rowIndex % 8],
    }}
  >
    <input
      className={styles.rankInput}
      value={row.label}
      maxLength={3}
      onChange={(event) =>
        updateRowLabel(
          row.id,
          event.target.value
        )
      }
      aria-label={`Lettre du rang ${row.label}`}
    />
  </div>

  <div className={styles.rowContent}>
    <div className={styles.rowHeader}>
      <input
        className={styles.rowTitleInput}
        value={row.title}
        onChange={(event) =>
          updateRowTitle(
            row.id,
            event.target.value
          )
        }
        placeholder="Nom du rang"
        aria-label={`Nom du rang ${row.label}`}
      />

      <button
        type="button"
        className={styles.deleteRowButton}
        onClick={() => deleteRow(row.id)}
        title={`Supprimer le rang ${row.label}`}
        aria-label={`Supprimer le rang ${row.label}`}
      >
        Supprimer
      </button>
    </div>

    <div className={styles.rowMedia}>
      {row.media.length === 0 && (
        <span className={styles.emptyRowText}>
          Dépose une œuvre ici
        </span>
      )}

      {row.media.map((media) => (
        <button
          key={`${media.type}_${media.id}`}
          type="button"
          className={styles.posterButton}
          draggable
          onDragStart={() =>
            handleDragStart(media)
          }
          onDragEnd={() => {
            setDraggedMedia(null);
            setDragOverRank(null);
          }}
          onClick={() =>
            moveToUnranked(media)
          }
          title={`${media.title} — replacer dans les œuvres à classer`}
        >
          <img
            src={getPosterUrl(media)}
            alt={media.title}
            className={styles.poster}
          />
        </button>
      ))}
    </div>
  </div>
</div>            
))}
          </div>

          <p className={styles.signature}>
            Créé avec Steldra
          </p>
        </section>

        <section className={styles.librarySection}>
          <div className={styles.libraryHeader}>
            <div>
              <p className={styles.eyebrow}>
                Ta collection
              </p>

              <h2>Œuvres à classer</h2>
            </div>

            <span className={styles.mediaCount}>
              {unranked.length} œuvre
              {unranked.length > 1 ? 's' : ''}
            </span>
          </div>

          <div className={styles.filters}>
            <input
              type="search"
              value={search}
              onChange={(event) =>
                setSearch(event.target.value)
              }
              placeholder="Rechercher une œuvre..."
              className={styles.searchInput}
            />

            <div className={styles.typeFilters}>
              {(
                Object.keys(mediaLabels) as Array<
                  MediaType | 'tous'
                >
              ).map((type) => (
                <button
                  key={type}
                  type="button"
                  className={`${styles.filterButton} ${
                    filter === type
                      ? styles.filterButtonActive
                      : ''
                  }`}
                  onClick={() => setFilter(type)}
                >
                  {mediaLabels[type]}
                </button>
              ))}
            </div>
          </div>

          <div
            className={styles.unrankedGrid}
            onDragOver={(event) =>
              event.preventDefault()
            }
            onDrop={handleDropOnUnranked}
          >
            {filteredUnranked.map((media) => (
              <button
                key={`${media.type}_${media.id}`}
                type="button"
                className={styles.libraryPoster}
                draggable
                onDragStart={() =>
                  handleDragStart(media)
                }
                title={media.title}
              >
                <img
                  src={getPosterUrl(media)}
                  alt={media.title}
                  className={styles.poster}
                />

                <span>{media.title}</span>
              </button>
            ))}

            {filteredUnranked.length === 0 && (
              <p className={styles.emptyLibrary}>
                Aucune œuvre ne correspond à cette
                recherche.
              </p>
            )}
          </div>
        </section>
      </main>
    </>
  );
}