import { NextResponse } from 'next/server';

const TMDB_API_KEY = process.env.TMDB_API_KEY;

type TmdbType = 'movie' | 'tv';

function format(item: any, type: TmdbType) {
  const title = type === 'movie' ? item.title || item.original_title : item.name || item.original_name;
  if (!item?.id || !title) return null;
  const date = item.release_date || item.first_air_date || '';
  const countries = item.origin_country || [];
  const isAnimation = Array.isArray(item.genre_ids) && item.genre_ids.includes(16);
  const isAsian = Array.isArray(countries) && countries.some((c: string) => ['JP', 'KR', 'TW', 'CN', 'TH'].includes(c));
  const finalType = type === 'movie' ? 'movie' : isAnimation ? 'anime' : isAsian ? 'drama' : 'tv';
  return {
    id: item.id,
    title,
    poster_path: item.poster_path || '',
    type: finalType,
    year: date ? Number(String(date).slice(0, 4)) : null,
    release_date: type === 'movie' ? date || undefined : undefined,
    first_air_date: type === 'tv' ? date || undefined : undefined,
    genre_ids: item.genre_ids || [],
    rating: typeof item.vote_average === 'number' ? item.vote_average : null,
    popularity: typeof item.popularity === 'number' ? item.popularity : 0,
  };
}

async function tmdb(path: string) {
  if (!TMDB_API_KEY) return [];
  const separator = path.includes('?') ? '&' : '?';
  const response = await fetch(
    `https://api.themoviedb.org/3/${path}${separator}api_key=${encodeURIComponent(TMDB_API_KEY)}&language=fr-FR`,
    { next: { revalidate: 1800 } },
  );
  if (!response.ok) return [];
  const payload = await response.json();
  return payload.results || [];
}

function unique(items: any[]) {
  const map = new Map<string, any>();
  for (const item of items.filter(Boolean)) {
    const key = `${item.type}_${item.id}`;
    if (!map.has(key)) map.set(key, item);
  }
  return [...map.values()];
}

export async function GET() {
  if (!TMDB_API_KEY) return NextResponse.json({ trending: [], newReleases: [] });

  try {
    const [trendingMovies, trendingTv, nowPlaying, onAir] = await Promise.all([
      tmdb('trending/movie/week?'),
      tmdb('trending/tv/week?'),
      tmdb('movie/now_playing?page=1&region=FR'),
      tmdb('tv/on_the_air?page=1'),
    ]);

    const trending = unique([
      ...trendingMovies.map((item: any) => format(item, 'movie')),
      ...trendingTv.map((item: any) => format(item, 'tv')),
    ]).sort((a, b) => (Number(b.popularity) || 0) - (Number(a.popularity) || 0));

    const newReleases = unique([
      ...nowPlaying.map((item: any) => format(item, 'movie')),
      ...onAir.map((item: any) => format(item, 'tv')),
    ]).sort((a, b) => {
      const dateA = String(a.release_date || a.first_air_date || '');
      const dateB = String(b.release_date || b.first_air_date || '');
      return dateB.localeCompare(dateA);
    });

    return NextResponse.json({ trending: trending.slice(0, 30), newReleases: newReleases.slice(0, 30) });
  } catch (error) {
    console.error('Erreur flux Découvrir :', error);
    return NextResponse.json({ trending: [], newReleases: [] });
  }
}
