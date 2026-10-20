/**
 * Rôle du fichier : API Personnalités : recherche acteurs, réalisateurs et comédiens de doublage, puis rassemble leurs crédits.
 */

import { NextResponse } from 'next/server';

const TMDB_API_KEY = process.env.TMDB_API_KEY;
const IMAGE_BASE = 'https://image.tmdb.org/t/p/w342';

type MediaType = 'movie' | 'tv';

type CreditLike = {
  id?: number;
  media_type?: string;
  title?: string;
  original_title?: string;
  name?: string;
  original_name?: string;
  poster_path?: string;
  release_date?: string;
  first_air_date?: string;
  character?: string;
  job?: string;
  genre_ids?: number[];
  origin_country?: string[];
};

/** Interroge TMDB et lève une erreur explicite si la réponse échoue. */
const fetchTmdb = async (url: string) => {
  const response = await fetch(url, { next: { revalidate: 3600 } });
  if (!response.ok) return null;
  return response.json();
};

/** Détermine si un crédit correspond à un film ou à une série. */
const classifyType = (item: CreditLike): MediaType => item.media_type === 'movie' ? 'movie' : 'tv';

/** Détecte si le libellé d'un crédit correspond probablement à du doublage. */
const looksLikeVoiceRole = (credit: CreditLike) => {
  const values = [credit?.character, credit?.job]
    .map((value) => String(value || '').toLocaleLowerCase('fr'));
  return values.some((value) =>
    value.includes('voice') ||
    value.includes('voix') ||
    value.includes('doubl') ||
    value.includes('narrat')
  );
};

/** Indique si le crédit appartient au genre animation. */
const isAnimationCredit = (credit: CreditLike) => Array.isArray(credit.genre_ids) && credit.genre_ids.includes(16);

