import { NextResponse } from 'next/server';

const TMDB_API_KEY = process.env.TMDB_API_KEY;

type RecommendationReason =
  | 'collection'
  | 'director'
  | 'cast'
  | 'similar'
  | 'recommended';

type Recommendation = {
  id: number;
  title: string;
  poster_path: string;
  type: 'movie' | 'tv';
  release_date?: string;
  year?: number | null;
  recommendation_reason?: RecommendationReason;
  recommendation_label?: string;
  collection_id?: number;
};

const formatTmdbItem = (
  item: any,
  type: 'movie' | 'tv',
  reason: RecommendationReason,
  label?: string
): Recommendation | null => {
  if (!item?.id) return null;

  const title =
    type === 'movie'
      ? item.title || item.original_title
      : item.name || item.original_name;

  if (!title) return null;

  const releaseDate = item.release_date || item.first_air_date || '';

  return {
    id: item.id,
    title,
    poster_path: item.poster_path || '',
    type,
    release_date: releaseDate || undefined,
    year: releaseDate ? Number(String(releaseDate).slice(0, 4)) : null,
    recommendation_reason: reason,
    recommendation_label: label,
  };
};

async function fetchTmdb(url: string) {
  const response = await fetch(url, { next: { revalidate: 3600 } });
  if (!response.ok) return null;
  return response.json();
}

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
  const recommendations: Recommendation[] = [];

  try {
    const details = await fetchTmdb(
      `https://api.themoviedb.org/3/${tmdbType}/${id}?api_key=${TMDB_API_KEY}&language=fr-FR`
    );

    if (!details) {
      return NextResponse.json({ results: [] });
    }

    // 1. Même saga : toujours prioritaire.
    if (tmdbType === 'movie' && details.belongs_to_collection?.id) {
      const collectionData = await fetchTmdb(
        `https://api.themoviedb.org/3/collection/${details.belongs_to_collection.id}?api_key=${TMDB_API_KEY}&language=fr-FR`
      );

      const collectionName = collectionData?.name || details.belongs_to_collection?.name || 'Même saga';
      const collectionId = Number(details.belongs_to_collection.id);
      const collectionItems = (collectionData?.parts || [])
        .map((item: any) => {
          const formatted = formatTmdbItem(item, 'movie', 'collection', collectionName);
          return formatted ? { ...formatted, collection_id: collectionId } : null;
        })
        .filter(Boolean) as Recommendation[];

      collectionItems.sort((a, b) =>
        (a.release_date || '9999').localeCompare(b.release_date || '9999')
      );

      recommendations.push(...collectionItems);
    }

    // 2. Même réalisateur pour les films.
    const credits = await fetchTmdb(
      `https://api.themoviedb.org/3/${tmdbType}/${id}/credits?api_key=${TMDB_API_KEY}&language=fr-FR`
    );

    if (tmdbType === 'movie') {
      const director = credits?.crew?.find((person: any) => person.job === 'Director');

      if (director?.id) {
        const directorMovies = await fetchTmdb(
          `https://api.themoviedb.org/3/discover/movie?api_key=${TMDB_API_KEY}&language=fr-FR&sort_by=popularity.desc&with_crew=${director.id}&include_adult=false&page=1`
        );

        recommendations.push(
          ...(directorMovies?.results || [])
            .slice(0, 8)
            .map((item: any) =>
              formatTmdbItem(item, 'movie', 'director', `Même réalisateur : ${director.name}`)
            )
            .filter(Boolean)
        );
      }
    }

    // 3. Avec un acteur ou une actrice principale.
    const lead = credits?.cast?.find((person: any) => person.id && person.name);

    if (lead?.id) {
      const withPeople = await fetchTmdb(
        `https://api.themoviedb.org/3/discover/${tmdbType}?api_key=${TMDB_API_KEY}&language=fr-FR&sort_by=popularity.desc&with_people=${lead.id}&include_adult=false&page=1`
      );

      recommendations.push(
        ...(withPeople?.results || [])
          .slice(0, 7)
          .map((item: any) =>
            formatTmdbItem(item, tmdbType, 'cast', `Avec ${lead.name}`)
          )
          .filter(Boolean)
      );
    }

    // 4. Titres similaires.
    const similarData = await fetchTmdb(
      `https://api.themoviedb.org/3/${tmdbType}/${id}/similar?api_key=${TMDB_API_KEY}&language=fr-FR&page=1`
    );

    recommendations.push(
      ...(similarData?.results || [])
        .slice(0, 10)
        .map((item: any) =>
          formatTmdbItem(item, tmdbType, 'similar', 'Titre similaire')
        )
        .filter(Boolean)
    );

    // 5. Recommandations TMDB générales.
    const recommendationData = await fetchTmdb(
      `https://api.themoviedb.org/3/${tmdbType}/${id}/recommendations?api_key=${TMDB_API_KEY}&language=fr-FR&page=1`
    );

    recommendations.push(
      ...(recommendationData?.results || [])
        .map((item: any) =>
          formatTmdbItem(item, tmdbType, 'recommended', 'Recommandé pour vous')
        )
        .filter(Boolean)
    );

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
      results: Array.from(unique.values()).slice(0, 24),
    });
  } catch (error) {
    console.error('Erreur API recommandations :', error);
    return NextResponse.json({ results: [] });
  }
}
