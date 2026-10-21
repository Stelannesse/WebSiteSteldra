/**
 * Rôle du fichier : Page Historique : regroupe chronologiquement les ajouts et activités de visionnage.
 */

'use client';

import { useEffect, useMemo, useState } from 'react';
import MainNav from '../components/mainNav';
import { readUser, loadCollection, loadHistory, invalidateBrowserData } from '../lib/browserData';
import { createClient } from '../lib/supabase';
import { getPosterUrl, usePosterFallback } from '../lib/poster';
import type { MediaItem } from '../types/media';
import styles from './history.module.css';

type HistoryRow = {
  id: string;
  media_id: string;
  media_type: string;
  media_data: MediaItem | null;
  watched_at: string;
  recovered?: boolean;
};

const INITIAL_VISIBLE = 24;
const LOAD_MORE_STEP = 24;

/** Construit une clé stable combinant le type et l'identifiant du média. */
const mediaKey = (row: HistoryRow) => `${row.media_type}_${row.media_id}`;

/** Traduit le type technique du média en libellé français. */
const typeLabel = (type: string) => {
  const labels: Record<string, string> = {
    movie: 'Film',
    tv: 'Série',
    drama: 'Drama',
    anime: 'Animé',
    manga: 'Manga',
    manhwa: 'Manhwa',
  };
  return labels[type] || type;
};

const formatTime = (value: string) =>
  new Intl.DateTimeFormat('fr-FR', {
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value));

/** Produit une clé de regroupement correspondant au jour d'une activité. */
const dayKey = (value: string) => {
  const date = new Date(value);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
};

/** Transforme une date en titre de groupe lisible dans l'historique. */
const formatDayLabel = (value: string) => {
  const date = new Date(value);
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);

  const sameDay = (a: Date, b: Date) =>
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate();

  if (sameDay(date, today)) return "Aujourd’hui";
  if (sameDay(date, yesterday)) return 'Hier';

  return new Intl.DateTimeFormat('fr-FR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: date.getFullYear() !== today.getFullYear() ? 'numeric' : undefined,
  }).format(date);
};

