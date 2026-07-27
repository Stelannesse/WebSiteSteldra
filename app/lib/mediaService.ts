import { MediaItem } from '../types/media';

export async function searchMedia(text: string) {
  if (text.trim().length < 2) {
    return [];
  }

  const res = await fetch(`/api/search?q=${encodeURIComponent(text)}`);

  if (!res.ok) {
    throw new Error('Erreur lors de la recherche');
  }

  const data = await res.json();

  return data.results || [];
}

export type MediaDetailsResult = {
  synopsis: string;
  actors: any[];
  seasons_count: number;
  authors?: any[];

  runtime?: number | null;
  episode_runtime?: number | null;
};

export async function getMediaDetails(
  media: MediaItem
) {
  let apiType: string;

  if (media.type === 'movie') {
    apiType = 'movie';
  } else if (
    media.type === 'manga' ||
    media.type === 'manhwa'
  ) {
    apiType = media.type;
  } else {
    apiType = 'tv';
  }

  const res = await fetch(
    `/api/media-details?id=${encodeURIComponent(
      media.id.toString()
    )}&type=${apiType}`
  );

  if (!res.ok) {
    const errorText = await res.text();

    console.error(
      'Erreur détails média :',
      {
        status: res.status,
        mediaId: media.id,
        mediaType: media.type,
        apiType,
        response: errorText,
      }
    );

    throw new Error(
      `Erreur lors du chargement des détails : ${res.status}`
    );
  }

  return await res.json();
}

export async function getSeasonEpisodes(
  mediaId: string | number,
  seasonNumber: number
) {

        const res = await fetch(
        `/api/tv-seasons?id=${mediaId}&season=${seasonNumber}`
        );
  if (!res.ok) {
    const errorText = await res.text();

    console.error('Erreur API épisodes :', {
      status: res.status,
      statusText: res.statusText,
      response: errorText,
      mediaId,
      seasonNumber,
    });

    throw new Error(
      `Erreur épisodes ${res.status} : ${
        errorText || res.statusText
      }`
    );
  }

  const data = await res.json();
  return data.episodes || [];
}  