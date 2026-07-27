import type { MediaItem } from '../types/media';

export async function searchMedia(text: string): Promise<MediaItem[]> {
  if (text.trim().length < 2) {
    return [];
  }

  const res = await fetch(
    `/api/search?q=${encodeURIComponent(text)}`
  );

  if (!res.ok) {
    throw new Error('Erreur lors de la recherche');
  }

  const data = await res.json();

  return Array.isArray(data.results) ? data.results : [];
}

export async function getMediaDetails(media: MediaItem) {
  const apiType = media.type === 'movie' ? 'movie' : 'tv';

  const res = await fetch(
    `/api/media-details?id=${media.id}&type=${apiType}`
  );

  if (!res.ok) {
    throw new Error(
      'Erreur lors du chargement des détails'
    );
  }

  return res.json();
}

export async function getSeasonEpisodes(
  mediaId: string | number,
  seasonNum: number
) {
  const res = await fetch(
    `/api/tv-season?id=${mediaId}&season=${seasonNum}`
  );

  if (!res.ok) {
    throw new Error(
      'Erreur lors du chargement des épisodes'
    );
  }

  const data = await res.json();

  return Array.isArray(data.episodes)
    ? data.episodes
    : [];
}