/** Composant principal de cette page ou zone d'interface. */
export default function HistoryPage() {
  const [supabase] = useState(() => createClient());
  const [rows, setRows] = useState<HistoryRow[]>([]);
  const [query, setQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState('all');
  const [periodFilter, setPeriodFilter] = useState('all');
  const [visibleCount, setVisibleCount] = useState(INITIAL_VISIBLE);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      const { data: { user } } = await readUser(supabase);
      if (!user) {
        window.location.href = '/login';
        return;
      }

      // Ces deux sources indépendantes sont chargées en parallèle.
      const [historyResponse, progressResponse] = await Promise.all([
        loadHistory(supabase, user.id, (partialRows, complete) => {
          if (cancelled) return;
          setRows(partialRows);
          setLoading(false);
          setLoadingMore(!complete);
        }),
        loadCollection(supabase, user.id),
      ]);
      const { data, error: loadError } = historyResponse;
      const { data: progress } = progressResponse;
      // Reconstitue uniquement la dernière progression connue, pas de fausses dates d'épisodes.
      const known = new Set((data || []).map(mediaKey));
      const recovered: HistoryRow[] = [];
      (progress || []).forEach((entry) => {
        const key = `${entry.media_type}_${entry.media_id}`;
        const episodes = entry.watched_episode || entry.watched_episodes || {};
        const watched = Object.entries(episodes).some(([episodeKey, value]) => episodeKey.startsWith(`${key}_S`) && value);
        const date = entry.media_data?.steldra_last_interaction_at || entry.updated_at || entry.created_at;
        if (known.has(key) || !entry.media_data || (!watched && entry.status !== 'vu') || !date || !Number.isFinite(Date.parse(date))) return;
        recovered.push({ id: `progress:${key}`, media_id: entry.media_id, media_type: entry.media_type, media_data: entry.media_data, watched_at: date, recovered: true });
      });
      if (cancelled) return;
      if (loadError) setError('Impossible de charger l’historique. Vérifiez que la migration SQL a été appliquée.');
      else setRows([...data, ...recovered].sort((a,b) => Date.parse(b.watched_at) - Date.parse(a.watched_at)));
      setLoading(false);
      setLoadingMore(false);
    };
    void load();
    return () => { cancelled = true; };
  }, [supabase]);

  useEffect(() => {
    setVisibleCount(INITIAL_VISIBLE);
  }, [query, typeFilter, periodFilter]);

  const deleteHistoryRow = async (rowId: string) => {
    const confirmed = window.confirm('Supprimer ce visionnage de l’historique ?');
    if (!confirmed) return;

    const { error: deleteError } = await supabase
      .from('watch_history')
      .delete()
      .eq('id', rowId);

    if (deleteError) {
      setError('Impossible de supprimer ce visionnage.');
      return;
    }

    invalidateBrowserData();
    setRows((current) => current.filter((row) => row.id !== rowId));
  };

  const filtered = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase('fr');
    const now = Date.now();
    const periodDays = periodFilter === '7' ? 7 : periodFilter === '30' ? 30 : periodFilter === '365' ? 365 : null;

    return rows.filter((row) => {
      if (normalized && !(row.media_data?.title || '').toLocaleLowerCase('fr').includes(normalized)) return false;
      if (typeFilter !== 'all' && row.media_type !== typeFilter) return false;
      if (periodDays) {
        const watchedAt = new Date(row.watched_at).getTime();
        if (!Number.isFinite(watchedAt) || watchedAt < now - periodDays * 24 * 60 * 60 * 1000) return false;
      }
      return true;
    });
  }, [rows, query, typeFilter, periodFilter]);

  const stats = useMemo(() => {
    const unique = new Set(rows.map(mediaKey));
    return {
      views: rows.length,
      unique: unique.size,
      rewatches: Math.max(0, rows.length - unique.size),
    };
  }, [rows]);

  const visibleRows = filtered.slice(0, visibleCount);
  const groupedRows = useMemo(() => {
    const groups = new Map<string, HistoryRow[]>();
    visibleRows.forEach((row) => {
      const key = dayKey(row.watched_at);
      const current = groups.get(key) || [];
      current.push(row);
      groups.set(key, current);
    });
    return [...groups.entries()];
  }, [visibleRows]);

  return (
    <>
      <MainNav />
      <main data-steldra-ui="page" className={styles.page}>
        <section data-steldra-ui="hero" className={styles.hero}>
          <div data-steldra-ui="heroCopy" className={styles.heroCopy}>
            <span data-steldra-ui="eyebrow" className={styles.eyebrow}>VOS VISIONNAGES</span>
            <h1>Historique</h1>
            <p>Vos visionnages, réunis au même endroit.</p>
          </div>
          <div data-steldra-ui="heroStats" className={styles.heroStats} aria-label="Résumé de l’historique">
            <div><strong>{stats.views}</strong><span>visionnage{stats.views > 1 ? 's' : ''}</span></div>
            <div><strong>{stats.unique}</strong><span>titres uniques</span></div>
            <div><strong>{stats.rewatches}</strong><span>revisionnage{stats.rewatches > 1 ? 's' : ''}</span></div>
          </div>
        </section>

        {loadingMore && !loading && <p role="status">Les entrées plus anciennes et les totaux se complètent…</p>}
        <section data-steldra-ui="controlDeck" className={styles.controlDeck} aria-label="Filtres de l’historique">
          <label data-steldra-ui="searchWrap" className={styles.searchWrap}>
            <span>⌕</span>
            <input
              data-steldra-ui="search" className={styles.search}
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Rechercher un titre dans votre historique…"
            />
          </label>
          <select data-steldra-ui="select" className={styles.select} value={typeFilter} onChange={(event) => setTypeFilter(event.target.value)} aria-label="Filtrer par type">
            <option value="all">Tous les types</option>
            <option value="movie">Films</option>
            <option value="tv">Séries</option>
            <option value="drama">Dramas</option>
            <option value="anime">Animés</option>
          </select>
          <select data-steldra-ui="select" className={styles.select} value={periodFilter} onChange={(event) => setPeriodFilter(event.target.value)} aria-label="Filtrer par période">
            <option value="all">Toute la période</option>
            <option value="7">7 derniers jours</option>
            <option value="30">30 derniers jours</option>
            <option value="365">12 derniers mois</option>
          </select>
        </section>

        {error && <p data-steldra-ui="error" className={styles.error}>{error}</p>}

        {loading ? (
          <div data-steldra-ui="loading" className={styles.loading}>Chargement de votre historique…</div>
        ) : filtered.length === 0 ? (
          <section data-steldra-ui="empty" className={styles.empty}>
            <span>✦</span>
            <h2>Aucun visionnage trouvé</h2>
            <p>Votre historique apparaîtra ici au fil de vos visionnages.</p>
          </section>
        ) : (
          <section data-steldra-ui="timeline" className={styles.timeline}>
            <div data-steldra-ui="timelineHead" className={styles.timelineHead}>
              <div>
                <span data-steldra-ui="eyebrow" className={styles.eyebrow}>CHRONOLOGIE</span>
                <h2>Vos derniers visionnages</h2>
              </div>
              <strong>{filtered.length} résultat{filtered.length > 1 ? 's' : ''}</strong>
            </div>

            {groupedRows.map(([groupKey, group]) => (
              <section data-steldra-ui="dayGroup" className={styles.dayGroup} key={groupKey}>
                <header data-steldra-ui="dayHeader" className={styles.dayHeader}>
                  <span data-steldra-ui="timelineDot" className={styles.timelineDot} />
                  <h3>{formatDayLabel(group[0].watched_at)}</h3>
                  <span>{group.length} visionnage{group.length > 1 ? 's' : ''}</span>
                </header>

                <div data-steldra-ui="dayRows" className={styles.dayRows}>
                  {group.map((row) => {
                    const media = row.media_data;
                    if (!media) return null;
                    return (
                      <article data-steldra-ui="item" className={styles.item} key={row.id}>
                        <a href={`/media/${row.media_type}/${row.media_id}`} data-steldra-ui="mediaLink" className={styles.mediaLink}>
                          <img loading="lazy" decoding="async" src={getPosterUrl(media, 'w154')} alt="" onError={(event) => usePosterFallback(event.currentTarget)} />
                          <div data-steldra-ui="mediaInfo" className={styles.mediaInfo}>
                            <div data-steldra-ui="metaLine" className={styles.metaLine}>
                              <span data-steldra-ui="typePill" className={styles.typePill}>{typeLabel(row.media_type)}</span>
                              <span data-steldra-ui="time" className={styles.time}>{formatTime(row.watched_at)}</span>
                            </div>
                            <strong>{media.title}</strong>
                            <small>{row.recovered ? 'Dernière progression enregistrée · date des épisodes non conservée' : media.steldra_history_episodes?.length ? media.steldra_history_episodes.join(', ') : 'Voir la fiche complète'}</small>
                          </div>
                          <span data-steldra-ui="openArrow" className={styles.openArrow}>›</span>
                        </a>
                        {!row.recovered && <button
                          type="button"
                          data-steldra-ui="deleteButton" className={styles.deleteButton}
                          onClick={() => void deleteHistoryRow(row.id)}
                          aria-label={`Supprimer ${media.title} de l’historique`}
                          title="Supprimer ce visionnage"
                        >
                          ×
                        </button>}
                      </article>
                    );
                  })}
                </div>
              </section>
            ))}

            {visibleCount < filtered.length && (
              <button data-steldra-ui="loadMore" className={styles.loadMore} type="button" onClick={() => setVisibleCount((count) => count + LOAD_MORE_STEP)}>
                Afficher plus de visionnages <span>{Math.min(LOAD_MORE_STEP, filtered.length - visibleCount)} de plus</span>
              </button>
            )}
          </section>
        )}
      </main>
    </>
  );
}
