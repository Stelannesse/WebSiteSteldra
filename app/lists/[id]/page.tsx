'use client';

import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useEffect, useMemo, useRef, useState } from 'react';

import { createClient } from '../../lib/supabase';
import MainNav from '../../components/mainNav';
import type { CustomList, CustomListItem, MediaItem, WatchStatus } from '../../types/media';
import styles from './listDetails.module.css';
import { getPosterUrl, usePosterFallback } from '../../lib/poster';

const TYPE_LABELS: Record<string, string> = {
  movie: 'Film',
  tv: 'Série',
  drama: 'Drama',
  anime: 'Animé',
  manga: 'Manga',
  manhwa: 'Manhwa',
};

export default function ListDetailsPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const listId = params.id;
  const [supabase] = useState(() => createClient());

  const [list, setList] = useState<CustomList | null>(null);
  const [items, setItems] = useState<CustomListItem[]>([]);
  const [mediaStatuses, setMediaStatuses] = useState<Record<string, WatchStatus>>({});
  const [collectionMedia, setCollectionMedia] = useState<MediaItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingCollection, setLoadingCollection] = useState(false);
  const [addingItems, setAddingItems] = useState(false);
  const [showPicker, setShowPicker] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedMediaKeys, setSelectedMediaKeys] = useState<string[]>([]);
  const [errorMessage, setErrorMessage] = useState('');

  const [draggedItemId, setDraggedItemId] = useState<string | null>(null);
  const [savingOrder, setSavingOrder] = useState(false);
  const [isTouchDevice, setIsTouchDevice] = useState(false);
  const dragStartItemsRef = useRef<CustomListItem[]>([]);
  const currentItemsRef = useRef<CustomListItem[]>([]);
  const pointerDraggedItemIdRef = useRef<string | null>(null);
  const pointerStartRef = useRef<{ x: number; y: number } | null>(null);
  const pointerMovedRef = useRef(false);
  const suppressOpenRef = useRef(false);

  const [deletingItemId, setDeletingItemId] = useState<string | null>(null);
  const [isEditingMeta, setIsEditingMeta] = useState(false);
  const [editedTitle, setEditedTitle] = useState('');
  const [editedDescription, setEditedDescription] = useState('');
  const [savingMeta, setSavingMeta] = useState(false);
  const [deletingList, setDeletingList] = useState(false);
  const [duplicatingList, setDuplicatingList] = useState(false);
  const [updatingStatusKey, setUpdatingStatusKey] = useState<string | null>(null);

  const getMediaKey = (media: MediaItem | { id: string | number; type: string }) =>
    `${media.type}_${media.id}`;


  useEffect(() => {
    currentItemsRef.current = items;
  }, [items]);

  useEffect(() => {
    const mediaQuery = window.matchMedia('(pointer: coarse)');
    const updateTouchMode = () => setIsTouchDevice(mediaQuery.matches || navigator.maxTouchPoints > 0);
    updateTouchMode();
    mediaQuery.addEventListener?.('change', updateTouchMode);
    return () => mediaQuery.removeEventListener?.('change', updateTouchMode);
  }, []);

  useEffect(() => {
    if (!listId) return;
    let cancelled = false;

    const loadList = async () => {
      setLoading(true);
      setErrorMessage('');

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        if (!cancelled) {
          setErrorMessage('Vous devez être connecté pour consulter cette liste.');
          setLoading(false);
        }
        return;
      }

      const [{ data: listData, error: listError }, { data: itemData, error: itemsError }] =
        await Promise.all([
          supabase.from('custom_lists').select('*').eq('id', listId).eq('user_id', user.id).single(),
          supabase.from('custom_list_items').select('*').eq('list_id', listId).order('position', { ascending: true }),
        ]);

      if (listError || !listData) {
        if (!cancelled) {
          setErrorMessage('Cette liste est introuvable ou inaccessible.');
          setLoading(false);
        }
        return;
      }

      if (itemsError) {
        console.error('Erreur chargement des médias :', itemsError);
      }

      const listItems = (itemData || []) as CustomListItem[];
      const ids = Array.from(new Set(listItems.map((item) => item.media_id)));
      const statuses: Record<string, WatchStatus> = {};

      if (ids.length > 0) {
        const { data: progressData, error: progressError } = await supabase
          .from('media_progress')
          .select('media_id, media_type, status')
          .eq('user_id', user.id)
          .in('media_id', ids);

        if (!progressError) {
          (progressData || []).forEach((entry) => {
            statuses[`${entry.media_type}_${entry.media_id}`] = entry.status as WatchStatus;
          });
        }
      }

      if (!cancelled) {
        setList(listData as CustomList);
        setItems(listItems);
        setMediaStatuses(statuses);
        setEditedTitle(listData.name || '');
        setEditedDescription(listData.description || '');
        setLoading(false);
      }
    };

    void loadList();
    return () => { cancelled = true; };
  }, [listId, supabase]);

  const existingMediaKeys = useMemo(
    () => new Set(items.map((item) => getMediaKey({ id: item.media_id, type: item.media_type }))),
    [items]
  );

  const filteredCollection = useMemo(() => {
    const normalizedQuery = searchQuery.trim().toLocaleLowerCase('fr');
    return collectionMedia.filter((media) => {
      if (existingMediaKeys.has(getMediaKey(media))) return false;
      if (!normalizedQuery) return true;
      return (media.title || '').toLocaleLowerCase('fr').includes(normalizedQuery);
    });
  }, [collectionMedia, existingMediaKeys, searchQuery]);

  const watchedCount = useMemo(
    () => items.filter((item) => mediaStatuses[getMediaKey({ id: item.media_id, type: item.media_type })] === 'vu').length,
    [items, mediaStatuses]
  );

  const nextItem = useMemo(
    () => items.find((item) => mediaStatuses[getMediaKey({ id: item.media_id, type: item.media_type })] !== 'vu') || null,
    [items, mediaStatuses]
  );

  const loadCollection = async () => {
    setLoadingCollection(true);
    setErrorMessage('');
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      setLoadingCollection(false);
      return;
    }

    const { data, error } = await supabase
      .from('media_progress')
      .select('media_id, media_type, media_data')
      .eq('user_id', user.id);

    if (error) {
      setErrorMessage('Impossible de charger votre collection.');
      setLoadingCollection(false);
      return;
    }

    const uniqueMedia = new Map<string, MediaItem>();
    (data || []).forEach((entry) => {
      const media = {
        ...(entry.media_data || {}),
        id: entry.media_data?.id ?? entry.media_id,
        type: entry.media_data?.type ?? entry.media_type,
      } as MediaItem;
      if (media.id && media.type) uniqueMedia.set(getMediaKey(media), media);
    });

    setCollectionMedia(
      Array.from(uniqueMedia.values()).sort((a, b) =>
        (a.title || '').localeCompare(b.title || '', 'fr', { numeric: true, sensitivity: 'base' })
      )
    );
    setLoadingCollection(false);
  };

  const openMediaPicker = async () => {
    setShowPicker(true);
    setSelectedMediaKeys([]);
    setSearchQuery('');
    if (collectionMedia.length === 0) await loadCollection();
  };

  const closeMediaPicker = () => {
    if (addingItems) return;
    setShowPicker(false);
    setSelectedMediaKeys([]);
    setSearchQuery('');
  };

  const toggleMediaSelection = (key: string) => {
    setSelectedMediaKeys((current) =>
      current.includes(key) ? current.filter((item) => item !== key) : [...current, key]
    );
  };

  const addSelectedMedia = async () => {
    if (!selectedMediaKeys.length || addingItems) return;
    setAddingItems(true);
    setErrorMessage('');

    try {
      const selectedMedia = collectionMedia.filter((media) => selectedMediaKeys.includes(getMediaKey(media)));
      const highestPosition = items.length ? Math.max(...items.map((item) => Number(item.position))) : -1;
      const rows = selectedMedia.map((media, index) => ({
        list_id: listId,
        media_id: media.id.toString(),
        media_type: media.type,
        media_data: media,
        position: highestPosition + index + 1,
      }));

      const { data, error } = await supabase.from('custom_list_items').insert(rows).select('*');
      if (error) throw error;

      setItems((current) => [...current, ...((data || []) as CustomListItem[])].sort((a, b) => a.position - b.position));
      setShowPicker(false);
      setSelectedMediaKeys([]);
      setSearchQuery('');
    } catch (error) {
      console.error(error);
      setErrorMessage('Impossible d’ajouter les médias sélectionnés.');
    } finally {
      setAddingItems(false);
    }
  };

  const reorderItems = (currentItems: CustomListItem[], draggedId: string, targetId: string) => {
    const fromIndex = currentItems.findIndex((item) => item.id === draggedId);
    const toIndex = currentItems.findIndex((item) => item.id === targetId);
    if (fromIndex < 0 || toIndex < 0 || fromIndex === toIndex) return currentItems;
    const next = [...currentItems];
    const [moved] = next.splice(fromIndex, 1);
    next.splice(toIndex, 0, moved);
    return next.map((item, index) => ({ ...item, position: index }));
  };

  const saveOrder = async (orderedItems: CustomListItem[], fallbackItems: CustomListItem[]) => {
    if (savingOrder) return;
    setSavingOrder(true);
    try {
      const results = await Promise.all(
        orderedItems.map((item, index) =>
          supabase.from('custom_list_items').update({ position: index }).eq('id', item.id).eq('list_id', listId)
        )
      );
      const failed = results.find((result) => result.error);
      if (failed?.error) throw failed.error;
    } catch (error) {
      console.error(error);
      setItems(fallbackItems);
      setErrorMessage('Le nouvel ordre n’a pas pu être enregistré.');
    } finally {
      setSavingOrder(false);
    }
  };

  const handleDragStart = (itemId: string, event: React.DragEvent<HTMLElement>) => {
    dragStartItemsRef.current = items.map((item) => ({ ...item }));
    setDraggedItemId(itemId);
    event.dataTransfer.effectAllowed = 'move';
    event.dataTransfer.setData('text/plain', itemId);
  };

  const handleDragOver = (targetId: string, event: React.DragEvent<HTMLElement>) => {
    event.preventDefault();
    if (!draggedItemId || draggedItemId === targetId) return;
    setItems((current) => reorderItems(current, draggedItemId, targetId));
  };

  const handleDragEnd = async () => {
    if (!draggedItemId) return;
    const fallback = dragStartItemsRef.current;
    const finalItems = currentItemsRef.current.map((item, index) => ({ ...item, position: index }));
    setDraggedItemId(null);
    setItems(finalItems);
    if (finalItems.some((item, index) => fallback[index]?.id !== item.id)) {
      await saveOrder(finalItems, fallback);
    }
  };

  const handlePointerDown = (itemId: string, event: React.PointerEvent<HTMLElement>) => {
    if (!isTouchDevice || event.pointerType === 'mouse' || savingOrder) return;
    if ((event.target as HTMLElement).closest('button')) return;

    event.currentTarget.setPointerCapture(event.pointerId);
    dragStartItemsRef.current = currentItemsRef.current.map((item) => ({ ...item }));
    pointerDraggedItemIdRef.current = itemId;
    pointerStartRef.current = { x: event.clientX, y: event.clientY };
    pointerMovedRef.current = false;
  };

  const handlePointerMove = (event: React.PointerEvent<HTMLElement>) => {
    const itemId = pointerDraggedItemIdRef.current;
    if (!itemId || event.pointerType === 'mouse') return;

    const start = pointerStartRef.current;
    if (!start) return;

    const distance = Math.hypot(event.clientX - start.x, event.clientY - start.y);
    if (!pointerMovedRef.current && distance < 8) return;

    pointerMovedRef.current = true;
    setDraggedItemId(itemId);
    event.preventDefault();

    const target = document.elementFromPoint(event.clientX, event.clientY) as HTMLElement | null;
    const targetItem = target?.closest<HTMLElement>('[data-list-item-id]');
    const targetId = targetItem?.dataset.listItemId;
    if (!targetId || targetId === itemId) return;

    setItems((current) => {
      const reordered = reorderItems(current, itemId, targetId);
      currentItemsRef.current = reordered;
      return reordered;
    });
  };

  const finishPointerDrag = async (event: React.PointerEvent<HTMLElement>) => {
    const itemId = pointerDraggedItemIdRef.current;
    if (!itemId || event.pointerType === 'mouse') return;

    const moved = pointerMovedRef.current;
    const fallback = dragStartItemsRef.current;
    const finalItems = currentItemsRef.current.map((item, index) => ({ ...item, position: index }));

    pointerDraggedItemIdRef.current = null;
    pointerStartRef.current = null;
    pointerMovedRef.current = false;
    setDraggedItemId(null);

    if (!moved) return;

    suppressOpenRef.current = true;
    window.setTimeout(() => { suppressOpenRef.current = false; }, 350);
    setItems(finalItems);

    if (finalItems.some((item, index) => fallback[index]?.id !== item.id)) {
      await saveOrder(finalItems, fallback);
    }
  };

  const handlePointerCancel = () => {
    pointerDraggedItemIdRef.current = null;
    pointerStartRef.current = null;
    pointerMovedRef.current = false;
    setDraggedItemId(null);
    if (dragStartItemsRef.current.length) {
      setItems(dragStartItemsRef.current);
      currentItemsRef.current = dragStartItemsRef.current;
    }
  };

  const moveItem = async (itemId: string, direction: -1 | 1) => {
    if (savingOrder) return;
    const fromIndex = items.findIndex((item) => item.id === itemId);
    const toIndex = fromIndex + direction;
    if (fromIndex < 0 || toIndex < 0 || toIndex >= items.length) return;
    const fallback = items.map((item) => ({ ...item }));
    const reordered = reorderItems(items, itemId, items[toIndex].id);
    setItems(reordered);
    await saveOrder(reordered, fallback);
  };

  const removeItem = async (item: CustomListItem) => {
    if (deletingItemId || savingOrder) return;
    if (!window.confirm(`Retirer « ${item.media_data.title} » de cette liste ?`)) return;
    setDeletingItemId(item.id);
    try {
      const { error } = await supabase.from('custom_list_items').delete().eq('id', item.id).eq('list_id', listId);
      if (error) throw error;
      const remaining = items.filter((current) => current.id !== item.id).map((current, index) => ({ ...current, position: index }));
      setItems(remaining);
      await Promise.all(
        remaining.map((current, index) =>
          supabase.from('custom_list_items').update({ position: index }).eq('id', current.id).eq('list_id', listId)
        )
      );
    } catch (error) {
      console.error(error);
      setErrorMessage('Impossible de retirer ce média de la liste.');
    } finally {
      setDeletingItemId(null);
    }
  };

  const saveListMeta = async () => {
    if (!list || savingMeta) return;
    const name = editedTitle.trim();
    if (!name) {
      setErrorMessage('Le nom de la liste ne peut pas être vide.');
      return;
    }
    setSavingMeta(true);
    const description = editedDescription.trim() || null;
    const { error } = await supabase.from('custom_lists').update({ name, description }).eq('id', listId);
    if (error) {
      setErrorMessage('Impossible de modifier la liste.');
    } else {
      setList({ ...list, name, description });
      setIsEditingMeta(false);
    }
    setSavingMeta(false);
  };

  const toggleWatched = async (item: CustomListItem) => {
    const key = getMediaKey({ id: item.media_id, type: item.media_type });
    if (updatingStatusKey) return;
    setUpdatingStatusKey(key);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Utilisateur absent');
      const currentStatus = mediaStatuses[key];
      const newStatus: WatchStatus = currentStatus === 'vu' ? 'a_voir' : 'vu';

      const { error } = await supabase.from('media_progress').upsert({
        user_id: user.id,
        media_id: item.media_id,
        media_type: item.media_type,
        media_data: item.media_data,
        status: newStatus,
      });
      if (error) throw error;
      setMediaStatuses((current) => ({ ...current, [key]: newStatus }));
    } catch (error) {
      console.error(error);
      setErrorMessage('Impossible de modifier le statut vu / à voir.');
    } finally {
      setUpdatingStatusKey(null);
    }
  };

  const openMedia = (item: CustomListItem) => {
    if (suppressOpenRef.current) return;
    sessionStorage.setItem('steldra_selected_media', JSON.stringify(item.media_data));
    router.push(`/media/${item.media_type}/${item.media_id}`);
  };

  const duplicateList = async () => {
    if (!list || duplicatingList) return;
    setDuplicatingList(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Utilisateur absent');
      const { data: newList, error: listError } = await supabase.from('custom_lists').insert({
        user_id: user.id,
        name: `${list.name} - copie`,
        description: list.description,
        is_ordered: list.is_ordered,
      }).select('*').single();
      if (listError || !newList) throw listError || new Error('Liste non créée');

      if (items.length) {
        const { error: itemsError } = await supabase.from('custom_list_items').insert(
          items.map((item, index) => ({
            list_id: newList.id,
            media_id: item.media_id,
            media_type: item.media_type,
            media_data: item.media_data,
            position: index,
          }))
        );
        if (itemsError) throw itemsError;
      }
      router.push(`/lists/${newList.id}`);
    } catch (error) {
      console.error(error);
      setErrorMessage('Impossible de dupliquer cette liste.');
      setDuplicatingList(false);
    }
  };

  const deleteList = async () => {
    if (!list || deletingList) return;
    if (!window.confirm(`Supprimer définitivement la liste « ${list.name} » ?\n\nLes médias resteront dans votre collection.`)) return;
    setDeletingList(true);
    try {
      const { error: itemsError } = await supabase.from('custom_list_items').delete().eq('list_id', listId);
      if (itemsError) throw itemsError;
      const { error: listError } = await supabase.from('custom_lists').delete().eq('id', listId);
      if (listError) throw listError;
      router.push('/lists');
    } catch (error) {
      console.error(error);
      setErrorMessage('Impossible de supprimer cette liste.');
      setDeletingList(false);
    }
  };

  const progressPercent = items.length ? Math.round((watchedCount / items.length) * 100) : 0;

  return (
    <>
      <MainNav />
      <main className={styles.page}>
        <Link href="/lists" className={styles.backLink}>← Retour à mes listes</Link>

        {loading ? (
          <p>Chargement de la liste…</p>
        ) : errorMessage && !list ? (
          <p className={styles.error}>{errorMessage}</p>
        ) : list ? (
          <>
            <header className={styles.header}>
              <div className={styles.headerTop}>
                <div className={styles.headerContent}>
                  <p className={styles.eyebrow}>Liste personnalisée</p>

                  {isEditingMeta ? (
                    <div className={styles.editMeta}>
                      <input
                        className={styles.titleInput}
                        value={editedTitle}
                        onChange={(event) => setEditedTitle(event.target.value)}
                        maxLength={80}
                        autoFocus
                      />
                      <textarea
                        className={styles.descriptionInput}
                        value={editedDescription}
                        onChange={(event) => setEditedDescription(event.target.value)}
                        maxLength={250}
                        rows={2}
                        placeholder="Description de la liste…"
                      />
                      <div className={styles.editActions}>
                        <button type="button" onClick={() => void saveListMeta()} disabled={savingMeta}>
                          {savingMeta ? 'Enregistrement…' : '✓ Enregistrer'}
                        </button>
                        <button type="button" className={styles.secondaryButton} onClick={() => {
                          setEditedTitle(list.name);
                          setEditedDescription(list.description || '');
                          setIsEditingMeta(false);
                        }}>Annuler</button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <div className={styles.titleRow}>
                        <h1>{list.name}</h1>
                        <button type="button" className={styles.iconButton} onClick={() => setIsEditingMeta(true)} title="Modifier le nom et la description">✎</button>
                        <span className={styles.countInline}>{items.length} {items.length > 1 ? 'médias' : 'média'}</span>
                      </div>
                      <p className={styles.description}>{list.description || 'Liste organisée dans votre ordre personnalisé.'}</p>
                    </>
                  )}
                </div>

                <div className={styles.listActions}>
                  <button type="button" className={styles.secondaryButton} onClick={() => void duplicateList()} disabled={duplicatingList}>
                    {duplicatingList ? 'Copie…' : '⧉ Dupliquer'}
                  </button>
                  <button type="button" className={styles.dangerButton} onClick={() => void deleteList()} disabled={deletingList}>
                    {deletingList ? 'Suppression…' : 'Supprimer la liste'}
                  </button>
                </div>
              </div>

              {items.length > 0 && (
                <div className={styles.progressBlock}>
                  <div className={styles.progressText}>
                    <span>{watchedCount} / {items.length} vus</span>
                    <strong>{progressPercent} %</strong>
                  </div>
                  <div className={styles.progressTrack}><div className={styles.progressFill} style={{ width: `${progressPercent}%` }} /></div>
                </div>
              )}
            </header>

            {errorMessage && <p className={styles.error}>{errorMessage}</p>}

            {nextItem && (
              <section className={styles.nextCard}>
                <img src={getPosterUrl(nextItem.media_data)} alt={nextItem.media_data.title} onError={(event) => usePosterFallback(event.currentTarget)} />
                <div>
                  <p className={styles.eyebrow}>À regarder ensuite</p>
                  <h2>{nextItem.media_data.title}</h2>
                  <span>{TYPE_LABELS[nextItem.media_type] || nextItem.media_type}</span>
                </div>
                <button type="button" onClick={() => openMedia(nextItem)}>Voir la fiche →</button>
              </section>
            )}

            {items.length === 0 ? (
              <section className={styles.empty}>
                <button type="button" className={styles.addMediaButton} onClick={openMediaPicker}>＋ Ajouter des médias</button>
                <h2>Cette liste est encore vide</h2>
                <p>Ajoutez films, séries, animés, mangas ou manhwas depuis votre collection.</p>
              </section>
            ) : (
              <>
                <div className={styles.listToolbar}>
                  <p className={styles.dragHint}>↕ {isTouchDevice ? 'Glissez la poignée ⠿ pour modifier l’ordre' : 'Glissez les affiches pour modifier l’ordre'} {savingOrder && <span className={styles.savingLabel}>Enregistrement…</span>}</p>
                  <button type="button" className={styles.addMediaButton} onClick={openMediaPicker}>＋ Ajouter plusieurs médias</button>
                </div>

                <section className={styles.items}>
                  {items.map((item, index) => {
                    const key = getMediaKey({ id: item.media_id, type: item.media_type });
                    const watched = mediaStatuses[key] === 'vu';
                    return (
                      <article
                        key={item.id}
                        data-list-item-id={item.id}
                        className={`${styles.item} ${draggedItemId === item.id ? styles.itemDragging : ''}`}
                        draggable={!savingOrder && !isTouchDevice}
                        onDragStart={(event) => handleDragStart(item.id, event)}
                        onDragOver={(event) => handleDragOver(item.id, event)}
                        onDragEnd={() => void handleDragEnd()}
                      >
                        <div className={styles.posterWrapper} onDoubleClick={() => openMedia(item)}>
                          <img src={getPosterUrl(item.media_data, 'w342')} onError={(event) => usePosterFallback(event.currentTarget)} alt={item.media_data.title} className={styles.poster} draggable={false} />
                          <span className={styles.position}>{index + 1}</span>
                          <button
                            type="button"
                            className={`${styles.watchedButton} ${watched ? styles.watchedButtonActive : ''}`}
                            onMouseDown={(event) => event.stopPropagation()}
                            onClick={(event) => { event.stopPropagation(); void toggleWatched(item); }}
                            disabled={updatingStatusKey === key}
                            title={watched ? 'Marquer à voir' : 'Marquer comme vu'}
                          >{watched ? '✓ Vu' : '○'}</button>
                          <button
                            type="button"
                            className={styles.deleteButton}
                            onMouseDown={(event) => event.stopPropagation()}
                            onClick={(event) => { event.stopPropagation(); void removeItem(item); }}
                            disabled={deletingItemId === item.id}
                            title="Retirer de la liste"
                          >{deletingItemId === item.id ? '…' : '×'}</button>
                          <span
                            className={styles.dragHandle}
                            role="button"
                            aria-label={`Déplacer ${item.media_data.title}`}
                            title="Maintenir et glisser pour déplacer"
                            onPointerDown={(event) => handlePointerDown(item.id, event)}
                            onPointerMove={handlePointerMove}
                            onPointerUp={(event) => void finishPointerDrag(event)}
                            onPointerCancel={handlePointerCancel}
                          >⠿</span>
                        </div>

                        <div className={styles.itemContent}>
                          <button type="button" className={styles.mediaTitleButton} onClick={() => openMedia(item)} title={item.media_data.title}>{item.media_data.title}</button>
                          <p>{TYPE_LABELS[item.media_type] || item.media_type}</p>
                          <div className={styles.mobileMoveButtons}>
                            <button type="button" onClick={() => void moveItem(item.id, -1)} disabled={index === 0 || savingOrder}>←</button>
                            <button type="button" onClick={() => void moveItem(item.id, 1)} disabled={index === items.length - 1 || savingOrder}>→</button>
                          </div>
                        </div>
                      </article>
                    );
                  })}
                </section>
              </>
            )}

            {showPicker && (
              <div className={styles.pickerOverlay} onMouseDown={(event) => { if (event.target === event.currentTarget) closeMediaPicker(); }}>
                <section className={styles.picker} role="dialog" aria-modal="true" aria-labelledby="media-picker-title">
                  <div className={styles.pickerHeader}>
                    <div><p className={styles.eyebrow}>Ajouter à la liste</p><h2 id="media-picker-title">{list.name}</h2></div>
                    <button type="button" className={styles.closeButton} onClick={closeMediaPicker}>×</button>
                  </div>
                  <input type="search" value={searchQuery} onChange={(event) => setSearchQuery(event.target.value)} className={styles.pickerSearch} placeholder="Rechercher dans ma collection…" />

                  {loadingCollection ? <p className={styles.pickerMessage}>Chargement de la collection…</p> : filteredCollection.length === 0 ? <p className={styles.pickerMessage}>Aucun média disponible.</p> : (
                    <div className={styles.mediaGrid}>
                      {filteredCollection.map((media) => {
                        const key = getMediaKey(media);
                        const selected = selectedMediaKeys.includes(key);
                        return (
                          <button type="button" key={key} className={`${styles.mediaChoice} ${selected ? styles.mediaChoiceSelected : ''}`} onClick={() => toggleMediaSelection(key)}>
                            <div className={styles.mediaPosterWrapper}>
                              <img src={getPosterUrl(media, 'w342')} onError={(event) => usePosterFallback(event.currentTarget)} alt={media.title} className={styles.mediaChoicePoster} />
                              {selected && <span className={styles.selectedMark}>✓</span>}
                            </div>
                            <strong>{media.title}</strong>
                            <span>{TYPE_LABELS[media.type] || media.type}</span>
                          </button>
                        );
                      })}
                    </div>
                  )}

                  <div className={styles.pickerFooter}>
                    <span>{selectedMediaKeys.length} sélectionné{selectedMediaKeys.length > 1 ? 's' : ''}</span>
                    <button type="button" className={styles.confirmButton} disabled={!selectedMediaKeys.length || addingItems} onClick={() => void addSelectedMedia()}>
                      {addingItems ? 'Ajout en cours…' : `Ajouter ${selectedMediaKeys.length || ''}`}
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
