'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { createClient } from '../lib/supabase';
import MainNav from '../components/mainNav';
import type { CustomList, CustomListItem } from '../types/media';
import styles from './lists.module.css';

type ListWithPreview = CustomList & {
  previewItems: CustomListItem[];
  itemCount: number;
};

const posterUrl = (item?: CustomListItem) => {
  const path = item?.media_data?.poster_path;
  if (!path) return '';
  if (path.startsWith('http')) return path;
  return `https://image.tmdb.org/t/p/w300${path}`;
};

export default function ListsPage() {
  const [supabase] = useState(() => createClient());
  const [lists, setLists] = useState<ListWithPreview[]>([]);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    const loadLists = async () => {
      setLoading(true);
      setErrorMessage('');

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setErrorMessage('Vous devez être connecté pour accéder à vos listes.');
        setLoading(false);
        return;
      }

      const { data: listData, error: listError } = await supabase
        .from('custom_lists')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (listError) {
        setErrorMessage('Impossible de charger les listes.');
        setLoading(false);
        return;
      }

      const baseLists = (listData || []) as CustomList[];
      if (!baseLists.length) {
        setLists([]);
        setLoading(false);
        return;
      }

      const ids = baseLists.map((list) => list.id);
      const { data: itemData, error: itemError } = await supabase
        .from('custom_list_items')
        .select('*')
        .in('list_id', ids)
        .order('position', { ascending: true });

      if (itemError) console.error('Erreur aperçus des listes :', itemError);

      const grouped = new Map<string, CustomListItem[]>();
      ((itemData || []) as CustomListItem[]).forEach((item) => {
        const current = grouped.get(item.list_id) || [];
        current.push(item);
        grouped.set(item.list_id, current);
      });

      setLists(
        baseLists.map((list) => {
          const items = grouped.get(list.id) || [];
          return {
            ...list,
            previewItems: items.slice(0, 4),
            itemCount: items.length,
          };
        })
      );
      setLoading(false);
    };

    void loadLists();
  }, [supabase]);

  const createList = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const trimmedName = name.trim();
    if (!trimmedName) {
      setErrorMessage('Donnez un nom à votre liste.');
      return;
    }

    setCreating(true);
    setErrorMessage('');
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      setCreating(false);
      return;
    }

    const { data, error } = await supabase.from('custom_lists').insert({
      user_id: user.id,
      name: trimmedName,
      description: description.trim() || null,
      is_ordered: true,
    }).select().single();

    if (error || !data) {
      setErrorMessage('La liste n’a pas pu être créée.');
      setCreating(false);
      return;
    }

    setLists((current) => [{ ...data, previewItems: [], itemCount: 0 }, ...current]);
    setName('');
    setDescription('');
    setShowForm(false);
    setCreating(false);
  };

  return (
    <>
      <MainNav />
      <main className={styles.page}>
        <div className={styles.heading}>
          <div>
            <p className={styles.eyebrow}>Organisation</p>
            <h1>Mes listes</h1>
            <p>Créez vos propres ordres de visionnage : Marvel, Disney, Star Wars, Fast & Furious…</p>
          </div>
          <button type="button" className={styles.createButton} onClick={() => setShowForm((current) => !current)}>
            {showForm ? 'Annuler' : '+ Créer une liste'}
          </button>
        </div>

        {showForm && (
          <form className={styles.form} onSubmit={createList}>
            <label>Nom de la liste
              <input type="text" value={name} onChange={(event) => setName(event.target.value)} placeholder="Ex. Marvel" maxLength={80} />
            </label>
            <label>Description
              <textarea value={description} onChange={(event) => setDescription(event.target.value)} placeholder="Ex. MCU dans l’ordre chronologique" maxLength={250} rows={3} />
            </label>
            <button type="submit" disabled={creating}>{creating ? 'Création…' : 'Créer la liste'}</button>
          </form>
        )}

        {errorMessage && <p className={styles.error}>{errorMessage}</p>}

        {loading ? (
          <p className={styles.message}>Chargement des listes…</p>
        ) : lists.length === 0 ? (
          <section className={styles.empty}>
            <span>☰</span><h2>Aucune liste pour le moment</h2>
            <p>Créez votre première liste pour organiser vos médias dans l’ordre de votre choix.</p>
            <button type="button" onClick={() => setShowForm(true)}>Créer ma première liste</button>
          </section>
        ) : (
          <section className={styles.grid}>
            {lists.map((list) => (
              <Link href={`/lists/${list.id}`} className={styles.card} key={list.id}>
                <div className={styles.cover}>
                  {list.previewItems.length ? (
                    <div className={styles.coverGrid}>
                      {Array.from({ length: 4 }).map((_, index) => {
                        const item = list.previewItems[index % list.previewItems.length];
                        const src = posterUrl(item);
                        return src ? <img key={`${item?.id}-${index}`} src={src} alt="" /> : <div key={index} className={styles.coverFallback} />;
                      })}
                    </div>
                  ) : (
                    <div className={styles.emptyCover}>{list.name.charAt(0).toUpperCase()}</div>
                  )}
                  <div className={styles.coverShade} />
                  <div className={styles.coverText}>
                    <h2>{list.name}</h2>
                    <p>{list.description || 'Liste personnalisée ordonnée'}</p>
                    <span>{list.itemCount} {list.itemCount > 1 ? 'médias' : 'média'}</span>
                  </div>
                </div>
              </Link>
            ))}
          </section>
        )}
      </main>
    </>
  );
}
