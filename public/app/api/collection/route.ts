import { NextResponse } from 'next/server';

const TMDB_API_KEY = process.env.TMDB_API_KEY;

async function fetchTmdb(url: string) {
  const response = await fetch(url, { next: { revalidate: 3600 } });
  if (!response.ok) return null;
  return response.json();
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get('id');

  if (!id || !TMDB_API_KEY) {
    return NextResponse.json({ collection: null, results: [] });
  }

  try {
    const collection = await fetchTmdb(
      `https://api.themoviedb.org/3/collection/${encodeURIComponent(id)}?api_key=${TMDB_API_KEY}&language=fr-FR`
    );

    if (!collection) {
      return NextResponse.json({ collection: null, results: [] });
    }

    const sortedParts = [...(collection.parts || [])].sort((a: any, b: any) =>
      (a.release_date || '9999').localeCompare(b.release_date || '9999')
    );

    // Les durées servent aux statistiques de la saga. On les charge en parallèle.
    const details = await Promise.all(
      sortedParts.map((part: any) =>
        fetchTmdb(
          `https://api.themoviedb.org/3/movie/${part.id}?api_key=${TMDB_API_KEY}&language=fr-FR`
        )
      )
    );

    const results = sortedParts.map((part: any, index: number) => {
      const detail = details[index] || {};
      const releaseDate = part.release_date || detail.release_date || '';
      return {
        id: part.id,
        title: part.title || part.original_title,
        poster_path: part.poster_path || detail.poster_path || '',
        type: 'movie' as const,
        release_date: releaseDate || undefined,
        year: releaseDate ? Number(String(releaseDate).slice(0, 4)) : null,
        runtime: Number(detail.runtime) || null,
      };
    });

    return NextResponse.json({
      collection: {
        id: collection.id,
        name: collection.name,
        overview: collection.overview || '',
        poster_path: collection.poster_path || '',
        backdrop_path: collection.backdrop_path || '',
      },
      results,
    });
  } catch (error) {
    console.error('Erreur API collection :', error);
    return NextResponse.json({ collection: null, results: [] });
  }
}
