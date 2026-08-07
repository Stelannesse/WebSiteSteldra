import { NextResponse } from 'next/server';

const TMDB_API_KEY = process.env.TMDB_API_KEY;

type Recommendation = {
  id: number;
  title: string;
  poster_path: string;
  type: 'movie' | 'tv';
  release_date?: string;
  recommendation_reason?: 'collection' | 'recommended';
};

const formatTmdbItem = (
  item: any,
  type: 'movie' | 'tv',
  reason: 'collection' | 'recommended'
): Recommendation | null => {
  if (!item?.id) return null;

  const title =
    type === 'movie'
      ? item.title || item.original_title
      : item.name || item.original_name;

  if (!title) return null;

  return {
    id: item.id,
    title,
    poster_path: item.poster_path || '',
    type,
    release_date:
      item.release_date || item.first_air_date || undefined,
    recommendation_reason: reason,
  };
};

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get('id');
  const requestedType = searchParams.get('type');

  if (!id || !requestedType || !TMDB_API_KEY) {
    return NextResponse.json({ results: [] });
  }

  if (
    requestedType === 'manga' ||
    requestedType === 'manhwa' ||
    String(id).startsWith('jikan_')
  ) {
    return NextResponse.json({ results: [] });
  }

  const tmdbType = requestedType === 'movie' ? 'movie' : 'tv';

  try {
    const detailsUrl =
      `https://api.themoviedb.org/3/${tmdbType}/${id}` +
      `?api_key=${TMDB_API_KEY}&language=fr-FR`;

    const detailsResponse = await fetch(detailsUrl);

    if (!detailsResponse.ok) {
      return NextResponse.json({ results: [] });
    }

    const details = await detailsResponse.json();
    const recommendations: Recommendation[] = [];

    if (tmdbType === 'movie' && details.belongs_to_collection?.id) {
      try {
        const collectionResponse = await fetch(
          `https://api.themoviedb.org/3/collection/${details.belongs_to_collection.id}` +
            `?api_key=${TMDB_API_KEY}&language=fr-FR`
        );

        if (collectionResponse.ok) {
          const collectionData = await collectionResponse.json();

          const collectionItems = (collectionData.parts || [])
            .map((item: any) =>
              formatTmdbItem(item, 'movie', 'collection')
            )
            .filter(Boolean) as Recommendation[];

          collectionItems.sort((a, b) =>
            (a.release_date || '9999').localeCompare(
              b.release_date || '9999'
            )
          );

          recommendations.push(...collectionItems);
        }
      } catch (error) {
        console.error('Erreur collection TMDB :', error);
      }
    }

    try {
      const recommendationsResponse = await fetch(
        `https://api.themoviedb.org/3/${tmdbType}/${id}/recommendations` +
          `?api_key=${TMDB_API_KEY}&language=fr-FR&page=1`
      );

      if (recommendationsResponse.ok) {
        const recommendationData = await recommendationsResponse.json();

        recommendations.push(
          ...(recommendationData.results || [])
            .map((item: any) =>
              formatTmdbItem(
                item,
                tmdbType,
                'recommended'
              )
            )
            .filter(Boolean)
        );
      }
    } catch (error) {
      console.error('Erreur recommandations TMDB :', error);
    }

    const unique = new Map<string, Recommendation>();

    recommendations.forEach((item) => {
      const key = `${item.type}_${item.id}`;

      if (
        item.id.toString() !== id.toString() &&
        !unique.has(key)
      ) {
        unique.set(key, item);
      }
    });

    return NextResponse.json({
      results: Array.from(unique.values()).slice(0, 18),
    });
  } catch (error) {
    console.error('Erreur API recommandations :', error);
    return NextResponse.json({ results: [] });
  }
}
