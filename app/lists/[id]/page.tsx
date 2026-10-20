/**
 * Rôle du fichier : Page Détail d'une liste : gère son contenu, son ordre, son partage et ses informations.
 */

'use client';

import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useEffect, useMemo, useRef, useState } from 'react';

import { createClient } from '../../lib/supabase';
import MainNav from '../../components/mainNav';
import type { CustomList, CustomListItem, MediaItem, WatchStatus } from '../../types/media';
import styles from './listDetails.module.css';
import { getPosterUrl, usePosterFallback } from '../../lib/poster';
import { fetchAllPages } from '../../lib/supabasePaging';

const TYPE_LABELS: Record<string, string> = {
  movie: 'Film',
  tv: 'Série',
  drama: 'Drama',
  anime: 'Animé',
  manga: 'Manga',
  manhwa: 'Manhwa',
};

/** Composant principal de cette page ou zone d'interface. */
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
  const [itemSearchQuery, setItemSearchQuery] = useState('');
  const [itemSort, setItemSort] = useState<'manual' | 'title' | 'type' | 'status'>('manual');
  const [itemStatusFilter, setItemStatusFilter] = useState<'all' | 'vu' | 'a_voir'>('all');
  const [itemTypeFilter, setItemTypeFilter] = useState('all');
  const [sharingList, setSharingList] = useState(false);
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
  const pointerIdRef = useRef<number | null>(null);
  const pointerLastPositionRef = useRef<{ x: number; y: number } | null>(null);
  const autoScrollFrameRef = useRef<number | null>(null);
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
          fetchAllPages<CustomListItem>((from, to) => supabase.from('custom_list_items').select('*').in('media_type', ['movie', 'tv', 'drama', 'anime']).eq('list_id', listId).order('position', { ascending: true }).range(from, to)),
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
          .select('media_id, media_type, status').in('media_type', ['movie', 'tv', 'drama', 'anime'])
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

  const displayedItems = useMemo(() => {
    const q = itemSearchQuery.trim().toLocaleLowerCase('fr');
    const filtered = items.filter((item) => {
      const key = getMediaKey({ id: item.media_id, type: item.media_type });
      const status = mediaStatuses[key];
      if (q && !(item.media_data?.title || '').toLocaleLowerCase('fr').includes(q)) return false;
      if (itemStatusFilter !== 'all') {
        if (itemStatusFilter === 'vu' && status !== 'vu') return false;
        if (itemStatusFilter === 'a_voir' && status === 'vu') return false;
      }
      if (itemTypeFilter !== 'all' && item.media_type !== itemTypeFilter) return false;
      return true;
    });

    if (itemSort === 'manual') return filtered;
    return [...filtered].sort((a, b) => {
      if (itemSort === 'title') return (a.media_data?.title || '').localeCompare(b.media_data?.title || '', 'fr', { numeric: true, sensitivity: 'base' });
      if (itemSort === 'type') return (TYPE_LABELS[a.media_type] || a.media_type).localeCompare(TYPE_LABELS[b.media_type] || b.media_type, 'fr');
      const aWatched = mediaStatuses[getMediaKey({ id: a.media_id, type: a.media_type })] === 'vu' ? 1 : 0;
      const bWatched = mediaStatuses[getMediaKey({ id: b.media_id, type: b.media_type })] === 'vu' ? 1 : 0;
      return bWatched - aWatched || (a.media_data?.title || '').localeCompare(b.media_data?.title || '', 'fr');
    });
  }, [items, itemSearchQuery, itemSort, itemStatusFilter, itemTypeFilter, mediaStatuses]);

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

    const { data, error } = await fetchAllPages<any>((from, to) =>
      supabase
        .from('media_progress')
        .select('media_id, media_type, media_data').in('media_type', ['movie', 'tv', 'drama', 'anime'])
        .eq('user_id', user.id)
        .order('media_id', { ascending: true })
        .range(from, to)
    );

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
    setErrorMessage('');

    try {
      const temporaryOffset = Math.max(10000, orderedItems.length * 10 + 1000);

      const temporaryResults = await Promise.all(
        orderedItems.map((item, index) =>
          supabase
            .from('custom_list_items')
            .update({ position: temporaryOffset + index })
            .eq('id', item.id)
            .eq('list_id', listId)
        )
      );

      const temporaryError = temporaryResults.find((result) => result.error)?.error;
      if (temporaryError) throw temporaryError;

      const finalResults = await Promise.all(
        orderedItems.map((item, index) =>
          supabase
            .from('custom_list_items')
            .update({ position: index })
            .eq('id', item.id)
            .eq('list_id', listId)
        )
      );

      const finalError = finalResults.find((result) => result.error)?.error;
      if (finalError) throw finalError;

      currentItemsRef.current = orderedItems;
    } catch (error) {
      console.error(error);
      setItems(fallbackItems);
      currentItemsRef.current = fallbackItems;
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

  const stopAutoScroll = () => {
    if (autoScrollFrameRef.current !== null) {
      window.cancelAnimationFrame(autoScrollFrameRef.current);
      autoScrollFrameRef.current = null;
    }
  };

  const updatePointerReorder = (clientX: number, clientY: number) => {
    const itemId = pointerDraggedItemIdRef.current;
    if (!itemId) return;

    const target = document.elementFromPoint(clientX, clientY) as HTMLElement | null;
    const targetItem = target?.closest<HTMLElement>('[data-list-item-id]');
    const targetId = targetItem?.dataset.listItemId;
    if (!targetId || targetId === itemId) return;

    setItems((current) => {
      const reordered = reorderItems(current, itemId, targetId);
      currentItemsRef.current = reordered;
      return reordered;
    });
  };

  const runAutoScroll = () => {
    stopAutoScroll();

    const tick = () => {
      if (!pointerDraggedItemIdRef.current || !pointerMovedRef.current) {
        autoScrollFrameRef.current = null;
        return;
      }

      const pointer = pointerLastPositionRef.current;
      if (!pointer) {
        autoScrollFrameRef.current = window.requestAnimationFrame(tick);
        return;
      }

      const edge = 90;
      const maxSpeed = 18;
      let speed = 0;
      if (pointer.y < edge) {
        speed = -maxSpeed * (1 - pointer.y / edge);
      } else if (pointer.y > window.innerHeight - edge) {
        speed = maxSpeed * (1 - (window.innerHeight - pointer.y) / edge);
      }

      if (Math.abs(speed) > 0.5) {
        window.scrollBy(0, speed);
        updatePointerReorder(pointer.x, pointer.y);
      }

      autoScrollFrameRef.current = window.requestAnimationFrame(tick);
    };

    autoScrollFrameRef.current = window.requestAnimationFrame(tick);
  };

  const cleanupPointerDrag = () => {
    stopAutoScroll();
    pointerDraggedItemIdRef.current = null;
    pointerStartRef.current = null;
    pointerLastPositionRef.current = null;
    pointerMovedRef.current = false;
    pointerIdRef.current = null;
    setDraggedItemId(null);
  };

  const finishPointerDrag = async () => {
    const itemId = pointerDraggedItemIdRef.current;
    if (!itemId) return;

    const moved = pointerMovedRef.current;
    const fallback = dragStartItemsRef.current;
    const finalItems = currentItemsRef.current.map((item, index) => ({ ...item, position: index }));

    cleanupPointerDrag();

    if (!moved) return;

    suppressOpenRef.current = true;
    window.setTimeout(() => { suppressOpenRef.current = false; }, 350);
    setItems(finalItems);
    currentItemsRef.current = finalItems;

    if (finalItems.some((item, index) => fallback[index]?.id !== item.id)) {
      await saveOrder(finalItems, fallback);
    }
  };

  const cancelPointerDrag = () => {
    const fallback = dragStartItemsRef.current;
    cleanupPointerDrag();
    if (fallback.length) {
      setItems(fallback);
      currentItemsRef.current = fallback;
    }
  };

  const handlePointerDown = (itemId: string, event: React.PointerEvent<HTMLElement>) => {
    if (!isTouchDevice || event.pointerType === 'mouse' || savingOrder) return;

    event.preventDefault();
    dragStartItemsRef.current = currentItemsRef.current.map((item) => ({ ...item }));
    pointerDraggedItemIdRef.current = itemId;
    pointerIdRef.current = event.pointerId;
    pointerStartRef.current = { x: event.clientX, y: event.clientY };
    pointerLastPositionRef.current = { x: event.clientX, y: event.clientY };
    pointerMovedRef.current = false;

    const onMove = (pointerEvent: PointerEvent) => {
      if (pointerEvent.pointerId !== pointerIdRef.current || !pointerDraggedItemIdRef.current) return;
      pointerLastPositionRef.current = { x: pointerEvent.clientX, y: pointerEvent.clientY };

      const start = pointerStartRef.current;
      if (!start) return;
      const distance = Math.hypot(pointerEvent.clientX - start.x, pointerEvent.clientY - start.y);
      if (!pointerMovedRef.current && distance < 7) return;

      if (!pointerMovedRef.current) {
        pointerMovedRef.current = true;
        setDraggedItemId(itemId);
        runAutoScroll();
      }

      pointerEvent.preventDefault();
      updatePointerReorder(pointerEvent.clientX, pointerEvent.clientY);
    };

    const removeListeners = () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', onCancel);
    };

    const onUp = (pointerEvent: PointerEvent) => {
      if (pointerEvent.pointerId !== pointerIdRef.current) return;
      removeListeners();
      void finishPointerDrag();
    };

    const onCancel = (pointerEvent: PointerEvent) => {
      if (pointerEvent.pointerId !== pointerIdRef.current) return;
      removeListeners();
      cancelPointerDrag();
    };

    window.addEventListener('pointermove', onMove, { passive: false });
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onCancel);
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
      if (newStatus === 'vu') {
        await supabase.from('watch_history').insert({
          user_id: user.id,
          media_id: item.media_id,
          media_type: item.media_type,
          media_data: item.media_data,
          watched_at: new Date().toISOString(),
        });
      }
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

  const shareList = async () => {
    if (!list || sharingList) return;
    setSharingList(true);
    setErrorMessage('');
    try {
      const token = list.share_token || crypto.randomUUID();
      const { error } = await supabase
        .from('custom_lists')
        .update({ is_shared: true, share_token: token })
        .eq('id', listId)
        .eq('user_id', list.user_id);
      if (error) throw error;
      const url = `${window.location.origin}/shared-list/${token}`;
      setList({ ...list, is_shared: true, share_token: token });

      // Sur téléphone, on ouvre la feuille de partage native (Messages,
      // WhatsApp, Mail…). Sur ordinateur ou si elle n'est pas disponible,
      // on copie le lien dans le presse-papiers avec un repli compatible iOS.
      if (typeof navigator.share === 'function') {
        try {
          await navigator.share({
            title: list.name,
            text: `Je te partage ma liste « ${list.name} » sur STELDRA.`,
            url,
          });
          return;
        } catch (shareError: any) {
          // Annuler la feuille de partage n'est pas une erreur à afficher.
          if (shareError?.name === 'AbortError') return;
        }
      }

      try {
        await navigator.clipboard.writeText(url);
      } catch {
        const textarea = document.createElement('textarea');
        textarea.value = url;
        textarea.setAttribute('readonly', '');
        textarea.style.position = 'fixed';
        textarea.style.opacity = '0';
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand('copy');
        document.body.removeChild(textarea);
      }

      window.alert('Lien de partage copié. Ton amie pourra ouvrir la liste sur son téléphone ou son ordinateur et l’ajouter à son compte.');
    } catch (error) {
      console.error(error);
      setErrorMessage('Impossible de créer le lien de partage. Vérifiez que la migration SQL a bien été appliquée.');
    } finally {
      setSharingList(false);
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
      <main data-steldra-ui="page" className={styles.page}>
        <Link href="/lists" data-steldra-ui="backLink" className={styles.backLink}>← Retour à mes listes</Link>

        {loading ? (
          <p>Chargement de la liste…</p>
        ) : errorMessage && !list ? (
          <p data-steldra-ui="error" className={styles.error}>{errorMessage}</p>
        ) : list ? (
          <>
            <header data-steldra-ui="header" className={styles.header}>
              <div data-steldra-ui="headerTop" className={styles.headerTop}>
                <div data-steldra-ui="headerContent" className={styles.headerContent}>
                  <p data-steldra-ui="eyebrow" className={styles.eyebrow}>Liste personnalisée</p>

                  {isEditingMeta ? (
                    <div data-steldra-ui="editMeta" className={styles.editMeta}>
                      <input
                        data-steldra-ui="titleInput" className={styles.titleInput}
                        value={editedTitle}
                        onChange={(event) => setEditedTitle(event.target.value)}
                        maxLength={80}
                        autoFocus
                      />
                      <textarea
                        data-steldra-ui="descriptionInput" className={styles.descriptionInput}
                        value={editedDescription}
                        onChange={(event) => setEditedDescription(event.target.value)}
                        maxLength={250}
                        rows={2}
                        placeholder="Description de la liste…"
                      />
                      <div data-steldra-ui="editActions" className={styles.editActions}>
                        <button type="button" onClick={() => void saveListMeta()} disabled={savingMeta}>
                          {savingMeta ? 'Enregistrement…' : '✓ Enregistrer'}
                        </button>
                        <button type="button" data-steldra-ui="secondaryButton" className={styles.secondaryButton} onClick={() => {
                          setEditedTitle(list.name);
                          setEditedDescription(list.description || '');
                          setIsEditingMeta(false);
                        }}>Annuler</button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <div data-steldra-ui="titleRow" className={styles.titleRow}>
                        <h1>{list.name}</h1>
                        <button type="button" data-steldra-ui="iconButton" className={styles.iconButton} onClick={() => setIsEditingMeta(true)} title="Modifier le nom et la description">✎</button>
                        <span data-steldra-ui="countInline" className={styles.countInline}>{items.length} {items.length > 1 ? 'médias' : 'média'}</span>
                      </div>
                      <p data-steldra-ui="description" className={styles.description}>{list.description || 'Liste organisée dans votre ordre personnalisé.'}</p>
                    </>
                  )}
                </div>

                <div data-steldra-ui="listActions" className={styles.listActions}>
                  <button type="button" data-steldra-ui="secondaryButton" className={styles.secondaryButton} onClick={() => void shareList()} disabled={sharingList}>
                    {sharingList ? 'Partage…' : 'Partager'}
                  </button>
                  <button type="button" data-steldra-ui="secondaryButton" className={styles.secondaryButton} onClick={() => void duplicateList()} disabled={duplicatingList}>
                    {duplicatingList ? 'Copie…' : '⧉ Dupliquer'}
                  </button>
                  <button type="button" data-steldra-ui="dangerButton" className={styles.dangerButton} onClick={() => void deleteList()} disabled={deletingList}>
                    {deletingList ? 'Suppression…' : 'Supprimer la liste'}
                  </button>
                </div>
              </div>

              {items.length > 0 && (
                <div data-steldra-ui="progressBlock" className={styles.progressBlock}>
                  <div data-steldra-ui="progressText" className={styles.progressText}>
                    <span>{watchedCount} / {items.length} vus</span>
                    <strong>{progressPercent} %</strong>
                  </div>
                  <div data-steldra-ui="progressTrack" className={styles.progressTrack}><div data-steldra-ui="progressFill" className={styles.progressFill} style={{ width: `${progressPercent}%` }} /></div>
                </div>
              )}
            </header>

            {errorMessage && <p data-steldra-ui="error" className={styles.error}>{errorMessage}</p>}

            {nextItem && (
              <section data-steldra-ui="nextCard" className={styles.nextCard}>
                <img src={getPosterUrl(nextItem.media_data)} alt={nextItem.media_data.title} onError={(event) => usePosterFallback(event.currentTarget)} />
                <div>
                  <p data-steldra-ui="eyebrow" className={styles.eyebrow}>À regarder ensuite</p>
                  <h2>{nextItem.media_data.title}</h2>
                  <span>{TYPE_LABELS[nextItem.media_type] || nextItem.media_type}</span>
                </div>
                <button type="button" onClick={() => openMedia(nextItem)}>Voir la fiche →</button>
              </section>
            )}

            {items.length === 0 ? (
              <section data-steldra-ui="empty" className={styles.empty}>
                <button type="button" data-steldra-ui="addMediaButton" className={styles.addMediaButton} onClick={openMediaPicker}>＋ Ajouter des médias</button>
                <h2>Cette liste est encore vide</h2>
                <p>Ajoutez films, séries, dramas ou animés depuis votre collection.</p>
              </section>
            ) : (
              <>
                <div data-steldra-ui="listToolbar" className={styles.listToolbar}>
                  <div data-steldra-ui="listControls" className={styles.listControls}>
                    <input
                      data-steldra-ui="listSearch" className={styles.listSearch}
                      type="search"
                      value={itemSearchQuery}
                      onChange={(event) => setItemSearchQuery(event.target.value)}
                      placeholder={`Rechercher parmi ${items.length} médias…`}
                      aria-label="Rechercher dans cette liste"
                    />
                    <select data-steldra-ui="listSelect" className={styles.listSelect} value={itemSort} onChange={(event) => setItemSort(event.target.value as typeof itemSort)} aria-label="Trier la liste">
                      <option value="manual">Ordre personnalisé</option>
                      <option value="title">Titre A → Z</option>
                      <option value="type">Type de média</option>
                      <option value="status">Vus en premier</option>
                    </select>
                    <select data-steldra-ui="listSelect" className={styles.listSelect} value={itemStatusFilter} onChange={(event) => setItemStatusFilter(event.target.value as typeof itemStatusFilter)} aria-label="Filtrer par statut">
                      <option value="all">Tous les statuts</option>
                      <option value="vu">Vus</option>
                      <option value="a_voir">À voir</option>
                    </select>
                    <select data-steldra-ui="listSelect" className={styles.listSelect} value={itemTypeFilter} onChange={(event) => setItemTypeFilter(event.target.value)} aria-label="Filtrer par type">
                      <option value="all">Tous les types</option>
                      {Object.entries(TYPE_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                    </select>
                  </div>
                  <p data-steldra-ui="dragHint" className={styles.dragHint}>{itemSort === 'manual' ? <>↕ {isTouchDevice ? 'Glissez ⠿ pour déplacer · approchez du bord pour faire défiler' : 'Glissez les affiches pour modifier l’ordre'} {savingOrder && <span data-steldra-ui="savingLabel" className={styles.savingLabel}>Enregistrement…</span>}</> : 'Le déplacement manuel est disponible avec « Ordre personnalisé ».'}</p>
                  <button type="button" data-steldra-ui="addMediaButton" className={styles.addMediaButton} onClick={openMediaPicker}>＋ Ajouter plusieurs médias</button>
                </div>

                <section data-steldra-ui="items" className={styles.items}>
                  {displayedItems.map((item) => {
                    const index = items.findIndex((entry) => entry.id === item.id);
                    const key = getMediaKey({ id: item.media_id, type: item.media_type });
                    const watched = mediaStatuses[key] === 'vu';
                    return (
                      <article
                        key={item.id}
                        data-list-item-id={item.id}
                        data-steldra-ui="item itemDragging" className={`${styles.item} ${draggedItemId === item.id ? styles.itemDragging : ''}`}
                        draggable={itemSort === 'manual' && !savingOrder && !isTouchDevice}
                        onDragStart={(event) => { if (itemSort === 'manual') handleDragStart(item.id, event); }}
                        onDragOver={(event) => { if (itemSort === 'manual') handleDragOver(item.id, event); }}
                        onDragEnd={() => void handleDragEnd()}
                      >
                        <div data-steldra-ui="posterWrapper" className={styles.posterWrapper} onDoubleClick={() => openMedia(item)}>
                          <img src={getPosterUrl(item.media_data, 'w342')} onError={(event) => usePosterFallback(event.currentTarget)} alt={item.media_data.title} data-steldra-ui="poster" className={styles.poster} draggable={false} />
                          <span data-steldra-ui="position" className={styles.position}>{itemSort === 'manual' ? index + 1 : displayedItems.findIndex((entry) => entry.id === item.id) + 1}</span>
                          <button
                            type="button"
                            data-steldra-ui="watchedButton watchedButtonActive" className={`${styles.watchedButton} ${watched ? styles.watchedButtonActive : ''}`}
                            onMouseDown={(event) => event.stopPropagation()}
                            onClick={(event) => { event.stopPropagation(); void toggleWatched(item); }}
                            disabled={updatingStatusKey === key}
                            title={watched ? 'Marquer à voir' : 'Marquer comme vu'}
                          >{watched ? '✓ Vu' : '○'}</button>
                          <button
                            type="button"
                            data-steldra-ui="deleteButton" className={styles.deleteButton}
                            onMouseDown={(event) => event.stopPropagation()}
                            onClick={(event) => { event.stopPropagation(); void removeItem(item); }}
                            disabled={deletingItemId === item.id}
                            title="Retirer de la liste"
                          >{deletingItemId === item.id ? '…' : '×'}</button>
                          <span
                            data-steldra-ui="dragHandle" className={styles.dragHandle}
                            role="button"
                            aria-label={`Déplacer ${item.media_data.title}`}
                            title="Maintenir et glisser pour déplacer"
                            onPointerDown={(event) => { if (itemSort === 'manual') handlePointerDown(item.id, event); }}
                          >⠿</span>
                        </div>

                        <div data-steldra-ui="itemContent" className={styles.itemContent}>
                          <button type="button" data-steldra-ui="mediaTitleButton" className={styles.mediaTitleButton} onClick={() => openMedia(item)} title={item.media_data.title}>{item.media_data.title}</button>
                          <p>{TYPE_LABELS[item.media_type] || item.media_type}</p>
                          <div data-steldra-ui="mobileMoveButtons" className={styles.mobileMoveButtons}>
                            <button type="button" onClick={() => void moveItem(item.id, -1)} disabled={itemSort !== 'manual' || index === 0 || savingOrder}>←</button>
                            <button type="button" onClick={() => void moveItem(item.id, 1)} disabled={itemSort !== 'manual' || index === items.length - 1 || savingOrder}>→</button>
                          </div>
                        </div>
                      </article>
                    );
                  })}
                </section>
              </>
            )}

            {showPicker && (
              <div data-steldra-ui="pickerOverlay" className={styles.pickerOverlay} onMouseDown={(event) => { if (event.target === event.currentTarget) closeMediaPicker(); }}>
                <section data-steldra-ui="picker" className={styles.picker} role="dialog" aria-modal="true" aria-labelledby="media-picker-title">
                  <div data-steldra-ui="pickerHeader" className={styles.pickerHeader}>
                    <div><p data-steldra-ui="eyebrow" className={styles.eyebrow}>Ajouter à la liste</p><h2 id="media-picker-title">{list.name}</h2></div>
                    <button type="button" data-steldra-ui="closeButton" className={styles.closeButton} onClick={closeMediaPicker}>×</button>
                  </div>
                  <input type="search" value={searchQuery} onChange={(event) => setSearchQuery(event.target.value)} data-steldra-ui="pickerSearch" className={styles.pickerSearch} placeholder="Rechercher dans ma collection…" />

                  {loadingCollection ? <p data-steldra-ui="pickerMessage" className={styles.pickerMessage}>Chargement de la collection…</p> : filteredCollection.length === 0 ? <p data-steldra-ui="pickerMessage" className={styles.pickerMessage}>Aucun média disponible.</p> : (
                    <div data-steldra-ui="mediaGrid" className={styles.mediaGrid}>
                      {filteredCollection.map((media) => {
                        const key = getMediaKey(media);
                        const selected = selectedMediaKeys.includes(key);
                        return (
                          <button type="button" key={key} data-steldra-ui="mediaChoice mediaChoiceSelected" className={`${styles.mediaChoice} ${selected ? styles.mediaChoiceSelected : ''}`} onClick={() => toggleMediaSelection(key)}>
                            <div data-steldra-ui="mediaPosterWrapper" className={styles.mediaPosterWrapper}>
                              <img src={getPosterUrl(media, 'w342')} onError={(event) => usePosterFallback(event.currentTarget)} alt={media.title} data-steldra-ui="mediaChoicePoster" className={styles.mediaChoicePoster} />
                              {selected && <span data-steldra-ui="selectedMark" className={styles.selectedMark}>✓</span>}
                            </div>
                            <strong>{media.title}</strong>
                            <span>{TYPE_LABELS[media.type] || media.type}</span>
                          </button>
                        );
                      })}
                    </div>
                  )}

                  <div data-steldra-ui="pickerFooter" className={styles.pickerFooter}>
                    <span>{selectedMediaKeys.length} sélectionné{selectedMediaKeys.length > 1 ? 's' : ''}</span>
                    <button type="button" data-steldra-ui="confirmButton" className={styles.confirmButton} disabled={!selectedMediaKeys.length || addingItems} onClick={() => void addSelectedMedia()}>
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
