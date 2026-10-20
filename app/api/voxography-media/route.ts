/**
 * Rôle du fichier : API Correspondance voxographie : rapproche un titre de doublage d'un média TMDB grâce à un score de similarité.
 */

import { NextResponse } from 'next/server';

const TMDB_API_KEY = process.env.TMDB_API_KEY;
const IMG = 'https://image.tmdb.org/t/p/w500';

/** Retire les variations d'accents, de casse et d'espaces pour faciliter les comparaisons. */
const normalize = (value = '') => value
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .toLocaleLowerCase('fr')
  .replace(/[^a-z0-9]+/g, ' ')
  .replace(/\s+/g, ' ')
  .trim();

/** Mesure la ressemblance entre deux titres normalisés. */
const similarity = (a = '', b = '') => {
  const aa = normalize(a);
  const bb = normalize(b);
  if (!aa || !bb) return 0;
  if (aa === bb) return 1;
  if (aa.includes(bb) || bb.includes(aa)) return .88;
  const aw = new Set(aa.split(' '));
  const bw = new Set(bb.split(' '));
  const shared = [...aw].filter((word) => bw.has(word)).length;
  return shared / Math.max(aw.size, bw.size, 1);
};

/** Traite la requête HTTP GET, valide ses paramètres puis renvoie une réponse JSON. */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const title = searchParams.get('title')?.trim() || '';
  const year = Number(searchParams.get('year') || 0) || null;
  const category = searchParams.get('category') || '';

  if (!TMDB_API_KEY || title.length < 2 || category === 'Jeu vidéo') {
    return NextResponse.json({ media: null });
  }

  try {
    const params = new URLSearchParams({ api_key: TMDB_API_KEY, language: 'fr-FR', query: title, include_adult: 'false', page: '1' });
    const response = await fetch(`https://api.themoviedb.org/3/search/multi?${params.toString()}`, { next: { revalidate: 86400 } });
    if (!response.ok) return NextResponse.json({ media: null });
    const data = await response.json();

    const preferTv = category === 'Série' || category === "Série d'animation";
    const preferMovie = category === 'Film' || category === "Film d'animation";
    const candidates = (data?.results || [])
      .filter((item: any) => item?.id && (item.media_type === 'movie' || item.media_type === 'tv'))
      .map((item: any) => {
        const itemTitle = item.title || item.name || item.original_title || item.original_name || '';
        const itemYear = Number(String(item.release_date || item.first_air_date || '').slice(0,4)) || null;
        let score = similarity(title, itemTitle);
        if (preferTv && item.media_type === 'tv') score += .12;
        if (preferMovie && item.media_type === 'movie') score += .12;
        if (year && itemYear) {
          const gap = Math.abs(year - itemYear);
          if (gap === 0) score += .18;
          else if (gap <= 2) score += .08;
          else if (gap >= 6) score -= .12;
        }
        return { item, itemTitle, itemYear, score };
      })
      .sort((a: any,b: any) => b.score - a.score);

    const best = candidates[0];
    if (!best || best.score < .62) return NextResponse.json({ media: null });
    return NextResponse.json({ media: {
      id: best.item.id,
      type: best.item.media_type as 'movie'|'tv',
      title: best.itemTitle,
      year: best.itemYear,
      poster_path: best.item.poster_path ? `${IMG}${best.item.poster_path}` : '',
    }}, { headers: { 'Cache-Control': 'public, s-maxage=86400, stale-while-revalidate=604800' } });
  } catch {
    return NextResponse.json({ media: null });
  }
}
