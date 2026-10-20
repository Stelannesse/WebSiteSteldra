/**
 * Rôle du fichier : API Genres : recherche des films ou séries TMDB selon les filtres reçus dans l'URL.
 */

import { NextResponse } from 'next/server';

const TMDB_API_KEY = process.env.TMDB_API_KEY;

const TMDB_GENRES: Record<string, number> = {
  Action: 28,
  Aventure: 12,
  Animation: 16,
  Comédie: 35,
  Crime: 80,
  Documentaire: 99,
  Drame: 18,
  Famille: 10751,
  Fantastique: 14,
  Histoire: 36,
  Horreur: 27,
  Musique: 10402,
  Mystère: 9648,
  Romance: 10749,
  'Science-fiction': 878,
  Thriller: 53,
  Guerre: 10752,
  Western: 37,
};

const TMDB_KEYWORD_SEARCH: Record<string, string[]> = {
  BL: ['gay relationship', 'gay romance', 'gay'],
  GL: ['lesbian relationship', 'lesbian romance', 'lesbian'],
  'Super-héros': ['superhero'],
  Vampires: ['vampire'],
  Zombies: ['zombie'],
  Noël: ['christmas'],
  'Arts martiaux': ['martial arts'],
  Espace: ['space'],
  'Voyage dans le temps': ['time travel'],
};

const MAL_GENRES: Record<string, number> = {
  Action: 1,
  Aventure: 2,
  Comédie: 4,
  Mystère: 7,
  Drame: 8,
  Fantastique: 10,
  Horreur: 14,
  Romance: 22,
  'Science-fiction': 24,
  GL: 26,
  BL: 28,
  Thriller: 41,
};

/** Convertit un résultat externe dans le format attendu par l'application. */
function format(item: any, type: 'movie' | 'tv') {
  const title = type === 'movie' ? item.title || item.original_title : item.name || item.original_name;
  if (!item?.id || !title) return null;
  const date = item.release_date || item.first_air_date || '';
  const countries = item.origin_country || [];
  const isAnimation = Array.isArray(item.genre_ids) && item.genre_ids.includes(16);
  const isAsian = Array.isArray(countries) && countries.some((c: string) => ['JP','KR','TW','CN','TH'].includes(c));
  const finalType = type === 'movie' ? 'movie' : isAnimation ? 'anime' : isAsian ? 'drama' : 'tv';
  return {
    id: item.id,
    title,
    poster_path: item.poster_path || '',
    type: finalType,
    year: date ? Number(String(date).slice(0,4)) : null,
    release_date: type === 'movie' ? date || undefined : undefined,
    first_air_date: type === 'tv' ? date || undefined : undefined,
    genre_ids: item.genre_ids || [],
    genres: (item.genre_ids || []).map((id: number) => Object.entries(TMDB_GENRES).find(([, value]) => value === id)?.[0]).filter(Boolean),
    rating: typeof item.vote_average === 'number' ? item.vote_average : null,
  };
}

async function tmdb(path: string) {
  if (!TMDB_API_KEY) return [];
  const separator = path.includes('?') ? '&' : '?';
  const r = await fetch(
    `https://api.themoviedb.org/3/${path}${separator}api_key=${encodeURIComponent(TMDB_API_KEY)}`,
    { next: { revalidate: 1800 } },
  );
  if (!r.ok) return [];
  const data = await r.json();
  return data.results || [];
}

/** Traite la requête HTTP GET, valide ses paramètres puis renvoie une réponse JSON. */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const rawGenres = searchParams.get('genres') || searchParams.get('genre') || 'Action';
  const genres = Array.from(new Set(rawGenres.split(',').map(value => value.trim()).filter(Boolean)));
  const page = Math.max(1, Number(searchParams.get('page')) || 1);
  if (!TMDB_API_KEY) return NextResponse.json({ results: [] });

  const normalGenres = genres.filter(genre => Boolean(TMDB_GENRES[genre]));
  const keywordCategories = genres.filter(genre => Boolean(TMDB_KEYWORD_SEARCH[genre]));
  const unsupported = genres.filter(genre => !TMDB_GENRES[genre] && !TMDB_KEYWORD_SEARCH[genre]);
  if (unsupported.length) return NextResponse.json({ results: [] });

  const findKeywordId = async (category: string): Promise<number | null> => {
    const terms = TMDB_KEYWORD_SEARCH[category] || [];
    for (const term of terms) {
      try {
        const r = await fetch(`https://api.themoviedb.org/3/search/keyword?api_key=${encodeURIComponent(TMDB_API_KEY)}&query=${encodeURIComponent(term)}&page=1`, { next: { revalidate: 86400 } });
        if (!r.ok) continue;
        const data = await r.json();
        const list = Array.isArray(data.results) ? data.results : [];
        const exact = list.find((item: any) => String(item?.name || '').toLowerCase() === term.toLowerCase());
        const close = list.find((item: any) => String(item?.name || '').toLowerCase().includes(term.toLowerCase()));
        const chosen = exact || close || list[0];
        if (chosen?.id) return Number(chosen.id);
      } catch {}
    }
    return null;
  };

  try {
    const keywordIds = (await Promise.all(keywordCategories.map(findKeywordId))).filter((id): id is number => Boolean(id));
    if (keywordIds.length !== keywordCategories.length) return NextResponse.json({ results: [] });

    const params = new URLSearchParams({
      api_key: TMDB_API_KEY,
      language: 'fr-FR',
      sort_by: 'popularity.desc',
      include_adult: 'false',
      'vote_count.gte': '20',
      page: String(page),
    });
    if (normalGenres.length) params.set('with_genres', normalGenres.map(genre => TMDB_GENRES[genre]).join(','));
    if (keywordIds.length) params.set('with_keywords', keywordIds.join(','));

    const [movies, tv] = await Promise.all([
      tmdb(`discover/movie?${params.toString()}`),
      tmdb(`discover/tv?${params.toString()}`),
    ]);

    const merged = [
      ...movies.map((x: any) => format(x, 'movie')),
      ...tv.map((x: any) => format(x, 'tv')),
    ].filter(Boolean) as any[];

    // Pour BL/GL, on complète aussi avec les anime correspondants afin de ne pas
    // exclure les œuvres japonaises lorsque l'utilisateur veut ce thème.
    if (genres.includes('BL') || genres.includes('GL')) {
      const malIds = genres.map(genre => MAL_GENRES[genre]).filter(Boolean);
      if (malIds.length > 0) {
        try {
          const r = await fetch(`https://api.jikan.moe/v4/anime?genres=${malIds.join(',')}&order_by=score&sort=desc&limit=16&page=${page}`);
          if (r.ok) {
            const data = await r.json();
            for (const anime of data.data || []) {
              merged.push({
                id: `jikan_${anime.mal_id}`,
                title: anime.title_english || anime.title,
                poster_path: anime.images?.jpg?.large_image_url || anime.images?.jpg?.image_url || '',
                type: 'anime',
                episodes: anime.episodes || 0,
                seasons: 1,
                genres,
                rating: typeof anime.score === 'number' ? anime.score : null,
                year: anime.year || null,
              });
            }
          }
        } catch {}
      }
    }

    const unique = new Map<string, any>();
    for (const item of merged) {
      const key = `${item.type}_${item.id}`;
      if (!unique.has(key)) unique.set(key, item);
    }
    const final = [...unique.values()];
    final.sort((a,b) => (Number(b.rating)||0) - (Number(a.rating)||0));
    return NextResponse.json({ results: final.slice(0, 40) });
  } catch (error) {
    console.error('Erreur découverte par genre :', error);
    return NextResponse.json({ results: [] });
  }
}
