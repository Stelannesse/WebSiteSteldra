'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';

import { createClient } from '../../lib/supabase';
import MainNav from '../../components/mainNav';

import type {
  CustomList,
  CustomListItem,
  MediaItem,
} from '../../types/media';

import styles from './listDetails.module.css';

export default function ListDetailsPage() {
  const params = useParams<{ id: string }>();
  const listId = params.id;

  const [supabase] = useState(() => createClient());

  const [list, setList] =
    useState<CustomList | null>(null);

  const [items, setItems] =
    useState<CustomListItem[]>([]);

  const [collectionMedia, setCollectionMedia] =
    useState<MediaItem[]>([]);

  const [loading, setLoading] = useState(true);
  const [loadingCollection, setLoadingCollection] =
    useState(false);

  const [addingItems, setAddingItems] =
    useState(false);

  const [showPicker, setShowPicker] =
    useState(false);

  const [searchQuery, setSearchQuery] =
    useState('');

  const [selectedMediaKeys, setSelectedMediaKeys] =
    useState<string[]>([]);

  const [errorMessage, setErrorMessage] =
    useState('');

  const getMediaKey = (
    media: MediaItem | {
      id: string | number;
      type: string;
    }
  ) => `${media.type}_${media.id}`;

  const getPosterUrl = (media: MediaItem) => {
    if (!media.poster_path) {
      return 'https://via.placeholder.com/200x300';
    }

    if (media.poster_path.startsWith('http')) {
      return media.poster_path;
    }

    return `https://image.tmdb.org/t/p/w300${media.poster_path}`;
  };

  useEffect(() => {
    if (!listId) return;

    let cancelled = false;

    const loadList = async () => {
      setLoading(true);
      setErrorMessage('');

      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        if (!cancelled) {
          setErrorMessage(
            'Vous devez être connecté pour consulter cette liste.'
          );
          setLoading(false);
        }

        return;
      }

      const {
        data: listData,
        error: listError,
      } = await supabase
        .from('custom_lists')
        .select('*')
        .eq('id', listId)
        .eq('user_id', user.id)
        .single();

      if (listError || !listData) {
        console.error(
          'Erreur chargement de la liste :',
          listError
        );

        if (!cancelled) {
          setErrorMessage(
            'Cette liste est introuvable ou inaccessible.'
          );
          setLoading(false);
        }

        return;
      }

      const {
        data: itemData,
        error: itemsError,
      } = await supabase
        .from('custom_list_items')
        .select('*')
        .eq('list_id', listId)
        .order('position', {
          ascending: true,
        });

      if (itemsError) {
        console.error(
          'Erreur chargement des médias :',
          itemsError
        );

        if (!cancelled) {
          setErrorMessage(
            'Impossible de charger les médias de la liste.'
          );
        }
      }

      if (!cancelled) {
        setList(listData);
        setItems(itemData || []);
        setLoading(false);
      }
    };

    void loadList();

    return () => {
      cancelled = true;
    };
  }, [listId, supabase]);

  const loadCollection = async () => {
    setLoadingCollection(true);
    setErrorMessage('');

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      setErrorMessage(
        'Vous devez être connecté pour accéder à votre collection.'
      );
      setLoadingCollection(false);
      return;
    }

    const { data, error } = await supabase
      .from('media_progress')
      .select(
        'media_id, media_type, media_data'
      )
      .eq('user_id', user.id);

    if (error) {
      console.error(
        'Erreur chargement de la collection :',
        error
      );

      setErrorMessage(
        'Impossible de charger votre collection.'
      );

      setLoadingCollection(false);
      return;
    }

    const uniqueMedia = new Map<string, MediaItem>();

    (data || []).forEach((entry) => {
      const media = {
        ...(entry.media_data || {}),
        id:
          entry.media_data?.id ??
          entry.media_id,
        type:
          entry.media_data?.type ??
          entry.media_type,
      } as MediaItem;

      if (!media.id || !media.type) {
        return;
      }

      uniqueMedia.set(
        getMediaKey(media),
        media
      );
    });

    const sortedMedia = Array.from(
      uniqueMedia.values()
    ).sort((firstMedia, secondMedia) =>
      (firstMedia.title || '').localeCompare(
        secondMedia.title || '',
        'fr',
        {
          numeric: true,
          sensitivity: 'base',
        }
      )
    );

    setCollectionMedia(sortedMedia);
    setLoadingCollection(false);
  };

  const openMediaPicker = async () => {
    setShowPicker(true);
    setSelectedMediaKeys([]);
    setSearchQuery('');

    if (collectionMedia.length === 0) {
      await loadCollection();
    }
  };

  const closeMediaPicker = () => {
    if (addingItems) return;

    setShowPicker(false);
    setSelectedMediaKeys([]);
    setSearchQuery('');
  };

  const toggleMediaSelection = (
    mediaKey: string
  ) => {
    setSelectedMediaKeys((currentKeys) => {
      if (currentKeys.includes(mediaKey)) {
        return currentKeys.filter(
          (key) => key !== mediaKey
        );
      }

      return [...currentKeys, mediaKey];
    });
  };

  const existingMediaKeys = useMemo(
    () =>
      new Set(
        items.map((item) =>
          getMediaKey({
            id: item.media_id,
            type: item.media_type,
          })
        )
      ),
    [items]
  );

  const filteredCollection = useMemo(() => {
    const normalizedQuery =
      searchQuery.trim().toLocaleLowerCase('fr');

    return collectionMedia.filter((media) => {
      const mediaKey = getMediaKey(media);

      if (existingMediaKeys.has(mediaKey)) {
        return false;
      }

      if (!normalizedQuery) {
        return true;
      }

      return (media.title || '')
        .toLocaleLowerCase('fr')
        .includes(normalizedQuery);
    });
  }, [
    collectionMedia,
    existingMediaKeys,
    searchQuery,
  ]);

  const addSelectedMedia = async () => {
    if (
      !listId ||
      selectedMediaKeys.length === 0 ||
      addingItems
    ) {
      return;
    }

    setAddingItems(true);
    setErrorMessage('');

    try {
      const selectedMedia = collectionMedia.filter(
        (media) =>
          selectedMediaKeys.includes(
            getMediaKey(media)
          )
      );

      const highestPosition =
        items.length > 0
          ? Math.max(
              ...items.map((item) =>
                Number(item.position)
              )
            )
          : -1;

      const rows = selectedMedia.map(
        (media, index) => ({
          list_id: listId,
          media_id: media.id.toString(),
          media_type: media.type,
          media_data: media,
          position:
            highestPosition + index + 1,
        })
      );

      const {
        data: insertedItems,
        error,
      } = await supabase
        .from('custom_list_items')
        .insert(rows)
        .select('*');

      if (error) {
        throw error;
      }

      setItems((currentItems) =>
        [
          ...currentItems,
          ...((insertedItems ||
            []) as CustomListItem[]),
        ].sort(
          (firstItem, secondItem) =>
            firstItem.position -
            secondItem.position
        )
      );

      setSelectedMediaKeys([]);
      setSearchQuery('');
      setShowPicker(false);
    } catch (error) {
      console.error(
        'Erreur ajout des médias :',
        error
      );

      setErrorMessage(
        'Impossible d’ajouter les médias sélectionnés.'
      );
    } finally {
      setAddingItems(false);
    }
  };

  return (
    <>
      <MainNav />

      <main className={styles.page}>
        <Link
          href="/lists"
          className={styles.backLink}
        >
          ← Retour à mes listes
        </Link>

        {loading ? (
          <p>Chargement de la liste…</p>
        ) : errorMessage && !list ? (
          <p className={styles.error}>
            {errorMessage}
          </p>
        ) : list ? (
          <>
            <header className={styles.header}>
              <div>
                <p className={styles.eyebrow}>
                  Liste personnalisée
                </p>

                <h1>{list.name}</h1>

                <p className={styles.description}>
                  {list.description ||
                    'Liste organisée dans votre ordre personnalisé.'}
                </p>
              </div>

              <div className={styles.count}>
                <strong>{items.length}</strong>

                <span>
                  {items.length > 1
                    ? 'médias'
                    : 'média'}
                </span>
              </div>
            </header>

            {errorMessage && (
              <p className={styles.error}>
                {errorMessage}
              </p>
            )}

            {items.length === 0 ? (
              <section className={styles.empty}>
                <button
                  type="button"
                  className={styles.addMediaButton}
                  onClick={openMediaPicker}
                >
                  ＋ Ajouter des médias
                </button>

                <h2>
                  Cette liste est encore vide
                </h2>

                <p>
                  Ajoutez des films, séries, animés ou
                  mangas depuis votre collection.
                </p>
              </section>
            ) : (
              <>
                <div className={styles.listActions}>
                  <button
                    type="button"
                    className={styles.addMediaButton}
                    onClick={openMediaPicker}
                  >
                    ＋ Ajouter des médias
                  </button>
                </div>

                <section className={styles.items}>
                  {items.map((item, index) => (
                    <article
                      key={item.id}
                      className={styles.item}
                    >
                      <span
                        className={styles.position}
                      >
                        {index + 1}
                      </span>

                      <img
                        src={getPosterUrl(
                          item.media_data
                        )}
                        alt={
                          item.media_data.title
                        }
                        className={styles.poster}
                      />

                      <div className={styles.itemContent}>
                        <h2>
                          {item.media_data.title}
                        </h2>

                        <p>{item.media_type}</p>
                      </div>
                    </article>
                  ))}
                </section>
              </>
            )}

            {showPicker && (
              <div
                className={styles.pickerOverlay}
                onMouseDown={(event) => {
                  if (
                    event.target ===
                    event.currentTarget
                  ) {
                    closeMediaPicker();
                  }
                }}
              >
                <section
                  className={styles.picker}
                  role="dialog"
                  aria-modal="true"
                  aria-labelledby="media-picker-title"
                >
                  <div
                    className={styles.pickerHeader}
                  >
                    <div>
                      <p className={styles.eyebrow}>
                        Ajouter à la liste
                      </p>

                      <h2 id="media-picker-title">
                        {list.name}
                      </h2>
                    </div>

                    <button
                      type="button"
                      className={styles.closeButton}
                      onClick={closeMediaPicker}
                      aria-label="Fermer"
                    >
                      ×
                    </button>
                  </div>

                  <input
                    type="search"
                    value={searchQuery}
                    onChange={(event) =>
                      setSearchQuery(
                        event.target.value
                      )
                    }
                    className={styles.pickerSearch}
                    placeholder="Rechercher dans ma collection…"
                  />

                  {loadingCollection ? (
                    <p className={styles.pickerMessage}>
                      Chargement de la collection…
                    </p>
                  ) : filteredCollection.length ===
                    0 ? (
                    <p className={styles.pickerMessage}>
                      Aucun média disponible.
                    </p>
                  ) : (
                    <div
                      className={styles.mediaGrid}
                    >
                      {filteredCollection.map(
                        (media) => {
                          const mediaKey =
                            getMediaKey(media);

                          const isSelected =
                            selectedMediaKeys.includes(
                              mediaKey
                            );

                          return (
                            <button
                              type="button"
                              key={mediaKey}
                              className={`${styles.mediaChoice} ${
                                isSelected
                                  ? styles.mediaChoiceSelected
                                  : ''
                              }`}
                              onClick={() =>
                                toggleMediaSelection(
                                  mediaKey
                                )
                              }
                            >
                              <div
                                className={
                                  styles.mediaPosterWrapper
                                }
                              >
                                <img
                                  src={getPosterUrl(
                                    media
                                  )}
                                  alt={media.title}
                                  className={
                                    styles.mediaChoicePoster
                                  }
                                />

                                {isSelected && (
                                  <span
                                    className={
                                      styles.selectedMark
                                    }
                                  >
                                    ✓
                                  </span>
                                )}
                              </div>

                              <strong>
                                {media.title}
                              </strong>

                              <span>
                                {media.type}
                              </span>
                            </button>
                          );
                        }
                      )}
                    </div>
                  )}

                  <div
                    className={styles.pickerFooter}
                  >
                    <span>
                      {selectedMediaKeys.length}{' '}
                      sélectionné
                      {selectedMediaKeys.length >
                      1
                        ? 's'
                        : ''}
                    </span>

                    <button
                      type="button"
                      className={
                        styles.confirmButton
                      }
                      disabled={
                        selectedMediaKeys.length ===
                          0 || addingItems
                      }
                      onClick={addSelectedMedia}
                    >
                      {addingItems
                        ? 'Ajout en cours…'
                        : `Ajouter ${
                            selectedMediaKeys.length ||
                            ''
                          }`}
                    </button>
                  </div>
                </section>
              </div>
            )}
          </>
        ) : null}
      </main>
    </>
  );
}