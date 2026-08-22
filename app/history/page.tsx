'use client';

import { useEffect, useMemo, useState } from 'react';
import MainNav from '../components/mainNav';
import { createClient } from '../lib/supabase';
import { fetchAllPages } from '../lib/supabasePaging';
import { getPosterUrl, usePosterFallback } from '../lib/poster';
import type { MediaItem } from '../types/media';
import styles from './history.module.css';

type HistoryRow = {
  id: string;
  media_id: string;
  media_type: string;
  media_data: MediaItem | null;
  watched_at: string;
};

const INITIAL_VISIBLE = 80;
const LOAD_MORE_STEP = 80;

const mediaKey = (row: HistoryRow) => `${row.media_type}_${row.media_id}`;

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

const dayKey = (value: string) => {
  const date = new Date(value);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
};

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

export default function HistoryPage() {
  const [supabase] = useState(() => createClient());
  const [rows, setRows] = useState<HistoryRow[]>([]);
  const [query, setQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState('all');
  const [periodFilter, setPeriodFilter] = useState('all');
  const [visibleCount, setVisibleCount] = useState(INITIAL_VISIBLE);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        window.location.href = '/login';
        return;
      }

      const { data, error: loadError } = await fetchAllPages<HistoryRow>((from, to) =>
        supabase
          .from('watch_history')
          .select('id,media_id,media_type,media_data,watched_at')
          .eq('user_id', user.id)
          .order('watched_at', { ascending: false })
          .order('id', { ascending: false })
          .range(from, to)
      );

      if (cancelled) return;
      if (loadError) setError('Impossible de charger l’historique. Vérifiez que la migration SQL a été appliquée.');
      else setRows(data);
      setLoading(false);
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
      <main className={styles.page}>
        <section className={styles.hero}>
          <div className={styles.heroCopy}>
            <span className={styles.eyebrow}>VOS VISIONNAGES</span>
            <h1>Historique</h1>
            <p>Vos visionnages, réunis au même endroit.</p>
          </div>
          <div className={styles.heroStats} aria-label="Résumé de l’historique">
            <div><strong>{stats.views}</strong><span>visionnage{stats.views > 1 ? 's' : ''}</span></div>
            <div><strong>{stats.unique}</strong><span>titres uniques</span></div>
            <div><strong>{stats.rewatches}</strong><span>revisionnage{stats.rewatches > 1 ? 's' : ''}</span></div>
          </div>
        </section>

        <section className={styles.controlDeck} aria-label="Filtres de l’historique">
          <label className={styles.searchWrap}>
            <span>⌕</span>
            <input
              className={styles.search}
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Rechercher un titre dans votre historique…"
            />
          </label>
          <select className={styles.select} value={typeFilter} onChange={(event) => setTypeFilter(event.target.value)} aria-label="Filtrer par type">
            <option value="all">Tous les types</option>
            <option value="movie">Films</option>
            <option value="tv">Séries</option>
            <option value="drama">Dramas</option>
            <option value="anime">Animés</option>
            <option value="manga">Mangas</option>
            <option value="manhwa">Manhwas</option>
          </select>
          <select className={styles.select} value={periodFilter} onChange={(event) => setPeriodFilter(event.target.value)} aria-label="Filtrer par période">
            <option value="all">Toute la période</option>
            <option value="7">7 derniers jours</option>
            <option value="30">30 derniers jours</option>
            <option value="365">12 derniers mois</option>
          </select>
        </section>

        {error && <p className={styles.error}>{error}</p>}

        {loading ? (
          <div className={styles.loading}>Chargement de votre historique…</div>
        ) : filtered.length === 0 ? (
          <section className={styles.empty}>
            <span>✦</span>
            <h2>Aucun visionnage trouvé</h2>
            <p>Votre historique apparaîtra ici au fil de vos visionnages.</p>
          </section>
        ) : (
          <section className={styles.timeline}>
            <div className={styles.timelineHead}>
              <div>
                <span className={styles.eyebrow}>CHRONOLOGIE</span>
                <h2>Vos derniers visionnages</h2>
              </div>
              <strong>{filtered.length} résultat{filtered.length > 1 ? 's' : ''}</strong>
            </div>

            {groupedRows.map(([groupKey, group]) => (
              <section className={styles.dayGroup} key={groupKey}>
                <header className={styles.dayHeader}>
                  <span className={styles.timelineDot} />
                  <h3>{formatDayLabel(group[0].watched_at)}</h3>
                  <span>{group.length} visionnage{group.length > 1 ? 's' : ''}</span>
                </header>

                <div className={styles.dayRows}>
                  {group.map((row) => {
                    const media = row.media_data;
                    if (!media) return null;
                    return (
                      <article className={styles.item} key={row.id}>
                        <a href={`/media/${row.media_type}/${row.media_id}`} className={styles.mediaLink}>
                          <img src={getPosterUrl(media, 'w154')} alt="" onError={(event) => usePosterFallback(event.currentTarget)} />
                          <div className={styles.mediaInfo}>
                            <div className={styles.metaLine}>
                              <span className={styles.typePill}>{typeLabel(row.media_type)}</span>
                              <span className={styles.time}>{formatTime(row.watched_at)}</span>
                            </div>
                            <strong>{media.title}</strong>
                            <small>Voir la fiche complète</small>
                          </div>
                          <span className={styles.openArrow}>›</span>
                        </a>
                        <button
                          type="button"
                          className={styles.deleteButton}
                          onClick={() => void deleteHistoryRow(row.id)}
                          aria-label={`Supprimer ${media.title} de l’historique`}
                          title="Supprimer ce visionnage"
                        >
                          ×
                        </button>
                      </article>
                    );
                  })}
                </div>
              </section>
            ))}

            {visibleCount < filtered.length && (
              <button className={styles.loadMore} type="button" onClick={() => setVisibleCount((count) => count + LOAD_MORE_STEP)}>
                Afficher plus de visionnages <span>{Math.min(LOAD_MORE_STEP, filtered.length - visibleCount)} de plus</span>
              </button>
            )}
          </section>
        )}
      </main>
    </>
  );
}
