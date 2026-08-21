import { NextResponse } from 'next/server';

const TMDB_API_KEY = process.env.TMDB_API_KEY;

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get('id');
  const type = searchParams.get('type');

  if (!id || !type) {
    return NextResponse.json({ rating: null, voteCount: 0 }, { status: 400 });
  }

  if (!TMDB_API_KEY || String(id).startsWith('jikan_')) {
    return NextResponse.json({ rating: null, voteCount: 0 });
  }

  const tmdbType =
    type === 'movie'
      ? 'movie'
      : ['tv', 'drama', 'anime'].includes(type)
        ? 'tv'
        : null;

  if (!tmdbType) {
    return NextResponse.json({ rating: null, voteCount: 0 });
  }

  try {
    const response = await fetch(
      `https://api.themoviedb.org/3/${tmdbType}/${encodeURIComponent(id)}?api_key=${encodeURIComponent(TMDB_API_KEY)}&language=fr-FR`,
      {
        headers: { Accept: 'application/json' },
        next: { revalidate: 3600 },
      }
    );

    if (!response.ok) {
      return NextResponse.json({ rating: null, voteCount: 0 });
    }

    const data = await response.json();

    return NextResponse.json({
      rating: typeof data.vote_average === 'number' ? data.vote_average : null,
      voteCount: typeof data.vote_count === 'number' ? data.vote_count : 0,
    });
  } catch (error) {
    console.error('Note TMDB indisponible :', error);
    return NextResponse.json({ rating: null, voteCount: 0 });
  }
}
