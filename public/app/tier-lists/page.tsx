'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import MainNav from '../components/mainNav';
import { createClient } from '../lib/supabase';
import type { CustomList, CustomListItem, MediaItem, MyListItem, MediaType } from '../types/media';
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

type SavedTierList = TierListData & {
  id: string;
  createdAt: string;
  updatedAt: string;
};

type TierSourceList = {
  id: string;
  name: string;
  media: MediaItem[];
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
  {
    id: 'f',
    label: 'F',
    title: 'À éviter',
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
  const router = useRouter();
  const [supabase] = useState(() => createClient());
  const tierListRef = useRef<HTMLDivElement | null>(null);
  const touchDraggedMediaRef = useRef<MediaItem | null>(null);
  const touchStartRef = useRef<{ x: number; y: number } | null>(null);
  const touchMovedRef = useRef(false);
  const coverRepairDoneRef = useRef(false);
  const suppressClickRef = useRef(false);

  const [title, setTitle] = useState('Ma Tier List');
  const [rows, setRows] = useState<TierRow[]>(defaultRows);
  const [unranked, setUnranked] = useState<MediaItem[]>([]);
  const [filter, setFilter] = useState<MediaType | 'tous'>('tous');
  const [search, setSearch] = useState('');
  const [draggedMedia, setDraggedMedia] = useState<MediaItem | null>(null);
  const [dragOverRank, setDragOverRank] = useState<string | null>(null);
  const [savedMessage, setSavedMessage] = useState('');
  const [touchDragging, setTouchDragging] = useState(false);
  const [savedTierLists, setSavedTierLists] = useState<SavedTierList[]>([]);
  const [activeSavedId, setActiveSavedId] = useState<string | null>(null);
  const [sourceLists, setSourceLists] = useState<TierSourceList[]>([]);
  const [activeSourceId, setActiveSourceId] = useState<'collection' | string>('collection');

  useEffect(() => {
    const savedHistory = localStorage.getItem('steldra_saved_tier_lists_v1');

    if (savedHistory) {
      try {
        const parsedHistory: SavedTierList[] = JSON.parse(savedHistory);
        if (Array.isArray(parsedHistory)) {
          setSavedTierLists(parsedHistory);
        }
      } catch (error) {
        console.error('Historique des tier lists illisible :', error);
      }
    }

    const savedTierList = localStorage.getItem('steldra_tier_list_v1');

    if (savedTierList) {
      try {
        const parsed: TierListData = JSON.parse(savedTierList);

        setTitle(parsed.title || 'Ma Tier List');
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

  useEffect(() => {
    const loadCustomLists = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        const { data: listData, error: listError } = await supabase
          .from('custom_lists')
          .select('*')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false });

        if (listError || !listData?.length) {
          if (listError) console.error('Impossible de charger les listes :', listError);
          setSourceLists([]);
          return;
        }

        const lists = listData as CustomList[];
        const listIds = lists.map((list) => list.id);
        const { data: itemData, error: itemError } = await supabase
          .from('custom_list_items')
          .select('*')
          .in('list_id', listIds)
          .order('position', { ascending: true });

        if (itemError) {
          console.error('Impossible de charger le contenu des listes :', itemError);
          return;
        }

        const grouped = new Map<string, MediaItem[]>();
        ((itemData || []) as CustomListItem[]).forEach((item) => {
          if (!item.media_data) return;
          const current = grouped.get(item.list_id) || [];
          current.push(item.media_data);
          grouped.set(item.list_id, current);
        });

        coverRepairDoneRef.current = false;
        setSourceLists(
          lists.map((list) => ({
            id: list.id,
            name: list.name,
            media: grouped.get(list.id) || [],
          }))
        );
      } catch (error) {
        console.error('Erreur de chargement des listes :', error);
      }
    };

    void loadCustomLists();
  }, [supabase]);

  useEffect(() => {
    if (coverRepairDoneRef.current) return;

    const allMedia = [
      ...unranked,
      ...rows.flatMap((row) => row.media),
      ...sourceLists.flatMap((list) => list.media),
    ];

    if (allMedia.length === 0) return;

    const missingCovers = Array.from(
      new Map(
        allMedia
          .filter(
            (media) =>
              (media.type === 'manga' || media.type === 'manhwa') &&
              !media.poster_path
          )
          .map((media) => [`${media.type}_${media.id}`, media])
      ).values()
    );

    coverRepairDoneRef.current = true;
    if (missingCovers.length === 0) return;

    const repairCovers = async () => {
      const repaired = new Map<string, string>();

      await Promise.allSettled(
        missingCovers.map(async (media) => {
          const response = await fetch(
            `/api/media-details?id=${encodeURIComponent(String(media.id))}&type=${encodeURIComponent(media.type)}`
          );

          if (!response.ok) return;

          const data = await response.json();
          if (typeof data.poster_path === 'string' && data.poster_path) {
            repaired.set(`${media.type}_${media.id}`, data.poster_path);
          }
        })
      );

      if (repaired.size === 0) return;

      const applyPoster = (media: MediaItem): MediaItem => {
        const poster = repaired.get(`${media.type}_${media.id}`);
        return poster ? { ...media, poster_path: poster } : media;
      };

      setUnranked((current) => current.map(applyPoster));
      setRows((currentRows) =>
        currentRows.map((row) => ({
          ...row,
          media: row.media.map(applyPoster),
        }))
      );
      setSourceLists((currentLists) =>
        currentLists.map((list) => ({
          ...list,
          media: list.media.map(applyPoster),
        }))
      );
    };

    void repairCovers();
  }, [rows, unranked, sourceLists]);

  const filteredUnranked = useMemo(() => {
    const rankedKeys = new Set(
      rows.flatMap((row) =>
        row.media.map((media) => `${media.type}_${media.id}`)
      )
    );

    const sourceMedia =
      activeSourceId === 'collection'
        ? unranked
        : sourceLists.find((list) => list.id === activeSourceId)?.media || [];

    return sourceMedia.filter((media) => {
      const mediaKey = `${media.type}_${media.id}`;
      const matchesType = filter === 'tous' || media.type === filter;
      const matchesSearch = media.title
        .toLowerCase()
        .includes(search.trim().toLowerCase());

      return !rankedKeys.has(mediaKey) && matchesType && matchesSearch;
    });
  }, [unranked, rows, sourceLists, activeSourceId, filter, search]);

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

  const handlePointerDown = (
    event: React.PointerEvent<HTMLButtonElement>,
    media: MediaItem
  ) => {
    event.currentTarget.setPointerCapture(event.pointerId);
    touchDraggedMediaRef.current = media;
    touchStartRef.current = { x: event.clientX, y: event.clientY };
    touchMovedRef.current = false;
    setDraggedMedia(media);
  };

  const handlePointerMove = (
    event: React.PointerEvent<HTMLButtonElement>
  ) => {
    if (!touchDraggedMediaRef.current) return;

    const start = touchStartRef.current;
    if (start) {
      const distance = Math.hypot(
        event.clientX - start.x,
        event.clientY - start.y
      );

      if (distance > 6) {
        touchMovedRef.current = true;
        setTouchDragging(true);
      }
    }

    if (!touchMovedRef.current) return;
    event.preventDefault();

    const edgeZone = 90;
    if (event.clientY < edgeZone) {
      window.scrollBy({ top: -22, behavior: 'auto' });
    } else if (event.clientY > window.innerHeight - edgeZone) {
      window.scrollBy({ top: 22, behavior: 'auto' });
    }

    const target = document.elementFromPoint(
      event.clientX,
      event.clientY
    ) as HTMLElement | null;

    const rowTarget = target?.closest<HTMLElement>('[data-tier-row-id]');
    const isUnranked = Boolean(
      target?.closest<HTMLElement>('[data-tier-unranked]')
    );

    if (rowTarget?.dataset.tierRowId) {
      setDragOverRank(rowTarget.dataset.tierRowId);
    } else if (isUnranked) {
      setDragOverRank('unranked');
    } else {
      setDragOverRank(null);
    }
  };

  const finishPointerDrag = (event: React.PointerEvent<HTMLButtonElement>) => {
    const media = touchDraggedMediaRef.current;
    if (!media) return;

    if (touchMovedRef.current) {
      suppressClickRef.current = true;
      window.setTimeout(() => {
        suppressClickRef.current = false;
      }, 250);

      const target = document.elementFromPoint(
        event.clientX,
        event.clientY
      ) as HTMLElement | null;

      const rowTarget = target?.closest<HTMLElement>('[data-tier-row-id]');
      const isUnranked = Boolean(
        target?.closest<HTMLElement>('[data-tier-unranked]')
      );

      if (rowTarget?.dataset.tierRowId) {
        moveToRow(media, rowTarget.dataset.tierRowId);
      } else if (isUnranked) {
        moveToUnranked(media);
      }
    }

    touchDraggedMediaRef.current = null;
    touchStartRef.current = null;
    touchMovedRef.current = false;
    setDraggedMedia(null);
    setDragOverRank(null);
    setTouchDragging(false);
  };

  const handlePointerUp = (
    event: React.PointerEvent<HTMLButtonElement>
  ) => {
    finishPointerDrag(event);
  };

  const handlePointerCancel = () => {
    touchDraggedMediaRef.current = null;
    touchStartRef.current = null;
    touchMovedRef.current = false;
    setDraggedMedia(null);
    setDragOverRank(null);
    setTouchDragging(false);
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

  const openMedia = (media: MediaItem) => {
    sessionStorage.setItem(
      'steldra_selected_media',
      JSON.stringify(media)
    );

    router.push(`/media/${media.type}/${media.id}`);
  };

  const persistTierList = (message = 'Tier list enregistrée') => {
    const now = new Date().toISOString();
    const data: TierListData = { title, rows, unranked };

    localStorage.setItem(
      'steldra_tier_list_v1',
      JSON.stringify(data)
    );

    let savedId = activeSavedId;

    setSavedTierLists((current) => {
      const existing = savedId
        ? current.find((item) => item.id === savedId)
        : undefined;

      if (!savedId) {
        savedId =
          typeof crypto !== 'undefined' && crypto.randomUUID
            ? crypto.randomUUID()
            : `tier-${Date.now()}`;
      }

      const snapshot: SavedTierList = {
        ...data,
        id: savedId!,
        createdAt: existing?.createdAt || now,
        updatedAt: now,
      };

      const next = existing
        ? current.map((item) =>
            item.id === savedId ? snapshot : item
          )
        : [snapshot, ...current];

      next.sort(
        (a, b) =>
          new Date(b.updatedAt).getTime() -
          new Date(a.updatedAt).getTime()
      );

      localStorage.setItem(
        'steldra_saved_tier_lists_v1',
        JSON.stringify(next)
      );

      return next;
    });

    setActiveSavedId(savedId);
    setSavedMessage(message);

    window.setTimeout(() => {
      setSavedMessage('');
    }, 2200);

    return savedId;
  };

  const saveTierList = () => {
    persistTierList('Tier list enregistrée');
  };

  const editSavedTierList = (saved: SavedTierList) => {
    setTitle(saved.title || 'Ma Tier List');
    setRows(saved.rows?.length ? saved.rows : defaultRows);
    setUnranked(saved.unranked || []);
    setActiveSavedId(saved.id);
    setSavedMessage('Tier list chargée — tu peux la modifier');

    window.setTimeout(() => {
      setSavedMessage('');
    }, 2200);

    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const deleteSavedTierList = (saved: SavedTierList) => {
    if (!window.confirm(`Supprimer « ${saved.title || 'Tier list'} » ?`)) {
      return;
    }

    setSavedTierLists((current) => {
      const next = current.filter((item) => item.id !== saved.id);
      localStorage.setItem(
        'steldra_saved_tier_lists_v1',
        JSON.stringify(next)
      );
      return next;
    });

    if (activeSavedId === saved.id) {
      setActiveSavedId(null);
    }
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
    setTitle('Ma Tier List');
    setActiveSavedId(null);
  };

  const captureTierList = async (exportTitle: string) => {
    const exportNode = tierListRef.current;
    if (!exportNode) return;

    try {
      const htmlToImage = await import('html-to-image');

      // Sur mobile, html-to-image peut sinon se limiter aux dimensions
      // visibles du bloc. On passe brièvement en mode export : largeur
      // stable + rangs entièrement dépliés, puis on capture le scrollHeight.
      exportNode.dataset.exporting = 'true';

      await new Promise<void>((resolve) => {
        requestAnimationFrame(() =>
          requestAnimationFrame(() => resolve())
        );
      });

      const exportWidth = Math.ceil(exportNode.scrollWidth);
      const exportHeight = Math.ceil(exportNode.scrollHeight);

      const dataUrl = await htmlToImage.toPng(exportNode, {
        cacheBust: true,
        pixelRatio: 2,
        backgroundColor: '#101720',
        width: exportWidth,
        height: exportHeight,
        style: {
          width: `${exportWidth}px`,
          height: `${exportHeight}px`,
          maxWidth: 'none',
          maxHeight: 'none',
          overflow: 'visible',
        },
      });

      const link = document.createElement('a');

      link.download = `${exportTitle
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
    } finally {
      if (exportNode) {
        delete exportNode.dataset.exporting;
      }
    }
  };

  const downloadTierList = async () => {
    persistTierList('Tier list enregistrée et téléchargée');
    await captureTierList(title);
  };

  const downloadSavedTierList = (saved: SavedTierList) => {
    const previous = {
      title,
      rows,
      unranked,
      activeSavedId,
    };

    setTitle(saved.title || 'Ma Tier List');
    setRows(saved.rows?.length ? saved.rows : defaultRows);
    setUnranked(saved.unranked || []);
    setActiveSavedId(saved.id);

    window.setTimeout(async () => {
      await captureTierList(saved.title || 'Tier List');

      setTitle(previous.title);
      setRows(previous.rows);
      setUnranked(previous.unranked);
      setActiveSavedId(previous.activeSavedId);
    }, 120);
  };

  const getPosterUrl = (media: MediaItem) => {
    if (!media.poster_path) {
      return '/steldra-poster-placeholder.svg';
    }

    const remoteUrl = media.poster_path.startsWith('http')
      ? media.poster_path
      : `https://image.tmdb.org/t/p/w342${media.poster_path}`;

    return `/api/poster-proxy?url=${encodeURIComponent(remoteUrl)}`;
  };

  return (
    <>
      <MainNav />

      <main className={`${styles.page} ${touchDragging ? styles.touchDragging : ''}`}>
        <section className={styles.heroPanel}>
          <div className={styles.pageHeader}>
            <div>
              <h1><span className={styles.titleIcon}>☆</span> Tier Lists</h1>
              <p className={styles.description}>
                Créez, organisez et partagez vos classements !
              </p>
            </div>
          </div>

          <div className={styles.filters}>
            <input
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="⌕  Rechercher un média..."
              className={styles.searchInput}
            />

            <div className={styles.typeFilters}>
              {(Object.keys(mediaLabels) as Array<MediaType | 'tous'>).map((type) => (
                <button
                  key={type}
                  type="button"
                  className={`${styles.filterButton} ${filter === type ? styles.filterButtonActive : ''}`}
                  onClick={() => setFilter(type)}
                >
                  {type === 'tous' ? 'Tous' : mediaLabels[type]}
                </button>
              ))}
            </div>
          </div>

          <div className={styles.sourcePicker}>
            <button
              type="button"
              className={`${styles.sourceButton} ${activeSourceId === 'collection' ? styles.sourceButtonActive : ''}`}
              onClick={() => setActiveSourceId('collection')}
            >
              Ma collection
            </button>

            {sourceLists.map((list) => (
              <button
                key={list.id}
                type="button"
                className={`${styles.sourceButton} ${activeSourceId === list.id ? styles.sourceButtonActive : ''}`}
                onClick={() => setActiveSourceId(list.id)}
              >
                {list.name}
                <span>{list.media.length}</span>
              </button>
            ))}
          </div>

          <div className={styles.libraryStripHeader}>
            <span>{filteredUnranked.length} disponible{filteredUnranked.length > 1 ? 's' : ''}</span>
          </div>

          <div
            data-tier-unranked
            className={`${styles.unrankedGrid} ${dragOverRank === 'unranked' ? styles.unrankedDragOver : ''}`}
          >
            {filteredUnranked.map((media) => (
              <button
                key={`${media.type}_${media.id}`}
                type="button"
                className={styles.libraryPoster}
                onPointerDown={(event) => handlePointerDown(event, media)}
                onPointerMove={handlePointerMove}
                onPointerUp={handlePointerUp}
                onPointerCancel={handlePointerCancel}
                onClick={(event) => {
                  if (suppressClickRef.current) {
                    event.preventDefault();
                    return;
                  }
                  openMedia(media);
                }}
                title={`${media.title} — ouvrir la fiche`}
              >
                <img
                  src={getPosterUrl(media)}
                  alt={media.title}
                  onError={(event) => {
                    event.currentTarget.onerror = null;
                    event.currentTarget.src = '/steldra-poster-placeholder.svg';
                  }}
                />
                <span>{media.title}</span>
              </button>
            ))}

            {filteredUnranked.length === 0 && (
              <p className={styles.emptyLibrary}>Aucune œuvre ne correspond à cette recherche.</p>
            )}
          </div>
        </section>

        {savedMessage && <p className={styles.savedMessage}>{savedMessage}</p>}

        <section ref={tierListRef} className={styles.tierListExport}>
          <div className={styles.tierHeader}>
            <div className={styles.tierTitleWrap}>
              <span className={styles.tierTitleIcon}>✎</span>
              <input
                className={styles.titleInput}
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                aria-label="Titre de la tier list"
              />
            </div>

            <div className={styles.headerActions} data-html2canvas-ignore="true">
              <button type="button" className={styles.secondaryButton} onClick={resetTierList}>
                ↻ Réinitialiser
              </button>
              <button type="button" className={styles.primaryButton} onClick={saveTierList}>
                ▣ Enregistrer
              </button>
              <button type="button" className={styles.primaryButton} onClick={downloadTierList}>
                ↓ Télécharger
              </button>
            </div>
          </div>

          <div className={styles.rows}>
            {rows.map((row, rowIndex) => (
              <div
                key={row.id}
                data-tier-row-id={row.id}
                className={`${styles.tierRow} ${dragOverRank === row.id ? styles.tierRowDragOver : ''}`}
              >
                <div
                  className={styles.rankLabel}
                  style={{
                    backgroundColor: [
                      '#ff5565', '#ff9a4d', '#ffd84a', '#52d66f', '#4ca9f5', '#a54be7', '#f472b6', '#22d3ee',
                    ][rowIndex % 8],
                  }}
                >
                  <input
                    className={styles.rankInput}
                    value={row.label}
                    maxLength={3}
                    onChange={(event) => updateRowLabel(row.id, event.target.value)}
                    aria-label={`Lettre du rang ${row.label}`}
                  />
                </div>

                <div className={styles.rowContent}>
                  <div className={styles.rowMedia}>
                    {row.media.length === 0 && (
                      <span className={styles.emptyRowText}>Glissez vos médias ici</span>
                    )}

                    {row.media.map((media) => (
                      <button
                        key={`${media.type}_${media.id}`}
                        type="button"
                        className={styles.posterButton}
                        onPointerDown={(event) => handlePointerDown(event, media)}
                        onPointerMove={handlePointerMove}
                        onPointerUp={handlePointerUp}
                        onPointerCancel={handlePointerCancel}
                        onClick={(event) => {
                          if (suppressClickRef.current) {
                            event.preventDefault();
                            return;
                          }
                          openMedia(media);
                        }}
                        title={`${media.title} — ouvrir la fiche`}
                      >
                        <img
                          src={getPosterUrl(media)}
                          alt={media.title}
                          className={styles.poster}
                          onError={(event) => {
                            event.currentTarget.onerror = null;
                            event.currentTarget.src = '/steldra-poster-placeholder.svg';
                          }}
                        />
                      </button>
                    ))}
                  </div>

                  <div className={styles.rowEditControls} data-html2canvas-ignore="true">
                    <input
                      className={styles.rowTitleInput}
                      value={row.title}
                      onChange={(event) => updateRowTitle(row.id, event.target.value)}
                      placeholder="Nom du rang"
                      aria-label={`Nom du rang ${row.label}`}
                    />
                    <button
                      type="button"
                      className={styles.deleteRowButton}
                      onClick={() => deleteRow(row.id)}
                      aria-label={`Supprimer le rang ${row.label}`}
                      title="Supprimer ce rang"
                    >
                      ×
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>

          <button type="button" className={styles.addRowButton} onClick={addRow} data-html2canvas-ignore="true">
            + Ajouter un rang
          </button>

          <p className={styles.signature}>Créé avec Steldra</p>
        </section>

        <section className={styles.savedTierListsSection}>
          <div className={styles.savedHeader}>
            <div className={styles.savedTitleWrap}>
              <span className={styles.savedTitleIcon}>▯</span>
              <h2>Mes Tier Lists sauvegardées</h2>
            </div>
            <span className={styles.mediaCount}>
              {savedTierLists.length} sauvegarde{savedTierLists.length > 1 ? 's' : ''}
            </span>
          </div>

          {savedTierLists.length === 0 ? (
            <p className={styles.emptySavedTierLists}>
              Tes Tier Lists enregistrées ou téléchargées apparaîtront ici.
            </p>
          ) : (
            <div className={styles.savedTierListsGrid}>
              {savedTierLists.map((saved) => {
                const rankedCount = saved.rows.reduce((total, row) => total + row.media.length, 0);
                const previewMedia = saved.rows.flatMap((row) => row.media).slice(0, 7);
                const date = new Intl.DateTimeFormat('fr-FR', {
                  day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit',
                }).format(new Date(saved.updatedAt));

                return (
                  <article
                    key={saved.id}
                    className={`${styles.savedTierListCard} ${activeSavedId === saved.id ? styles.savedTierListCardActive : ''}`}
                  >
                    <div className={styles.savedPreview}>
                      {previewMedia.length > 0 ? previewMedia.map((media) => (
                        <img key={`${media.type}_${media.id}`} src={getPosterUrl(media)} alt="" />
                      )) : <span>TL</span>}
                    </div>

                    <div className={styles.savedInfo}>
                      <h3>{saved.title || 'Tier list sans titre'}</h3>
                      <p>Modifiée le {date} · {rankedCount} média{rankedCount > 1 ? 's' : ''}</p>
                    </div>

                    <div className={styles.savedTierListActions}>
                      <button type="button" className={styles.primaryButton} onClick={() => editSavedTierList(saved)}>
                        ✎ Modifier
                      </button>
                      <button type="button" className={styles.secondaryButton} onClick={() => downloadSavedTierList(saved)}>
                        ↓ Télécharger
                      </button>
                      <button type="button" className={styles.dangerButton} onClick={() => deleteSavedTierList(saved)} aria-label="Supprimer">
                        ♙
                      </button>
                    </div>
                  </article>
                );
              })}
            </div>
          )}

          <p className={styles.storageNote}>ⓘ Vos tier lists sont sauvegardées uniquement dans votre navigateur.</p>
        </section>
      </main>
    </>
  );
}
