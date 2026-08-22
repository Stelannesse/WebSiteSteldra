'use client';

import { FormEvent, useEffect, useMemo, useState } from 'react';
import MainNav from '../components/mainNav';
import MediaCard from '../components/mediaCard';
import { createClient } from '../lib/supabase';
import { fetchAllPages } from '../lib/supabasePaging';
import type { MediaItem, MyListItem, WatchStatus } from '../types/media';
import styles from '../page.module.css';

type ExploreItem = MediaItem & {
  recommendation_label?: string;
  recommendation_reason?: string;
  collection_id?: number;
  popularity?: number;
};
type PersonSearchResult = { id: number; name: string; profile_path: string; department: string; known_for: string[] };
type SelectedPerson = { id: number; name: string; profile_path: string; department: string; biography?: string };
type MediaFilter = 'all' | 'movie' | 'tv' | 'drama' | 'anime';
type SortMode = 'popular' | 'rating' | 'recent';

const keyOf = (m: MediaItem) => `${m.type}_${m.id}`;

const GENRE_CHOICES = [
  'Action','Aventure','Animation','Comédie','Crime','Documentaire','Drame','Famille',
  'Fantastique','Histoire','Horreur','Musique','Mystère','Romance','Science-fiction',
  'Thriller','Guerre','Western','BL','GL','Super-héros','Vampires','Zombies','Noël',
  'Arts martiaux','Espace','Voyage dans le temps',
];

const GENRE_ICONS: Record<string, string> = {
  Action: '✦', Aventure: '⌁', Animation: '◈', 'Comédie': '☺', Crime: '◇', Documentaire: '▤',
  Drame: '◐', Famille: '⌂', Fantastique: '✧', Histoire: '⌛', Horreur: '◌', Musique: '♫',
  'Mystère': '◒', Romance: '♡', 'Science-fiction': '◉', Thriller: '◆', Guerre: '⚑', Western: '☆',
  BL: '♂', GL: '♀', 'Super-héros': '⚡', Vampires: '♢', Zombies: '☣', 'Noël': '❄',
  'Arts martiaux': '✥', Espace: '☾', 'Voyage dans le temps': '◷',
};

