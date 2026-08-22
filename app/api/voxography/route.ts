import { NextResponse } from 'next/server';

const WIKI_API = 'https://fr.wikipedia.org/w/api.php';

type MediaKind = 'Film' | "Film d'animation" | 'Série' | "Série d'animation" | 'Jeu vidéo' | 'Autre';
type VoxographyItem = {
  title: string;
  year?: number | null;
  role?: string;
  dubbedActor?: string;
  category: MediaKind;
  sourceUrl: string;
};

const normalize = (value = '') => value
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .toLocaleLowerCase('fr')
  .replace(/[’‘`]/g, "'")
  .replace(/\s+/g, ' ')
  .trim();

const decodeHtml = (value = '') => value
  .replace(/&nbsp;|&#160;/gi, ' ')
  .replace(/&amp;/gi, '&')
  .replace(/&quot;/gi, '"')
  .replace(/&#39;|&apos;/gi, "'")
  .replace(/&lt;/gi, '<')
  .replace(/&gt;/gi, '>')
  .replace(/&#x([0-9a-f]+);/gi, (_, hex) => String.fromCodePoint(parseInt(hex, 16)))
  .replace(/&#(\d+);/g, (_, dec) => String.fromCodePoint(Number(dec)));

const stripHtml = (value = '') => decodeHtml(value)
  .replace(/<script[\s\S]*?<\/script>/gi, ' ')
  .replace(/<style[\s\S]*?<\/style>/gi, ' ')
  .replace(/<br\s*\/?>/gi, ' ')
  .replace(/<[^>]+>/g, ' ')
  .replace(/\s+/g, ' ')
  .trim();

const slugify = (name: string) => normalize(name)
  .replace(/['’]/g, '')
  .replace(/[^a-z0-9]+/g, '-')
  .replace(/^-+|-+$/g, '');

const categoryFromText = (value = ''): MediaKind => {
  const n = normalize(value);
  if (n.includes('jeu video')) return 'Jeu vidéo';
  if (n.includes("film d'animation") || n.includes('film animation')) return "Film d'animation";
  if (n.includes("serie d'animation") || n.includes('serie animation')) return "Série d'animation";
  if (n.includes('film')) return 'Film';
  if (n.includes('serie') || n.includes('television')) return 'Série';
  return 'Autre';
};

const noisyRole = (value = '') => {
  const n = normalize(value);
  if (!n) return true;
  return [
    'voix additionnelle', 'voix additionnelles', 'voix diverses', 'voix supplementaire',
    'voix supplementaires', 'personnages divers', 'plusieurs personnages', 'plusieurs voix',
    'direction artistique', 'adaptation', 'figurant', 'figurante'
  ].some((term) => n.includes(term));
};

const dedupe = (items: VoxographyItem[]) => {
  const map = new Map<string, VoxographyItem>();
  for (const item of items) {
    if (!item.title || noisyRole(item.role || '')) continue;
    const key = [normalize(item.title), normalize(item.role || ''), normalize(item.dubbedActor || ''), item.year || ''].join('|');
    if (!map.has(key)) map.set(key, item);
  }
  return [...map.values()].sort((a, b) => {
    const categoryOrder: Record<MediaKind, number> = { 'Film': 0, "Film d'animation": 1, 'Série': 2, "Série d'animation": 3, 'Jeu vidéo': 4, 'Autre': 5 };
    return categoryOrder[a.category] - categoryOrder[b.category]
      || String(b.year || 0).localeCompare(String(a.year || 0))
      || a.title.localeCompare(b.title, 'fr', { sensitivity: 'base' });
  });
};

const parseLavf = (html: string, sourceUrl: string): VoxographyItem[] => {
  // laVF contient une table structurée "Oeuvre / Personnage / Acteur / Info / Type / Année".
  // On lit uniquement cette table : pas de scan de centaines de pages, pas d'heuristique sur des paragraphes.
  const items: VoxographyItem[] = [];
  const rows = html.match(/<tr\b[\s\S]*?<\/tr>/gi) || [];

  for (const row of rows) {
    const cells = [...row.matchAll(/<(?:td|th)\b[^>]*>([\s\S]*?)<\/(?:td|th)>/gi)]
      .map((match) => stripHtml(match[1]))
      .filter((cell) => cell.length > 0);
    if (cells.length < 5) continue;

    const joined = normalize(cells.join(' | '));
    if (joined.includes('oeuvre') && joined.includes('personnage') && joined.includes('annee')) continue;

    let typeIndex = -1;
    for (let i = 0; i < cells.length; i += 1) {
      const cat = categoryFromText(cells[i]);
      if (cat !== 'Autre') { typeIndex = i; break; }
    }
    if (typeIndex < 0) continue;

    const yearCell = cells.find((cell, index) => index > typeIndex && /^(?:19|20)\d{2}$/.test(cell.trim()));
    const year = yearCell ? Number(yearCell.trim()) : null;
    const category = categoryFromText(cells[typeIndex]);

    // Dans la table laVF, les 3 premières colonnes utiles sont oeuvre / personnage / acteur.
    const title = cells[0]?.trim() || '';
    const role = cells[1]?.trim() || '';
    const dubbedActor = cells[2] && !/^[-—]$/.test(cells[2].trim()) ? cells[2].trim() : '';
    const info = cells[typeIndex - 1] || '';

    if (!title || title.length > 160 || !role || noisyRole(role)) continue;
    if (info && !normalize(info).includes('voix') && !normalize(info).includes('creation')) continue;

    items.push({
      title,
      year,
      role,
      dubbedActor: dubbedActor || undefined,
      category,
      sourceUrl,
    });
  }

  return dedupe(items);
};

const fetchLavf = async (name: string) => {
  const sourceUrl = `https://lavf.fr/comedien/${slugify(name)}`;
  const response = await fetch(sourceUrl, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (compatible; STELDRA/1.0)',
      'Accept-Language': 'fr-FR,fr;q=0.9',
    },
    next: { revalidate: 21600 },
  });
  if (!response.ok) return { items: [] as VoxographyItem[], sourceUrl: '' };
  const html = await response.text();
  return { items: parseLavf(html, sourceUrl), sourceUrl };
};

