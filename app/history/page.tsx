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

const formatDate = (value: string) =>
  new Intl.DateTimeFormat('fr-FR', {
    day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit'
  }).format(new Date(value));

export default function HistoryPage() {
  const [supabase] = useState(() => createClient());
  const [rows, setRows] = useState<HistoryRow[]>([]);
  const [query, setQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState('all');
  const [periodFilter, setPeriodFilter] = useState('all');
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

  return (
    <>
      <MainNav />
      <main className={styles.page}>
        <header className={styles.header}>
          <div>
            <p className={styles.eyebrow}>Visionnages</p>
            <h1>Historique</h1>
            <p>Chaque visionnage est conservé, y compris lorsque vous revoyez un titre déjà terminé.</p>
          </div>
          <span className={styles.count}>{rows.length} visionnage{rows.length > 1 ? 's' : ''}</span>
        </header>

        <div className={styles.filters}>
          <input className={styles.search} type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Rechercher dans l’historique…" />
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
        </div>
        {error && <p className={styles.error}>{error}</p>}
        {loading ? <p>Chargement…</p> : filtered.length === 0 ? <p className={styles.empty}>Aucun visionnage trouvé.</p> : (
          <section className={styles.list}>
            {filtered.map((row) => {
              const media = row.media_data;
              if (!media) return null;
              return (
                <article className={styles.item} key={row.id}>
                  <a href={`/media/${row.media_type}/${row.media_id}`} className={styles.mediaLink}>
                    <img src={getPosterUrl(media, 'w154')} alt="" onError={(event) => usePosterFallback(event.currentTarget)} />
                    <div>
                      <strong>{media.title}</strong>
                      <span>{row.media_type} · {formatDate(row.watched_at)}</span>
                    </div>
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
          </section>
        )}
      </main>
    </>
  );
}
