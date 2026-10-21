'use client';

import { useEffect, useState } from 'react';
import { createClient } from '../lib/supabase';
import { readUser, loadCollection } from '../lib/browserData';
import { hasNewReleasedEpisode } from '../lib/seriesReleases';

/** Vérifie les sorties quand l'application est ouverte, sans bloquer ses pages. */
export default function SeriesReleaseWatcher() {
  const [supabase] = useState(() => createClient());
  useEffect(() => {
    let stopped = false;
    let running = false;
    let lastRun = 0;
    const check = async () => {
      if (stopped || running || document.visibilityState === 'hidden' || Date.now() - lastRun < 5 * 60 * 1000) return;
      lastRun = Date.now();
      running = true;
      try {
        const { data: { user } } = await readUser(supabase);
        if (!user || stopped) return;
        const cacheKey = `steldra_release_checks_v1:${user.id}`;
        let checked: Record<string, number> = {};
        try { checked = JSON.parse(localStorage.getItem(cacheKey) || '{}'); } catch { /* Stockage facultatif. */ }
        const { data: collectionRows, error } = await loadCollection(supabase, user.id);
        const rows = collectionRows.filter((row) => row.status === 'vu' && ['tv', 'drama', 'anime'].includes(row.media_type));
        if (error || stopped) return;
        const keyOf = (row: any) => `${row.media_type}_${row.media_id}`;
        const candidates = rows.filter((row) => row.media_data && Date.now() - (Number(checked[keyOf(row)]) || 0) > 6 * 60 * 60 * 1000)
          .sort((a,b) => (Number(checked[keyOf(a)]) || 0) - (Number(checked[keyOf(b)]) || 0)).slice(0, 40);
        for (let index = 0; index < candidates.length && !stopped; index += 2) {
          await Promise.allSettled(candidates.slice(index, index + 2).map(async (row) => {
            const response = await fetch(`/api/series-release?type=${encodeURIComponent(row.media_type)}&id=${encodeURIComponent(row.media_id)}`, { signal: AbortSignal.timeout(12000) });
            if (!response.ok || stopped) return;
            const payload = await response.json();
            if (stopped) return;
            if (hasNewReleasedEpisode(row, payload.episode)) {
              const media = { ...row.media_data, episodes: payload.episodes || row.media_data.episodes,
                seasons: payload.seasons || row.media_data.seasons,
                steldra_new_episode: `S${payload.episode.season}E${payload.episode.number}` };
              // Garde l'ancien statut et la date comme conditions pour respecter une modification concurrente.
              let update = supabase.from('media_progress').update({ status: 'en_cours', media_data: media })
                .eq('user_id', user.id).eq('media_id', row.media_id).eq('media_type', row.media_type).eq('status', 'vu');
              if (row.updated_at) update = update.eq('updated_at', row.updated_at);
              const { data, error: updateError } = await update.select('media_id');
              if (updateError) return;
              if (data?.length) {
                window.dispatchEvent(new CustomEvent('steldra:series-released', { detail: { mediaId: row.media_id, mediaType: row.media_type, media } }));
                window.dispatchEvent(new CustomEvent('steldra:progress-updated'));
              }
            }
            checked[keyOf(row)] = Date.now();
          }));
        }
        // Conserve seulement les clés encore présentes dans la collection terminée.
        const trimmed = Object.fromEntries(rows.map((row) => [keyOf(row), checked[keyOf(row)] || 0]));
        try { localStorage.setItem(cacheKey, JSON.stringify(trimmed)); } catch { /* Ne bloque pas l'application. */ }
      } finally { running = false; }
    };
    const safeCheck = () => { void check().catch(() => undefined); };
    const timer = window.setTimeout(safeCheck, 2500);
    const interval = window.setInterval(safeCheck, 60 * 60 * 1000);
    document.addEventListener('visibilitychange', safeCheck);
    return () => { stopped = true; window.clearTimeout(timer); window.clearInterval(interval); document.removeEventListener('visibilitychange', safeCheck); };
  }, [supabase]);
  return null;
}
