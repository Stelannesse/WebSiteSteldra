/**
 * Rôle du fichier : Page Listes : crée, affiche et gère les listes personnalisées de l'utilisateur.
 */

'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { readUser } from '../lib/browserData';
import { createClient } from '../lib/supabase';
import MainNav from '../components/mainNav';
import type { CustomList, CustomListItem } from '../types/media';
import styles from './lists.module.css';
import { fetchAllPages } from '../lib/supabasePaging';

type ListWithPreview = CustomList & {
  previewItems: CustomListItem[];
  itemCount: number;
};

type SortMode = 'recent' | 'name' | 'count';

/** Retourne l'URL d'affiche adaptée au contexte d'affichage. */
const posterUrl = (item?: CustomListItem) => {
  const path = item?.media_data?.poster_path;
  if (!path) return '';
  if (path.startsWith('http')) return path;
  return `https://image.tmdb.org/t/p/w300${path}`;
};

/** Transforme une date technique en libellé lisible. */
const formatDate = (value?: string | null) => {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return new Intl.DateTimeFormat('fr-FR', { day: '2-digit', month: 'short' }).format(date);
};

/** Composant principal de cette page ou zone d'interface. */
export default function ListsPage() {
  const [supabase] = useState(() => createClient());
  const [lists, setLists] = useState<ListWithPreview[]>([]);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadingPreviews, setLoadingPreviews] = useState(true);
  const [creating, setCreating] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [query, setQuery] = useState('');
  const [sortMode, setSortMode] = useState<SortMode>('recent');

  useEffect(() => {
    const loadLists = async () => {
      setLoading(true);
      setErrorMessage('');

      const { data: { user } } = await readUser(supabase);
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

      setLists(baseLists.map((list) => ({ ...list, previewItems: [], itemCount: 0 })));
      setLoading(false);
      const ids = baseLists.map((list) => list.id);
      const { data: itemData, error: itemError } = await fetchAllPages<CustomListItem>((from, to) =>
        supabase
          .from('custom_list_items')
          .select('*').in('media_type', ['movie', 'tv', 'drama', 'anime'])
          .in('list_id', ids)
          .order('position', { ascending: true })
          .range(from, to)
      );

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
      setLoadingPreviews(false);
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

  const filteredLists = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase('fr');
    const next = lists.filter((list) => {
      if (!normalized) return true;
      return `${list.name} ${list.description || ''}`.toLocaleLowerCase('fr').includes(normalized);
    });

    return [...next].sort((a, b) => {
      if (sortMode === 'name') return a.name.localeCompare(b.name, 'fr', { sensitivity: 'base' });
      if (sortMode === 'count') return b.itemCount - a.itemCount || a.name.localeCompare(b.name, 'fr');
      const aDate = new Date(a.updated_at || a.created_at).getTime() || 0;
      const bDate = new Date(b.updated_at || b.created_at).getTime() || 0;
      return bDate - aDate;
    });
  }, [lists, query, sortMode]);

  const featuredLists = useMemo(
    () => [...lists].sort((a, b) => b.itemCount - a.itemCount).slice(0, 5),
    [lists]
  );

  const totalTitles = useMemo(() => lists.reduce((sum, list) => sum + list.itemCount, 0), [lists]);
  const sharedLists = useMemo(() => lists.filter((list) => Boolean(list.is_shared)).length, [lists]);
  const recentLists = useMemo(
    () => [...lists]
      .sort((a, b) => (new Date(b.updated_at || b.created_at).getTime() || 0) - (new Date(a.updated_at || a.created_at).getTime() || 0))
      .slice(0, 3),
    [lists]
  );

  const renderPreview = (list: ListWithPreview, compact = false) => (
    <div className={compact ? styles.compactPreview : styles.coverGrid}>
      {list.previewItems.length ? (
        Array.from({ length: compact ? 3 : 4 }).map((_, index) => {
          const item = list.previewItems[index % list.previewItems.length];
          const src = posterUrl(item);
          return src ? <img key={`${item?.id}-${index}`} src={src} alt="" loading="lazy" decoding="async" /> : <div key={index} data-steldra-ui="coverFallback" className={styles.coverFallback} />;
        })
      ) : (
        <div data-steldra-ui="emptyPreview" className={styles.emptyPreview}>{list.name.charAt(0).toUpperCase()}</div>
      )}
    </div>
  );

  return (
    <>
      <MainNav />
      <main data-steldra-ui="page" className={styles.page}>
        <section data-steldra-ui="hero" className={styles.hero}>
          <div data-steldra-ui="heroShade" className={styles.heroShade} />
          <div data-steldra-ui="heroContent" className={styles.heroContent}>
            <span>VOTRE UNIVERS</span>
            <h1>Mes listes</h1>
            <p data-steldra-ui="heroTagline" className={styles.heroTagline}>Créez et organisez vos listes facilement.</p>
          </div>
        </section>

        <section data-steldra-ui="controlBar" className={styles.controlBar}>
          <label data-steldra-ui="searchBox" className={styles.searchBox}>
            <span>⌕</span>
            <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Rechercher dans mes listes…" />
          </label>
          <label data-steldra-ui="sortBox" className={styles.sortBox}>
            <span>Trier par</span>
            <select value={sortMode} onChange={(event) => setSortMode(event.target.value as SortMode)}>
              <option value="recent">Dernière activité</option>
              <option value="name">Nom A–Z</option>
              <option value="count">Nombre de médias</option>
            </select>
          </label>
          <button type="button" data-steldra-ui="createButton" className={styles.createButton} onClick={() => setShowForm((current) => !current)}>
            {showForm ? 'Annuler' : '+ Créer une liste'}
          </button>
        </section>

        {showForm && (
          <form data-steldra-ui="form" className={styles.form} onSubmit={createList}>
            <div data-steldra-ui="formHeading" className={styles.formHeading}>
              <div><span>NOUVELLE LISTE</span><h2>Créez votre prochain univers</h2></div>
              <button type="button" data-steldra-ui="formClose" className={styles.formClose} onClick={() => setShowForm(false)}>×</button>
            </div>
            <label>Nom de la liste
              <input type="text" value={name} onChange={(event) => setName(event.target.value)} placeholder="Ex. Marvel / MCU" maxLength={80} />
            </label>
            <label>Description
              <textarea value={description} onChange={(event) => setDescription(event.target.value)} placeholder="Ex. Tout le MCU dans mon ordre préféré" maxLength={250} rows={3} />
            </label>
            <button type="submit" disabled={creating}>{creating ? 'Création…' : 'Créer la liste'}</button>
          </form>
        )}

        {errorMessage && <p data-steldra-ui="error" className={styles.error}>{errorMessage}</p>}

        {loading ? (
          <p data-steldra-ui="message" className={styles.message}>Chargement des listes…</p>
        ) : lists.length === 0 ? (
          <section data-steldra-ui="empty" className={styles.empty}>
            <span>◇</span><h2>Aucune liste pour le moment</h2>
            <p>Créez votre première liste pour organiser vos médias dans l’ordre de votre choix.</p>
            <button type="button" onClick={() => setShowForm(true)}>Créer ma première liste</button>
          </section>
        ) : (
          <>
            <section data-steldra-ui="dashboardRow" className={styles.dashboardRow}>
              <aside data-steldra-ui="summaryCard" className={styles.summaryCard}>
                <div data-steldra-ui="summaryStats" className={styles.summaryStats}>
                  <div><span>▱</span><strong>{lists.length}</strong><small>Listes créées</small></div>
                  <div><span>▦</span><strong>{totalTitles}</strong><small>Titres au total</small></div>
                  <div><span>⌁</span><strong>{sharedLists}</strong><small>Listes partagées</small></div>
                </div>
                <div data-steldra-ui="recentActivity" className={styles.recentActivity}>
                  <h3>Activité récente</h3>
                  {recentLists.map((list) => (
                    <Link key={list.id} href={`/lists/${list.id}`}>
                      <span>{list.name.charAt(0).toUpperCase()}</span>
                      <div><strong>{list.name}</strong><small>{loadingPreviews ? 'Chargement…' : `${list.itemCount} média${list.itemCount > 1 ? 's' : ''}`}</small></div>
                      <time>{formatDate(list.updated_at || list.created_at)}</time>
                    </Link>
                  ))}
                </div>
              </aside>

              <div data-steldra-ui="featuredArea" className={styles.featuredArea}>
                <div data-steldra-ui="sectionTitle" className={styles.sectionTitle}><div><span>SÉLECTION</span><h2>Vos listes à la une ✦</h2></div></div>
                <div data-steldra-ui="featuredRail" className={styles.featuredRail}>
                  {featuredLists.map((list) => (
                    <Link href={`/lists/${list.id}`} data-steldra-ui="featuredCard" className={styles.featuredCard} key={list.id}>
                      {renderPreview(list, true)}
                      <div data-steldra-ui="featuredShade" className={styles.featuredShade} />
                      <div data-steldra-ui="featuredText" className={styles.featuredText}><strong>{list.name}</strong><span>{loadingPreviews ? 'Chargement…' : `${list.itemCount} titre${list.itemCount > 1 ? 's' : ''}`}</span></div>
                    </Link>
                  ))}
                </div>
              </div>
            </section>

            <section data-steldra-ui="allListsSection" className={styles.allListsSection}>
              <div data-steldra-ui="sectionTitle" className={styles.sectionTitle}>
                <div><span>COLLECTIONS</span><h2>Toutes mes listes</h2></div>
                <strong>{filteredLists.length} liste{filteredLists.length > 1 ? 's' : ''}</strong>
              </div>

              {filteredLists.length === 0 ? (
                <div data-steldra-ui="noResults" className={styles.noResults}>Aucune liste ne correspond à votre recherche.</div>
              ) : (
                <div data-steldra-ui="grid" className={styles.grid}>
                  {filteredLists.map((list) => (
                    <Link href={`/lists/${list.id}`} data-steldra-ui="card" className={styles.card} key={list.id}>
                      <div data-steldra-ui="cover" className={styles.cover}>
                        {renderPreview(list)}
                        <div data-steldra-ui="coverShade" className={styles.coverShade} />
                      </div>
                      <div data-steldra-ui="cardBody" className={styles.cardBody}>
                        <div data-steldra-ui="cardTitleRow" className={styles.cardTitleRow}><h2>{list.name}</h2>{list.is_shared && <span title="Liste partagée">⌁</span>}</div>
                        <p>{list.description || 'Liste personnalisée ordonnée'}</p>
                        <div data-steldra-ui="cardMeta" className={styles.cardMeta}><span>{loadingPreviews ? 'Chargement…' : `${list.itemCount} titre${list.itemCount > 1 ? 's' : ''}`}</span><time>{formatDate(list.updated_at || list.created_at)}</time></div>
                        <div data-steldra-ui="cardAction" className={styles.cardAction}>Ouvrir <span>→</span></div>
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </section>
          </>
        )}
      </main>
    </>
  );
}
