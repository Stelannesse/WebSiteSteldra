import type { MediaItem } from '../types/media';
export type ReleasedEpisode = { season: number; number: number; air_date: string };

/** Les anciens titres sans date de fin fiable ne sont pas reclassés arbitrairement. */
export function hasNewReleasedEpisode(row: {
  media_id: string | number; media_type: string; status: string; media_data: MediaItem | null;
  created_at?: string | null; updated_at?: string | null;
  watched_episode?: Record<string, boolean> | null; watched_episodes?: Record<string, boolean> | null;
}, episode: ReleasedEpisode | null, today = new Date().toISOString().slice(0, 10)) {
  if (row.status !== 'vu' || !['tv', 'anime', 'drama'].includes(row.media_type) || !episode) return false;
  if (!(episode.season > 0 && episode.number > 0) || !/^\d{4}-\d{2}-\d{2}$/.test(episode.air_date) || episode.air_date > today) return false;
  const completed = row.media_data?.steldra_completed_at || row.media_data?.steldra_last_interaction_at || row.updated_at || row.created_at;
  if (!completed || !Number.isFinite(Date.parse(completed)) || episode.air_date <= completed.slice(0, 10)) return false;
  const episodeKey = `${row.media_type}_${row.media_id}_S${episode.season}E${episode.number}`;
  return !row.watched_episode?.[episodeKey] && !row.watched_episodes?.[episodeKey];
}