const cleanWiki = (value = '') => stripHtml(value)
  .replace(/\{\{[^{}]*\}\}/g, ' ')
  .replace(/\[\[(?:[^\]|]+\|)?([^\]]+)\]\]/g, '$1')
  .replace(/'{2,}/g, '')
  .replace(/\s+/g, ' ')
  .trim();

const parseWikiPersonal = (wikitext: string, sourceUrl: string): VoxographyItem[] => {
  const items: VoxographyItem[] = [];
  let category: MediaKind = 'Autre';
  let dubbedActor = '';
  for (const raw of wikitext.split(/\r?\n/)) {
    const line = raw.trim();
    const heading = line.match(/^={2,6}\s*(.*?)\s*={2,6}$/);
    if (heading) {
      category = categoryFromText(cleanWiki(heading[1]));
      dubbedActor = '';
      continue;
    }
    const bullet = line.match(/^(\*+)\s*(.*)$/);
    if (!bullet) continue;
    const content = cleanWiki(bullet[2]);
    if (!content) continue;

    if (bullet[1].length === 1 && /:\s*$/.test(content) && !/(?:19|20)\d{2}/.test(content)) {
      const candidate = content.replace(/\s+dans\s*:\s*$/i, '').replace(/:\s*$/, '').trim();
      if (candidate && categoryFromText(candidate) === 'Autre') { dubbedActor = candidate; continue; }
    }

    const yearMatch = content.match(/\((19\d{2}|20\d{2})\)/) || content.match(/^\s*(19\d{2}|20\d{2})\s*:/);
    const year = yearMatch ? Number(yearMatch[1]) : null;
    const colon = content.indexOf(':');
    if (colon < 1) continue;
    let title = content.slice(0, colon).replace(/^\s*(?:19|20)\d{2}\s*:\s*/, '').replace(/\s*\((?:19|20)\d{2}\)\s*$/, '').trim();
    let role = content.slice(colon + 1).trim();
    if (!title || !role || noisyRole(role)) continue;
    items.push({ title, year, role, dubbedActor: dubbedActor || undefined, category, sourceUrl });
  }
  return dedupe(items);
};

const fetchWikipediaFallback = async (name: string) => {
  const search = await fetch(`${WIKI_API}?action=query&list=search&srsearch=${encodeURIComponent(`intitle:"${name}"`)}&srlimit=5&format=json&origin=*`, { next: { revalidate: 21600 } });
  if (!search.ok) return { items: [] as VoxographyItem[], sourceUrl: '' };
  const data = await search.json();
  const title = data?.query?.search?.find((item: any) => normalize(item.title) === normalize(name))?.title || data?.query?.search?.[0]?.title;
  if (!title) return { items: [] as VoxographyItem[], sourceUrl: '' };
  const sourceUrl = `https://fr.wikipedia.org/wiki/${encodeURIComponent(String(title).replace(/ /g, '_'))}`;

  const sectionsResponse = await fetch(`${WIKI_API}?action=parse&page=${encodeURIComponent(title)}&prop=sections&format=json&origin=*`, { next: { revalidate: 21600 } });
  if (!sectionsResponse.ok) return { items: [] as VoxographyItem[], sourceUrl };
  const sections = (await sectionsResponse.json())?.parse?.sections || [];
  const root = sections.find((section: any) => {
    const n = normalize(section.line || '');
    return n === 'doublage' || n.includes('voxographie');
  });
  if (!root) return { items: [] as VoxographyItem[], sourceUrl };

  const textResponse = await fetch(`${WIKI_API}?action=parse&page=${encodeURIComponent(title)}&prop=wikitext&section=${encodeURIComponent(root.index)}&format=json&origin=*`, { next: { revalidate: 21600 } });
  if (!textResponse.ok) return { items: [] as VoxographyItem[], sourceUrl };
  const wiki = await textResponse.json();
  return { items: parseWikiPersonal(wiki?.parse?.wikitext?.['*'] || '', sourceUrl), sourceUrl };
};

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const name = searchParams.get('name')?.trim();
  if (!name || name.length < 2) return NextResponse.json({ items: [], source: null, provider: null });

  try {
    const lavf = await fetchLavf(name).catch(() => ({ items: [] as VoxographyItem[], sourceUrl: '' }));
    if (lavf.items.length) {
      return NextResponse.json({
        items: lavf.items,
        count: lavf.items.length,
        source: lavf.sourceUrl,
        provider: 'laVF.fr',
      }, { headers: { 'Cache-Control': 'public, s-maxage=21600, stale-while-revalidate=86400' } });
    }

    const wiki = await fetchWikipediaFallback(name).catch(() => ({ items: [] as VoxographyItem[], sourceUrl: '' }));
    return NextResponse.json({
      items: wiki.items,
      count: wiki.items.length,
      source: wiki.sourceUrl || null,
      provider: wiki.items.length ? 'Wikipédia' : null,
    }, { headers: { 'Cache-Control': 'public, s-maxage=21600, stale-while-revalidate=86400' } });
  } catch (error) {
    console.error('Erreur voxographie V55 :', error);
    return NextResponse.json({ items: [], source: null, provider: null });
  }
}