/** Construit l'URL complète d'une affiche TMDB. */
const resolvePoster = (poster?: string) => {
  const value = String(poster || '').trim();
  if (!value) return '';
  if (/^https?:\/\//i.test(value)) return value;
  return `${IMAGE_BASE}${value.startsWith('/') ? value : `/${value}`}`;
};

/** Convertit un crédit brut en œuvre affichable sur la page d'une personnalité. */
const formatCredit = (item: CreditLike, type: MediaType, role: string, creditKind: 'acting' | 'directing' | 'voice') => {
  const title = type === 'movie' ? item.title || item.original_title : item.name || item.original_name;
  if (!item?.id || !title) return null;
  const date = item.release_date || item.first_air_date || '';
  return {
    id: item.id,
    title,
    poster_path: resolvePoster(item.poster_path),
    type,
    year: date ? Number(String(date).slice(0, 4)) : null,
    release_date: date || undefined,
    recommendation_reason: creditKind,
    recommendation_label: role,
    character: item.character || '',
  };
};

/** Traduit le département TMDB d'une personnalité en catégorie métier. */
const mapDepartment = (department?: string) => {
  if (department === 'Directing') return 'Réalisateur / réalisatrice';
  if (department === 'Acting') return 'Acteur / actrice';
  if (department === 'Sound') return 'Voix / son';
  return department || 'Talent';
};

/** Convertit une personnalité TMDB dans le format interne de l'application. */
const mapPerson = (person: any) => ({
  id: person.id,
  name: person.name,
  profile_path: person.profile_path ? `${IMAGE_BASE}${person.profile_path}` : '',
  department: mapDepartment(person.known_for_department),
  known_for_department: person.known_for_department || '',
  popularity: Number(person.popularity) || 0,
  known_for: (person.known_for || []).map((item: any) => item.title || item.name).filter(Boolean).slice(0, 3),
});

/** Fusionne les crédits français et anglais en évitant les doublons. */
const mergeCredits = (frCredits: any, enCredits: any, personName: string) => {
  const items: any[] = [];
  const castFr = frCredits?.cast || [];
  const castEn = enCredits?.cast || [];
  const crewFr = frCredits?.crew || [];
  const crewEn = enCredits?.crew || [];

  const castById = new Map<number, { fr?: any; en?: any }>();
  [...castFr, ...castEn].forEach((credit) => {
    if (!credit?.id || (credit.media_type !== 'movie' && credit.media_type !== 'tv')) return;
    const current = castById.get(credit.id) || {};
    if ((credit.character || '').includes('(voice)') || (credit.character || '').includes('(Voice)')) current.en = credit;
    else if (!current.fr) current.fr = credit;
    else current.en = credit;
    castById.set(credit.id, current);
  });

  castById.forEach(({ fr, en }) => {
    const base = fr || en;
    if (!base) return;
    const voice = looksLikeVoiceRole(fr || {}) || looksLikeVoiceRole(en || {}) || isAnimationCredit(base);
    const character = (fr?.character || en?.character || '').trim();
    const label = voice
      ? `Voix : ${character || personName}`
      : character
        ? character
        : `Avec ${personName}`;
    const formatted = formatCredit(base, classifyType(base), label, voice ? 'voice' : 'acting');
    if (formatted) items.push(formatted);
  });

  [...crewFr, ...crewEn].forEach((credit: any) => {
    if ((credit.media_type === 'movie' || credit.media_type === 'tv') && ['Director', 'Series Director'].includes(credit.job)) {
      const formatted = formatCredit(credit, classifyType(credit), `Réalisé par ${personName}`, 'directing');
      if (formatted) items.push(formatted);
    }
  });

  const unique = new Map<string, any>();
  items
    .sort((a, b) => (b.release_date || '').localeCompare(a.release_date || ''))
    .forEach((item) => {
      const key = `${item.type}_${item.id}_${item.recommendation_reason}`;
      if (!unique.has(key)) unique.set(key, item);
    });

  return Array.from(unique.values());
};

/** Traite la requête HTTP GET, valide ses paramètres puis renvoie une réponse JSON. */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const query = searchParams.get('q')?.trim();
  const personId = searchParams.get('id')?.trim();
  const mode = searchParams.get('mode')?.trim();
  const page = Math.max(1, Number(searchParams.get('page') || '1'));

  if (!TMDB_API_KEY) return NextResponse.json({ people: [], results: [] });

  try {
    if (personId && mode === 'profile') {
      const person = await fetchTmdb(`https://api.themoviedb.org/3/person/${personId}?api_key=${TMDB_API_KEY}&language=fr-FR`);
      if (!person) return NextResponse.json({ person: null });
      return NextResponse.json({
        person: {
          id: person.id,
          name: person.name,
          profile_path: person.profile_path ? `${IMAGE_BASE}${person.profile_path}` : '',
          department: mapDepartment(person.known_for_department),
          known_for_department: person.known_for_department || '',
          biography: person.biography || '',
          birthday: person.birthday || '',
          deathday: person.deathday || '',
          place_of_birth: person.place_of_birth || '',
          popularity: Number(person.popularity) || 0,
        },
      });
    }

    if (personId && mode === 'credits') {
      const [person, creditsFr, creditsEn] = await Promise.all([
        fetchTmdb(`https://api.themoviedb.org/3/person/${personId}?api_key=${TMDB_API_KEY}&language=fr-FR`),
        fetchTmdb(`https://api.themoviedb.org/3/person/${personId}/combined_credits?api_key=${TMDB_API_KEY}&language=fr-FR`),
        fetchTmdb(`https://api.themoviedb.org/3/person/${personId}/combined_credits?api_key=${TMDB_API_KEY}&language=en-US`),
      ]);
      if (!person || !creditsFr) return NextResponse.json({ results: [], counts: { acting: 0, directing: 0, voice: 0 } });
      const results = mergeCredits(creditsFr, creditsEn, person.name);
      return NextResponse.json({
        results,
        counts: {
          acting: results.filter((item: any) => item.recommendation_reason === 'acting').length,
          directing: results.filter((item: any) => item.recommendation_reason === 'directing').length,
          voice: results.filter((item: any) => item.recommendation_reason === 'voice').length,
        },
      });
    }

    if (personId) {
      const [person, creditsFr, creditsEn] = await Promise.all([
        fetchTmdb(`https://api.themoviedb.org/3/person/${personId}?api_key=${TMDB_API_KEY}&language=fr-FR`),
        fetchTmdb(`https://api.themoviedb.org/3/person/${personId}/combined_credits?api_key=${TMDB_API_KEY}&language=fr-FR`),
        fetchTmdb(`https://api.themoviedb.org/3/person/${personId}/combined_credits?api_key=${TMDB_API_KEY}&language=en-US`),
      ]);

      if (!person || !creditsFr) return NextResponse.json({ person: null, results: [] });

      const results = mergeCredits(creditsFr, creditsEn, person.name);
      return NextResponse.json({
        person: {
          id: person.id,
          name: person.name,
          profile_path: person.profile_path ? `${IMAGE_BASE}${person.profile_path}` : '',
          department: mapDepartment(person.known_for_department),
          known_for_department: person.known_for_department || '',
          biography: person.biography || '',
          birthday: person.birthday || '',
          deathday: person.deathday || '',
          place_of_birth: person.place_of_birth || '',
          popularity: Number(person.popularity) || 0,
          acting_count: results.filter((item: any) => item.recommendation_reason === 'acting').length,
          directing_count: results.filter((item: any) => item.recommendation_reason === 'directing').length,
          voice_count: results.filter((item: any) => item.recommendation_reason === 'voice').length,
        },
        results,
      });
    }

    if (mode === 'popular') {
      const data = await fetchTmdb(`https://api.themoviedb.org/3/person/popular?api_key=${TMDB_API_KEY}&language=fr-FR&page=${page}`);
      const people = (data?.results || [])
        .filter((person: any) => Boolean(person?.id && person?.profile_path))
        .slice(0, 18)
        .map(mapPerson);
      return NextResponse.json({ people, page });
    }

    if (!query || query.length < 2) return NextResponse.json({ people: [] });

    const data = await fetchTmdb(`https://api.themoviedb.org/3/search/person?api_key=${TMDB_API_KEY}&language=fr-FR&query=${encodeURIComponent(query)}&include_adult=false&page=1`);
    const people = (data?.results || [])
      .filter((person: any) => Boolean(person?.id && person?.profile_path))
      .slice(0, 18)
      .map(mapPerson);

    return NextResponse.json({ people });
  } catch (error) {
    console.error('Erreur recherche personnes TMDB :', error);
    return NextResponse.json({ people: [], results: [] });
  }
}
