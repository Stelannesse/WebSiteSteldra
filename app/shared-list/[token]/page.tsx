/**
 * Rôle du fichier : Page publique d'une liste partagée : charge son contenu à partir du jeton présent dans l'URL.
 */

'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import MainNav from '../../components/mainNav';
import { createClient } from '../../lib/supabase';
import { fetchAllPages } from '../../lib/supabasePaging';
import { getPosterUrl, usePosterFallback } from '../../lib/poster';
import type { CustomList, CustomListItem } from '../../types/media';
import styles from '../../lists/[id]/listDetails.module.css';

/** Composant principal de cette page ou zone d'interface. */
export default function SharedListPage() {
  const { token } = useParams<{ token: string }>();
  const router = useRouter();
  const [supabase] = useState(() => createClient());
  const [list, setList] = useState<CustomList | null>(null);
  const [items, setItems] = useState<CustomListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [importing, setImporting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      const { data: listData, error: listError } = await supabase
        .from('custom_lists')
        .select('*')
        .eq('share_token', token)
        .eq('is_shared', true)
        .single();

      if (listError || !listData) {
        if (!cancelled) {
          setError('Ce lien de partage est invalide ou la liste n’est plus partagée.');
          setLoading(false);
        }
        return;
      }

      const { data: itemData, error: itemError } = await fetchAllPages<CustomListItem>((from, to) =>
        supabase
          .from('custom_list_items')
          .select('*').in('media_type', ['movie', 'tv', 'drama', 'anime'])
          .eq('list_id', listData.id)
          .order('position', { ascending: true })
          .range(from, to)
      );

      if (!cancelled) {
        setList(listData as CustomList);
        setItems(itemError ? [] : itemData);
        setLoading(false);
      }
    };
    void load();
    return () => { cancelled = true; };
  }, [supabase, token]);

  const importList = async () => {
    if (!list || importing) return;
    setImporting(true);
    setError('');
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        sessionStorage.setItem('steldra_after_login', `/shared-list/${token}`);
        router.push('/login');
        return;
      }

      const { data: newList, error: listError } = await supabase
        .from('custom_lists')
        .insert({
          user_id: user.id,
          name: list.name,
          description: list.description,
          is_ordered: list.is_ordered,
          is_shared: false,
          share_token: null,
        })
        .select('*')
        .single();
      if (listError || !newList) throw listError || new Error('Liste non créée');

      if (items.length) {
        const chunkSize = 250;
        for (let start = 0; start < items.length; start += chunkSize) {
          const chunk = items.slice(start, start + chunkSize).map((item, index) => ({
            list_id: newList.id,
            media_id: item.media_id,
            media_type: item.media_type,
            media_data: item.media_data,
            position: start + index,
          }));
          const { error: itemsError } = await supabase.from('custom_list_items').insert(chunk);
          if (itemsError) throw itemsError;
        }
      }

      router.push(`/lists/${newList.id}`);
    } catch (caught) {
      console.error(caught);
      setError('Impossible d’ajouter cette liste à votre compte.');
      setImporting(false);
    }
  };

  return (
    <>
      <MainNav />
      <main data-steldra-ui="page" className={styles.page}>
        <Link href="/lists" data-steldra-ui="backLink" className={styles.backLink}>← Mes listes</Link>
        {loading ? <p>Chargement…</p> : error && !list ? <p data-steldra-ui="error" className={styles.error}>{error}</p> : list ? (
          <>
            <header data-steldra-ui="header" className={styles.header}>
              <div data-steldra-ui="headerTop" className={styles.headerTop}>
                <div data-steldra-ui="headerContent" className={styles.headerContent}>
                  <p data-steldra-ui="eyebrow" className={styles.eyebrow}>Liste partagée</p>
                  <div data-steldra-ui="titleRow" className={styles.titleRow}>
                    <h1>{list.name}</h1>
                    <span data-steldra-ui="countInline" className={styles.countInline}>{items.length} média{items.length > 1 ? 's' : ''}</span>
                  </div>
                  <p data-steldra-ui="description" className={styles.description}>{list.description || 'Liste partagée sur STELDRA.'}</p>
                </div>
                <div data-steldra-ui="listActions" className={styles.listActions}>
                  <button type="button" data-steldra-ui="addMediaButton" className={styles.addMediaButton} disabled={importing} onClick={() => void importList()}>
                    {importing ? 'Ajout…' : '＋ Ajouter à mes listes'}
                  </button>
                </div>
              </div>
            </header>
            {error && <p data-steldra-ui="error" className={styles.error}>{error}</p>}
            <section data-steldra-ui="items" className={styles.items}>
              {items.map((item, index) => (
                <article key={item.id} data-steldra-ui="item" className={styles.item}>
                  <div data-steldra-ui="posterWrapper" className={styles.posterWrapper}>
                    <img src={getPosterUrl(item.media_data, 'w342')} alt={item.media_data.title} data-steldra-ui="poster" className={styles.poster} onError={(event) => usePosterFallback(event.currentTarget)} />
                    <span data-steldra-ui="position" className={styles.position}>{index + 1}</span>
                  </div>
                  <div data-steldra-ui="itemContent" className={styles.itemContent}>
                    <strong>{item.media_data.title}</strong>
                    <p>{item.media_type}</p>
                  </div>
                </article>
              ))}
            </section>
          </>
        ) : null}
      </main>
    </>
  );
}