export default function ExplorePage() {
  const [supabase] = useState(() => createClient());
  const [myList, setMyList] = useState<Record<string, MyListItem>>({});
  const [recommendations, setRecommendations] = useState<ExploreItem[]>([]);
  const [trending, setTrending] = useState<ExploreItem[]>([]);
  const [newReleases, setNewReleases] = useState<ExploreItem[]>([]);
  const [loading, setLoading] = useState(true);

  const [mediaFilter, setMediaFilter] = useState<MediaFilter>('all');
  const [sortMode, setSortMode] = useState<SortMode>('popular');
  const [minimumRating, setMinimumRating] = useState(0);
  const [yearFilter, setYearFilter] = useState('all');
  const [advancedOpen, setAdvancedOpen] = useState(false);

  const [personQuery, setPersonQuery] = useState('');
  const [people, setPeople] = useState<PersonSearchResult[]>([]);
  const [personSearching, setPersonSearching] = useState(false);
  const [selectedPerson, setSelectedPerson] = useState<SelectedPerson | null>(null);
  const [personCredits, setPersonCredits] = useState<ExploreItem[]>([]);
  const [creditsLoading, setCreditsLoading] = useState(false);

  const [selectedGenres, setSelectedGenres] = useState<string[]>([]);
  const [genreScope, setGenreScope] = useState<'discover' | 'collection'>('discover');
  const [genreResults, setGenreResults] = useState<ExploreItem[]>([]);
  const [genreLoading, setGenreLoading] = useState(false);
  const [genrePage, setGenrePage] = useState(1);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const requested = params.get('genres');
    if (!requested) return;
    const values = requested.split(',').map((value) => value.trim()).filter(Boolean);
    if (values.length > 0) {
      setSelectedGenres(values);
    }
  }, []);

  const normalizeGenreLabel = (value: string) => {
    const v = value.trim().toLowerCase();
    if (['bl','boys love','boy love','yaoi','shounen ai','shounen-ai'].includes(v)) return 'BL';
    if (['gl','girls love',"girls' love",'girl love','yuri','shoujo ai','shoujo-ai'].includes(v)) return 'GL';
    const aliases: Record<string,string> = {
      comedy:'Comédie', comedie:'Comédie', drama:'Drame', drame:'Drame', horror:'Horreur',
      horreur:'Horreur', fantasy:'Fantastique', fantastique:'Fantastique', romance:'Romance',
      action:'Action', adventure:'Aventure', aventure:'Aventure', thriller:'Thriller', crime:'Crime',
      mystery:'Mystère', mystere:'Mystère', animation:'Animation', 'science fiction':'Science-fiction',
      'science-fiction':'Science-fiction', 'sci-fi':'Science-fiction',
    };
    return aliases[v] || value.trim();
  };

  const mediaGenres = (media: MediaItem) => Array.from(new Set([
    ...(media.genres || []).map(normalizeGenreLabel),
    ...(media.tags || []).filter((tag) => ['BL','GL'].includes(normalizeGenreLabel(tag))).map(normalizeGenreLabel),
  ]));

  const collectionGenreResults = useMemo(() => Object.values(myList)
    .map((item) => item.media)
    .filter((media) => selectedGenres.every((genre) => mediaGenres(media).includes(genre))), [myList, selectedGenres]);

  const activeGenreResults = genreScope === 'collection' ? collectionGenreResults : genreResults;

  const toggleGenre = (genre: string) => {
    setSelectedGenres((current) =>
      current.includes(genre)
        ? current.filter((item) => item !== genre)
        : [...current, genre]
    );
    setGenreScope('discover');
  };

  const loadGenre = async (genres = selectedGenres, page = 1) => {
    setGenreLoading(true);
    setGenrePage(page);
    try {
      const response = await fetch(`/api/discover-genre?genres=${encodeURIComponent(genres.join(','))}&page=${page}`);
      const payload = response.ok ? await response.json() : { results: [] };
      const unseen = (payload.results || []).filter((item: ExploreItem) => !myList[keyOf(item)]);
      setGenreResults(unseen);
    } catch {
      setGenreResults([]);
    } finally {
      setGenreLoading(false);
    }
  };

  useEffect(() => {
    if (genreScope === 'discover' && selectedGenres.length > 0) {
      void loadGenre(selectedGenres, 1);
    } else if (selectedGenres.length === 0) {
      setGenreResults([]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedGenres, genreScope]);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { window.location.href = '/login'; return; }

      const [{ data: progress }, { data: likes }, feedResponse] = await Promise.all([
        fetchAllPages<any>((from, to) => supabase.from('media_progress').select('*').eq('user_id', user.id).order('media_id', { ascending: true }).range(from, to)),
        supabase.from('media_reviews').select('media_id,media_type').eq('user_id', user.id).eq('rating', 'like').order('created_at', { ascending: false }).limit(8),
        fetch('/api/discover-feed').catch(() => null),
      ]);
      if (cancelled) return;

      const next: Record<string, MyListItem> = {};
      (progress || []).forEach((row: any) => {
        const media: MediaItem = { ...(row.media_data || {}), id: row.media_id, type: row.media_data?.type || row.media_type };
        next[keyOf(media)] = {
          media,
          status: row.status,
          watchCount: Number(row.watch_count) || 0,
          favorite: Boolean(row.media_data?.favorite),
          addedAt: row.created_at,
          lastInteractionAt: row.updated_at,
        };
      });
      setMyList(next);

      if (feedResponse?.ok) {
        const feed = await feedResponse.json();
        setTrending(feed.trending || []);
        setNewReleases(feed.newReleases || []);
      }

      const favoriteSeeds = (progress || [])
        .filter((row: any) => Boolean(row.media_data?.favorite) && !['manga','manhwa'].includes(row.media_type))
        .map((row: any) => ({ media_id: row.media_id, media_type: row.media_type }));
      const seedMap = new Map<string, any>();
      [...(likes || []), ...favoriteSeeds].forEach((seed: any) => {
        const seedKey = `${seed.media_type}_${seed.media_id}`;
        if (!seedMap.has(seedKey)) seedMap.set(seedKey, seed);
      });
      const seeds = [...seedMap.values()].slice(0, 6);
      const payloads = await Promise.all(seeds.map(async (seed: any) => {
        try {
          const response = await fetch(`/api/recommendations?id=${encodeURIComponent(seed.media_id)}&type=${encodeURIComponent(seed.media_type)}`);
          return response.ok ? (await response.json()).results || [] : [];
        } catch { return []; }
      }));
      const unique = new Map<string, ExploreItem>();
      payloads.flat().forEach((item: ExploreItem) => {
        const key = keyOf(item);
        if (!next[key] && !unique.has(key)) unique.set(key, item);
      });
      setRecommendations([...unique.values()]);
      setLoading(false);
    };
    void load();
    return () => { cancelled = true; };
  }, [supabase]);

  const saveStatus = async (media: MediaItem, status: WatchStatus) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const now = new Date().toISOString();
    const current = myList[keyOf(media)];
    const currentCount = Number(current?.watchCount) || (current?.status === 'vu' ? 1 : 0);
    const nextWatchCount = status === 'vu' ? Math.min(20, currentCount + 1) : status === 'a_voir' ? 0 : currentCount;
    const mediaData = {
      ...media,
      steldra_added_at: current?.addedAt || now,
      steldra_last_interaction_at: now,
      favorite: current?.favorite || false,
    };

    const { error } = await supabase.from('media_progress').upsert({
      user_id: user.id,
      media_id: String(media.id),
      media_type: media.type,
      status,
      media_data: mediaData,
      watch_count: nextWatchCount,
    }, { onConflict: 'user_id,media_id' });
    if (error) { console.error('Erreur sauvegarde depuis Découvrir :', error); return; }

    if (status === 'vu') {
      const { error: historyError } = await supabase.from('watch_history').insert({
        user_id: user.id,
        media_id: String(media.id),
        media_type: media.type,
        media_data: mediaData,
        watched_at: now,
      });
      if (historyError) console.error('Erreur historique depuis Découvrir :', historyError);
    }

    setMyList((value) => ({
      ...value,
      [keyOf(media)]: {
        media: mediaData,
        status,
        watchCount: nextWatchCount,
        favorite: current?.favorite || false,
        addedAt: current?.addedAt || now,
        lastInteractionAt: now,
      },
    }));
    window.dispatchEvent(new CustomEvent('steldra:progress-updated'));
  };

  const remove = async (media: MediaItem) => {
    const { data:{user} } = await supabase.auth.getUser();
    if (!user) return;
    await supabase.from('media_progress').delete().eq('user_id',user.id).eq('media_id',String(media.id)).eq('media_type',media.type);
    setMyList((value) => { const next = { ...value }; delete next[keyOf(media)]; return next; });
  };

  const searchPeople = async (event: FormEvent) => {
    event.preventDefault();
    const query = personQuery.trim();
    if (query.length < 2) return;
    setPersonSearching(true);
    setSelectedPerson(null);
    setPersonCredits([]);
    try {
      const response = await fetch(`/api/people-search?q=${encodeURIComponent(query)}`);
      const payload = response.ok ? await response.json() : { people: [] };
      setPeople(payload.people || []);
    } catch { setPeople([]); }
    finally { setPersonSearching(false); }
  };

  const openPerson = async (person: PersonSearchResult) => {
    setCreditsLoading(true);
    setSelectedPerson({ id: person.id, name: person.name, profile_path: person.profile_path, department: person.department });
    setPersonCredits([]);
    try {
      const response = await fetch(`/api/people-search?id=${person.id}`);
      const payload = response.ok ? await response.json() : { person: null, results: [] };
      if (payload.person) setSelectedPerson(payload.person);
      setPersonCredits(payload.results || []);
    } catch { setPersonCredits([]); }
    finally { setCreditsLoading(false); }
  };

  const matchesType = (item: ExploreItem) => {
    if (mediaFilter === 'all') return true;
    if (mediaFilter === 'tv') return item.type === 'tv';
    return item.type === mediaFilter;
  };

  const refineItems = (items: ExploreItem[]) => {
    const filtered = items.filter((item) => {
      if (!matchesType(item)) return false;
      if (minimumRating > 0 && Number(item.rating || 0) < minimumRating) return false;
      if (yearFilter !== 'all' && Number(item.year) !== Number(yearFilter)) return false;
      return true;
    });
    return [...filtered].sort((a, b) => {
      if (sortMode === 'rating') return Number(b.rating || 0) - Number(a.rating || 0);
      if (sortMode === 'recent') return Number(b.year || 0) - Number(a.year || 0);
      return Number(b.popularity || b.rating || 0) - Number(a.popularity || a.rating || 0);
    });
  };

  const visibleTrending = refineItems(trending);
  const visibleRecommendations = refineItems(recommendations.length > 0 ? recommendations : trending.filter((item) => Number(item.rating || 0) >= 7.5));
  const visibleGenre = refineItems(activeGenreResults as ExploreItem[]);

  const availableYears = useMemo(() => {
    const values = [...trending, ...newReleases].map((item) => Number(item.year)).filter(Boolean);
    return [...new Set(values)].sort((a, b) => b - a).slice(0, 12);
  }, [trending, newReleases]);

  const renderMediaRail = (items: ExploreItem[], emptyText = 'Aucun titre disponible avec ces filtres.') => (
    items.length > 0 ? <div className={styles.discover2026Rail}>
      {items.map((media) => (
        <article key={keyOf(media)} className={styles.discover2026Card}>
          <MediaCard
            item={media}
            currentItem={myList[keyOf(media)]}
            onMarkWatched={(item) => void saveStatus(item,'vu')}
            onToggleInProgress={(item) => void saveStatus(item,'en_cours')}
            onMarkToWatch={(item) => void saveStatus(item,'a_voir')}
            onRemove={(item) => void remove(item)}
            rememberCollectionPosition={false}
          />
          <div className={styles.discover2026CardMeta}>
            <strong>{media.title}</strong>
            <span>{media.year || '—'} · {media.type === 'movie' ? 'Film' : media.type === 'anime' ? 'Animé' : media.type === 'drama' ? 'Drama' : 'Série'}</span>
          </div>
        </article>
      ))}
    </div> : <div className={styles.discover2026Empty}>{emptyText}</div>
  );

  return <>
    <MainNav />
    <main className={styles.discover2026Page}>
      <section className={styles.discover2026Hero}>
        <div className={styles.discover2026HeroCopy}>
          <span>DÉCOUVRIR</span>
          <h1>Trouvez votre prochaine histoire</h1>
          <p>Parcourez, explorez, laissez-vous inspirer.</p>
        </div>
        <div className={styles.discover2026TypeTabs} aria-label="Filtrer par type de média">
          {([
            ['all', 'Tout'], ['movie', 'Films'], ['tv', 'Séries'], ['drama', 'Dramas'], ['anime', 'Animés'],
          ] as [MediaFilter, string][]).map(([value, label]) => (
            <button key={value} type="button" className={mediaFilter === value ? styles.discover2026TypeActive : ''} onClick={() => setMediaFilter(value)}>{label}</button>
          ))}
        </div>
      </section>

      <section className={styles.discover2026Section + ' ' + styles.discover2026GenresFirst}>
        <div className={styles.discover2026SectionHead}>
          <div><h2>Explorer par genre</h2><span>Choisissez une ambiance et laissez STELDRA chercher pour vous.</span></div>
          <span>{GENRE_CHOICES.length} univers</span>
        </div>
        <div className={styles.discover2026GenreTiles}>
          {GENRE_CHOICES.map((genre) => (
            <button
              key={genre}
              type="button"
              className={selectedGenres.includes(genre) ? styles.discover2026GenreTileActive : ''}
              onClick={() => toggleGenre(genre)}
              aria-pressed={selectedGenres.includes(genre)}
              title={`Découvrir : ${genre}`}
            >
              <span>{GENRE_ICONS[genre] || '✦'}</span>
              <strong>{genre}</strong>
            </button>
          ))}
        </div>
        <div className={styles.discover2026GenreSelectionBar}>
          <span>{selectedGenres.length === 0 ? 'Choisissez un ou plusieurs genres' : `${selectedGenres.length} genre${selectedGenres.length > 1 ? 's' : ''} sélectionné${selectedGenres.length > 1 ? 's' : ''}`}</span>
          {selectedGenres.length > 0 && <button type="button" onClick={() => setSelectedGenres([])}>Effacer la sélection</button>}
        </div>
      </section>

      {selectedGenres.length > 0 && <section id="discover-genre-results" className={styles.discover2026GenreResultArea}>
        <div className={styles.discover2026SectionHead}>
          <div><h2>{selectedGenres.join(' + ')}</h2><span>Des titres correspondant à {selectedGenres.length > 1 ? 'ces univers combinés' : 'cet univers'}.</span></div>
          <div className={styles.discover2026GenreActions}>
            <button type="button" className={genreScope === 'discover' ? styles.discover2026ScopeActive : ''} onClick={() => setGenreScope('discover')}>À découvrir</button>
            <button type="button" className={genreScope === 'collection' ? styles.discover2026ScopeActive : ''} onClick={() => setGenreScope('collection')}>Dans ma collection</button>
            {genreScope === 'discover' && <button type="button" onClick={() => void loadGenre(selectedGenres, genrePage + 1)} disabled={genreLoading}>Nouvelles propositions</button>}
          </div>
        </div>
        {genreLoading && genreScope === 'discover' ? <div className={styles.discover2026Empty}>STELDRA cherche des titres…</div> : renderMediaRail(visibleGenre.slice(0, 20), genreScope === 'collection' ? 'Aucun titre de votre collection ne correspond à ce genre.' : 'Aucune proposition pour ce genre.')}
      </section>}

      <section className={styles.discover2026Filters}>
        <label><span>Trier par</span><select value={sortMode} onChange={(event) => setSortMode(event.target.value as SortMode)}><option value="popular">Popularité</option><option value="rating">Note</option><option value="recent">Plus récents</option></select></label>
        <label><span>Année</span><select value={yearFilter} onChange={(event) => setYearFilter(event.target.value)}><option value="all">Toutes les années</option>{availableYears.map((year) => <option key={year} value={year}>{year}</option>)}</select></label>
        <label><span>Note minimum</span><select value={minimumRating} onChange={(event) => setMinimumRating(Number(event.target.value))}><option value={0}>Toutes</option><option value={6}>6+</option><option value={7}>7+</option><option value={8}>8+</option></select></label>
        <button type="button" className={advancedOpen ? styles.discover2026AdvancedActive : styles.discover2026AdvancedButton} onClick={() => setAdvancedOpen((value) => !value)}>⌕ Acteur / réalisateur</button>
      </section>

      {advancedOpen && <section className={styles.discover2026AdvancedPanel + ' ' + styles.discover2026PeopleOnly}>
        <div className={styles.discover2026PersonBlock}>
          <div><h3>Acteur ou réalisateur</h3><p>Retrouvez directement les films et séries d’une personne.</p></div>
          <form onSubmit={searchPeople}><input value={personQuery} onChange={(event) => setPersonQuery(event.target.value)} placeholder="Ex. Charlize Theron, Christopher Nolan…"/><button type="submit" disabled={personSearching || personQuery.trim().length < 2}>{personSearching ? 'Recherche…' : 'Rechercher'}</button></form>
          {people.length > 0 && !selectedPerson && <div className={styles.discover2026PeopleGrid}>{people.map((person) => <button key={person.id} type="button" onClick={() => void openPerson(person)}>{person.profile_path ? <img src={person.profile_path} alt="" /> : <span>👤</span>}<strong>{person.name}</strong><small>{person.department}</small></button>)}</div>}
          {selectedPerson && <div className={styles.discover2026PersonResult}><div className={styles.discover2026PersonTitle}>{selectedPerson.profile_path ? <img src={selectedPerson.profile_path} alt=""/> : <span>👤</span>}<div><strong>{selectedPerson.name}</strong><small>{selectedPerson.department}</small></div><button type="button" onClick={() => { setSelectedPerson(null); setPersonCredits([]); }}>Changer</button></div>{creditsLoading ? <div className={styles.discover2026Empty}>Chargement…</div> : renderMediaRail(refineItems(personCredits).slice(0, 18), 'Aucun titre disponible pour cette personne.')}</div>}
        </div>
      </section>}

      <section className={styles.discover2026Section}>
        <div className={styles.discover2026SectionHead}><div><h2>À l’affiche</h2><span>Tendances et nouveautés du moment</span></div><span>Populaire cette semaine</span></div>
        {loading ? <div className={styles.discover2026Empty}>Chargement des tendances…</div> : renderMediaRail(visibleTrending.slice(0, 18))}
      </section>

      <section className={styles.discover2026Section}>
        <div className={styles.discover2026SectionHead}><div><h2>Recommandé pour vous</h2><span>Basé sur vos goûts</span></div><span>{recommendations.length > 0 ? 'Personnalisé' : 'Sélection STELDRA'}</span></div>
        {loading ? <div className={styles.discover2026Empty}>Préparation de vos recommandations…</div> : renderMediaRail(visibleRecommendations.slice(0, 18))}
      </section>

    </main>
  </>;
}
