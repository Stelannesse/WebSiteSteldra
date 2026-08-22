import { NextResponse } from 'next/server';

const WIKI_API = 'https://fr.wikipedia.org/w/api.php';
const TMDB_API_KEY = process.env.TMDB_API_KEY;
const IMAGE_BASE = 'https://image.tmdb.org/t/p/w185';

const normalize = (value = '') => value
  .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
  .toLocaleLowerCase('fr').replace(/[^a-z0-9]+/g, ' ').trim();

const cleanText = (value = '') => value
  .replace(/<ref[^>]*>[\s\S]*?<\/ref>/gi, '')
  .replace(/<ref[^/>]*\/>/gi, '')
  .replace(/\{\{[^{}]*\}\}/g, '')
  .replace(/'''?/g, '')
  .replace(/\[\[([^\]|]+)\|([^\]]+)\]\]/g, '$2')
  .replace(/\[\[([^\]]+)\]\]/g, '$1')
  .replace(/\s+/g, ' ').trim();

const fetchJson = async (url: string) => {
  const response = await fetch(url, {
    headers: { 'User-Agent': 'STELDRA/1.0 (French voice enrichment)' },
    next: { revalidate: 21600 },
  });
  if (!response.ok) return null;
  return response.json();
};

const findWikipediaPage = async (name: string) => {
  const search = await fetchJson(`${WIKI_API}?action=query&list=search&srsearch=${encodeURIComponent(`intitle:"${name}"`)}&srlimit=6&format=json&origin=*`);
  const results = search?.query?.search || [];
  const target = normalize(name);
  const exact = results.find((item: any) => normalize(item.title) === target);
  return (exact || results[0])?.title || null;
};

const tmdbPerson = async (name: string) => {
  if (!TMDB_API_KEY) return null;
  const data = await fetchJson(`https://api.themoviedb.org/3/search/person?api_key=${TMDB_API_KEY}&language=fr-FR&include_adult=false&query=${encodeURIComponent(name)}`);
  const target = normalize(name);
  const results = data?.results || [];
  const exact = results.find((p: any) => normalize(p.name || '') === target) || results[0];
  if (!exact) return null;
  return { tmdb_id: exact.id, profile_path: exact.profile_path ? `${IMAGE_BASE}${exact.profile_path}` : '' };
};

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const name = searchParams.get('name')?.trim();
  if (!name || name.length < 2) return NextResponse.json({ voices: [], source: null });

  try {
    const title = await findWikipediaPage(name);
    if (!title) return NextResponse.json({ voices: [], source: null });
    const parsed = await fetchJson(`${WIKI_API}?action=parse&page=${encodeURIComponent(title)}&prop=wikitext&format=json&origin=*`);
    const wikitext = parsed?.parse?.wikitext?.['*'] || '';
    const source = `https://fr.wikipedia.org/wiki/${encodeURIComponent(title.replace(/ /g, '_'))}`;
    const candidates: { name:string; note:string; priority:number }[] = [];

    for (const chunk of wikitext.split(/\n{2,}/)) {
      const plain = cleanText(chunk);
      const n = normalize(plain);
      if (!(n.includes('voix francaise') || n.includes('double regulierement') || n.includes('doublage francais') || n.includes('double principalement') || n.includes('double habituellement'))) continue;
      if (n.includes('quebec') && !n.includes('france')) continue;
      const links = [...chunk.matchAll(/\[\[([^\]|#]+)(?:#[^\]|]+)?(?:\|([^\]]+))?\]\]/g)]
        .map(m => cleanText(m[2] || m[1]))
        .filter(Boolean)
        .filter(label => normalize(label) !== normalize(name));
      const priority = /voix francaise regulier|voix francaise habituel|voix francaise principal|double regulierement/.test(n) ? 3 : 2;
      for (const label of links) {
        if (/film|serie|saison|episode|personnage|france|quebec|cinema|television/.test(normalize(label))) continue;
        candidates.push({ name: label, note: plain.slice(0, 260), priority });
      }
    }

    const byName = new Map<string, { name:string; note:string; priority:number }>();
    for (const item of candidates) {
      const key = normalize(item.name);
      const current = byName.get(key);
      if (!current || item.priority > current.priority) byName.set(key, item);
    }
    const selected = [...byName.values()].sort((a,b) => b.priority-a.priority || a.name.localeCompare(b.name,'fr')).slice(0,6);
    const voices = await Promise.all(selected.map(async item => ({ ...item, ...(await tmdbPerson(item.name) || {}) })));
    return NextResponse.json({ voices, source, wikipediaTitle: title });
  } catch (error) {
    console.error('Erreur voix françaises principales :', error);
    return NextResponse.json({ voices: [], source: null });
  }
}
