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
          .select('*')
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
      <main className={styles.page}>
        <Link href="/lists" className={styles.backLink}>← Mes listes</Link>
        {loading ? <p>Chargement…</p> : error && !list ? <p className={styles.error}>{error}</p> : list ? (
          <>
            <header className={styles.header}>
              <div className={styles.headerTop}>
                <div className={styles.headerContent}>
                  <p className={styles.eyebrow}>Liste partagée</p>
                  <div className={styles.titleRow}>
                    <h1>{list.name}</h1>
                    <span className={styles.countInline}>{items.length} média{items.length > 1 ? 's' : ''}</span>
                  </div>
                  <p className={styles.description}>{list.description || 'Liste partagée sur STELDRA.'}</p>
                </div>
                <div className={styles.listActions}>
                  <button type="button" className={styles.addMediaButton} disabled={importing} onClick={() => void importList()}>
                    {importing ? 'Ajout…' : '＋ Ajouter à mes listes'}
                  </button>
                </div>
              </div>
            </header>
            {error && <p className={styles.error}>{error}</p>}
            <section className={styles.items}>
              {items.map((item, index) => (
                <article key={item.id} className={styles.item}>
                  <div className={styles.posterWrapper}>
                    <img src={getPosterUrl(item.media_data, 'w342')} alt={item.media_data.title} className={styles.poster} onError={(event) => usePosterFallback(event.currentTarget)} />
                    <span className={styles.position}>{index + 1}</span>
                  </div>
                  <div className={styles.itemContent}>
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
