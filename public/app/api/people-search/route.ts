import { NextResponse } from 'next/server';

const TMDB_API_KEY = process.env.TMDB_API_KEY;
const IMAGE_BASE = 'https://image.tmdb.org/t/p/w185';

type MediaType = 'movie' | 'tv' | 'anime' | 'drama';

type PersonResult = {
  id: number;
  name: string;
  profile_path: string;
  department: string;
  known_for: string[];
};

const fetchTmdb = async (url: string) => {
  const response = await fetch(url, { next: { revalidate: 3600 } });
  if (!response.ok) return null;
  return response.json();
};

const classifyType = (item: any): MediaType => {
  if (item.media_type === 'movie') return 'movie';
  const isAnimation = Array.isArray(item.genre_ids) && item.genre_ids.includes(16);
  const countries = Array.isArray(item.origin_country) ? item.origin_country : [];
  const isAsian = countries.some((country: string) => ['JP', 'KR', 'TW', 'CN', 'TH'].includes(country));
  if (isAnimation) return 'anime';
  if (isAsian) return 'drama';
  return 'tv';
};

const formatCredit = (item: any, type: MediaType, role: string) => {
  const title = type === 'movie' ? item.title || item.original_title : item.name || item.original_name;
  if (!item?.id || !title) return null;
  const date = item.release_date || item.first_air_date || '';
  return {
    id: item.id,
    title,
    poster_path: item.poster_path || '',
    type,
    year: date ? Number(String(date).slice(0, 4)) : null,
    release_date: date || undefined,
    recommendation_reason: role.startsWith('Réalisé') ? 'director' : 'cast',
    recommendation_label: role,
  };
};

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const query = searchParams.get('q')?.trim();
  const personId = searchParams.get('id')?.trim();

  if (!TMDB_API_KEY) return NextResponse.json({ people: [], results: [] });

  try {
    if (personId) {
      const [person, credits] = await Promise.all([
        fetchTmdb(`https://api.themoviedb.org/3/person/${personId}?api_key=${TMDB_API_KEY}&language=fr-FR`),
        fetchTmdb(`https://api.themoviedb.org/3/person/${personId}/combined_credits?api_key=${TMDB_API_KEY}&language=fr-FR`),
      ]);

      if (!person || !credits) return NextResponse.json({ person: null, results: [] });

      const items: any[] = [];
      const isDirector = person.known_for_department === 'Directing';

      if (!isDirector) {
        (credits.cast || []).forEach((credit: any) => {
          if (credit.media_type === 'movie' || credit.media_type === 'tv') {
            const formatted = formatCredit(credit, classifyType(credit), `Avec ${person.name}`);
            if (formatted) items.push(formatted);
          }
        });
      }

      (credits.crew || []).forEach((credit: any) => {
        if ((credit.media_type === 'movie' || credit.media_type === 'tv') && credit.job === 'Director') {
          const formatted = formatCredit(credit, classifyType(credit), `Réalisé par ${person.name}`);
          if (formatted) items.push(formatted);
        }
      });

      const unique = new Map<string, any>();
      items
        .sort((a, b) => (b.release_date || '').localeCompare(a.release_date || ''))
        .forEach((item) => {
          const key = `${item.type}_${item.id}`;
          if (!unique.has(key)) unique.set(key, item);
        });

      return NextResponse.json({
        person: {
          id: person.id,
          name: person.name,
          profile_path: person.profile_path ? `${IMAGE_BASE}${person.profile_path}` : '',
          department: person.known_for_department === 'Directing' ? 'Réalisation' : 'Interprétation',
          biography: person.biography || '',
        },
        results: Array.from(unique.values()).slice(0, 80),
      });
    }

    if (!query || query.length < 2) return NextResponse.json({ people: [] });

    const data = await fetchTmdb(
      `https://api.themoviedb.org/3/search/person?api_key=${TMDB_API_KEY}&language=fr-FR&query=${encodeURIComponent(query)}&include_adult=false&page=1`
    );

    const people: PersonResult[] = (data?.results || [])
      .filter((person: any) => person.known_for_department === 'Acting' || person.known_for_department === 'Directing')
      .slice(0, 8)
      .map((person: any) => ({
        id: person.id,
        name: person.name,
        profile_path: person.profile_path ? `${IMAGE_BASE}${person.profile_path}` : '',
        department: person.known_for_department === 'Directing' ? 'Réalisateur / réalisatrice' : 'Acteur / actrice',
        known_for: (person.known_for || [])
          .map((item: any) => item.title || item.name)
          .filter(Boolean)
          .slice(0, 3),
      }));

    return NextResponse.json({ people });
  } catch (error) {
    console.error('Erreur recherche personnes TMDB :', error);
    return NextResponse.json({ people: [], results: [] });
  }
}
