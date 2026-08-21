'use client';

import { FormEvent, useEffect, useMemo, useState } from 'react';
import MainNav from '../components/mainNav';
import MediaCard from '../components/mediaCard';
import { createClient } from '../lib/supabase';
import { fetchAllPages } from '../lib/supabasePaging';
import type { MediaItem, MyListItem, WatchStatus } from '../types/media';
import styles from '../page.module.css';

type ExploreItem = MediaItem & { recommendation_label?: string; recommendation_reason?: string; collection_id?: number };
type PersonSearchResult = { id: number; name: string; profile_path: string; department: string; known_for: string[] };
type SelectedPerson = { id: number; name: string; profile_path: string; department: string; biography?: string };

const keyOf = (m: MediaItem) => `${m.type}_${m.id}`;

export default function ExplorePage() {
  const [supabase] = useState(() => createClient());
  const [myList, setMyList] = useState<Record<string, MyListItem>>({});
  const [results, setResults] = useState<ExploreItem[]>([]);
  const [loading, setLoading] = useState(true);

  const [personQuery, setPersonQuery] = useState('');
  const [people, setPeople] = useState<PersonSearchResult[]>([]);
  const [personSearching, setPersonSearching] = useState(false);
  const [selectedPerson, setSelectedPerson] = useState<SelectedPerson | null>(null);
  const [personCredits, setPersonCredits] = useState<ExploreItem[]>([]);
  const [creditsLoading, setCreditsLoading] = useState(false);


  const genreChoices = [
    'Action','Aventure','Animation','Comédie','Crime','Documentaire','Drame','Famille',
    'Fantastique','Histoire','Horreur','Musique','Mystère','Romance','Science-fiction',
    'Thriller','Guerre','Western','BL','GL','Super-héros','Vampires','Zombies','Noël',
    'Arts martiaux','Espace','Voyage dans le temps',
  ];
  const [selectedGenres, setSelectedGenres] = useState<string[]>(['Action']);
  const [genreScope, setGenreScope] = useState<'discover' | 'collection'>('discover');
  const [genreResults, setGenreResults] = useState<ExploreItem[]>([]);
  const [genreLoading, setGenreLoading] = useState(false);
  const [genrePage, setGenrePage] = useState(1);

  const normalizeGenreLabel = (value: string) => {
    const v = value.trim().toLowerCase();
    if (['bl','boys love','boy love','yaoi','shounen ai','shounen-ai'].includes(v)) return 'BL';
    if (['gl','girls love',"girls' love",'girl love','yuri','shoujo ai','shoujo-ai'].includes(v)) return 'GL';
    const aliases: Record<string,string> = { comedy:'Comédie', comedie:'Comédie', drama:'Drame', drame:'Drame', horror:'Horreur', horreur:'Horreur', fantasy:'Fantastique', fantastique:'Fantastique', romance:'Romance', action:'Action', adventure:'Aventure', aventure:'Aventure', thriller:'Thriller', crime:'Crime', mystery:'Mystère', mystere:'Mystère', animation:'Animation', 'science fiction':'Science-fiction', 'science-fiction':'Science-fiction', 'sci-fi':'Science-fiction' };
    return aliases[v] || value.trim();
  };

  const mediaGenres = (media: MediaItem) => Array.from(new Set([
    ...(media.genres || []).map(normalizeGenreLabel),
    ...(media.tags || []).filter(t => ['BL','GL'].includes(normalizeGenreLabel(t))).map(normalizeGenreLabel),
  ]));

  const collectionGenreResults = useMemo(() => Object.values(myList)
    .map(item => item.media)
    .filter(media => selectedGenres.every(genre => mediaGenres(media).includes(genre))), [myList, selectedGenres]);

  const activeGenreResults = genreScope === 'collection' ? collectionGenreResults : genreResults;

  const toggleGenre = (choice: string) => {
    setSelectedGenres(current => {
      if (current.includes(choice)) {
        return current.length === 1 ? current : current.filter(item => item !== choice);
      }
      return [...current, choice];
    });
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
    if (genreScope === 'discover') void loadGenre(selectedGenres, 1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedGenres, genreScope]);


  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { window.location.href = '/login'; return; }
      const [{ data: progress }, { data: likes }] = await Promise.all([
        fetchAllPages<any>((from, to) => supabase.from('media_progress').select('*').eq('user_id', user.id).range(from, to)),
        supabase.from('media_reviews').select('media_id,media_type').eq('user_id', user.id).eq('rating', 'like').order('created_at', { ascending: false }).limit(8),
      ]);
      if (cancelled) return;
      const next: Record<string, MyListItem> = {};
      (progress || []).forEach((row: any) => {
        const media: MediaItem = { ...(row.media_data || {}), id: row.media_id, type: row.media_data?.type || row.media_type };
        next[keyOf(media)] = { media, status: row.status, watchCount: Number(row.watch_count) || 0, favorite: Boolean(row.media_data?.favorite), addedAt: row.created_at, lastInteractionAt: row.updated_at };
      });
      setMyList(next);
      const seeds = (likes || []).filter((like: any) => !['manga','manhwa'].includes(like.media_type)).slice(0, 5);
      const payloads = await Promise.all(seeds.map(async (seed: any) => {
        try {
          const r = await fetch(`/api/recommendations?id=${encodeURIComponent(seed.media_id)}&type=${encodeURIComponent(seed.media_type)}`);
          return r.ok ? (await r.json()).results || [] : [];
        } catch { return []; }
      }));
      const unique = new Map<string, ExploreItem>();
      payloads.flat().forEach((item: ExploreItem) => {
        const k = keyOf(item);
        if (!next[k] && !unique.has(k)) unique.set(k, item);
      });
      setResults([...unique.values()]);
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

    if (error) {
      console.error('Erreur sauvegarde depuis Découvrir :', error);
      return;
    }

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

    setMyList(v => ({
      ...v,
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
    const { data:{user} } = await supabase.auth.getUser(); if(!user)return;
    await supabase.from('media_progress').delete().eq('user_id',user.id).eq('media_id',String(media.id)).eq('media_type',media.type);
    setMyList(v=>{const n={...v};delete n[keyOf(media)];return n;});
  };

  const searchPeople = async (event: FormEvent) => {
    event.preventDefault();
    const q = personQuery.trim();
    if (q.length < 2) return;
    setPersonSearching(true);
    setSelectedPerson(null);
    setPersonCredits([]);
    try {
      const response = await fetch(`/api/people-search?q=${encodeURIComponent(q)}`);
      const payload = response.ok ? await response.json() : { people: [] };
      setPeople(payload.people || []);
    } catch {
      setPeople([]);
    } finally {
      setPersonSearching(false);
    }
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
    } catch {
      setPersonCredits([]);
    } finally {
      setCreditsLoading(false);
    }
  };


  const renderMediaRail = (items: ExploreItem[]) => (
    <div className={styles.discoverRail}>
      {items.map(media => (
        <article key={keyOf(media)} className={styles.discoverCard}>
          <MediaCard item={media} currentItem={myList[keyOf(media)]} onMarkWatched={m=>void saveStatus(m,'vu')} onToggleInProgress={m=>void saveStatus(m,'en_cours')} onMarkToWatch={m=>void saveStatus(m,'a_voir')} onRemove={m=>void remove(m)} rememberCollectionPosition={false}/>
          <strong>{media.title}</strong>
          {media.year && <small>{media.year}</small>}
        </article>
      ))}
    </div>
  );


  return <><MainNav/><main className={styles.discoverPage}>
    <header className={styles.discoverHero}>
      <span>DÉCOUVRIR</span>
      <h1>Qu’est-ce que vous avez envie de regarder ?</h1>
      <p>Choisissez plusieurs envies à la fois et découvrez de nouveaux films et séries selon votre humeur.</p>
    </header>

    <section className={styles.discoverPersonSearch}>
      <div className={styles.discoverSectionHeading}>
        <h2> Rechercher un acteur ou un réalisateur</h2>
        <p>Tapez un nom pour retrouver sa filmographie et voir ce que vous avez déjà dans votre collection.</p>
      </div>
      <form onSubmit={searchPeople} className={styles.discoverSearchForm}>
        <input
          value={personQuery}
          onChange={event => setPersonQuery(event.target.value)}
          placeholder="Ex. Charlize Theron, Christopher Nolan…"
          aria-label="Rechercher un acteur ou un réalisateur"
        />
        <button type="submit" disabled={personSearching || personQuery.trim().length < 2}>
          {personSearching ? 'Recherche…' : 'Rechercher'}
        </button>
      </form>

      {people.length > 0 && !selectedPerson && (
        <div className={styles.discoverPeopleGrid}>
          {people.map(person => (
            <button key={person.id} type="button" className={styles.discoverPersonCard} onClick={() => void openPerson(person)}>
              {person.profile_path ? <img src={person.profile_path} alt="" /> : <div className={styles.discoverPersonPlaceholder}>👤</div>}
              <span><strong>{person.name}</strong><small>{person.department}</small>{person.known_for.length > 0 && <em>{person.known_for.join(' · ')}</em>}</span>
            </button>
          ))}
        </div>
      )}

      {!personSearching && personQuery.trim().length >= 2 && people.length === 0 && !selectedPerson && (
        <div className={styles.discoverEmpty}>Aucun acteur ou réalisateur trouvé pour « {personQuery.trim()} ».</div>
      )}

      {selectedPerson && (
        <div className={styles.discoverPersonResult}>
          <div className={styles.discoverPersonHeader}>
            {selectedPerson.profile_path ? <img src={selectedPerson.profile_path} alt="" /> : <div className={styles.discoverPersonPlaceholder}>👤</div>}
            <div><strong>{selectedPerson.name}</strong><span>{selectedPerson.department}</span></div>
            <button type="button" onClick={() => { setSelectedPerson(null); setPersonCredits([]); }}>Changer</button>
          </div>
          {creditsLoading ? <div className={styles.discoverEmpty}>Chargement de la filmographie…</div> : personCredits.length > 0 ? renderMediaRail(personCredits) : <div className={styles.discoverEmpty}>Aucun film ou série disponible pour cette personne.</div>}
        </div>
      )}
    </section>

    {!loading && results.length > 0 && (
      <section className={styles.discoverSection}>
        <div className={styles.discoverSectionHeading}>
          <div><span className={styles.sagaEyebrow}>POUR VOUS</span><h2>Inspiré de vos coups de cœur</h2><p>Une sélection construite à partir des titres que vous avez aimés.</p></div>
        </div>
        {renderMediaRail(results.slice(0, 18))}
      </section>
    )}

    <section className={styles.genreDiscoveryBox}>
      <div className={styles.genreDiscoveryTop}>
        <div>
          <span className={styles.sagaEyebrow}>J’AI ENVIE DE…</span>
          <h2>Composez votre envie</h2>
          <p>Mélangez genres et thèmes : Action + Romance, Horreur + Vampires, BL + Romance… STELDRA cherchera des titres qui correspondent à tous vos choix.</p>
        </div>
      </div>

      <div className={styles.discoverGenreRail}>
        {genreChoices.map(choice => (
          <button key={choice} type="button" className={selectedGenres.includes(choice) ? styles.discoverGenreActive : ''} onClick={() => toggleGenre(choice)} aria-pressed={selectedGenres.includes(choice)}>
            {choice}
          </button>
        ))}
      </div>

      <div className={styles.genreDiscoveryActions}>
        <div className={styles.genreScopeSwitch}>
          <button type="button" className={genreScope === 'discover' ? styles.genreScopeActive : ''} onClick={() => setGenreScope('discover')}>À découvrir</button>
          <button type="button" className={genreScope === 'collection' ? styles.genreScopeActive : ''} onClick={() => setGenreScope('collection')}>Dans ma collection</button>
        </div>
        {genreScope === 'discover' && <button type="button" className={styles.refreshGenreButton} onClick={() => void loadGenre(selectedGenres, genrePage + 1)} disabled={genreLoading}>Nouvelles propositions</button>}
      </div>

      <div className={styles.genreSelectionSummary}>
        <span>Genres sélectionnés</span>
        <strong>{selectedGenres.join(' + ')}</strong>
      </div>

      {genreLoading && genreScope === 'discover' ? (
        <div className={styles.discoverEmpty}>STELDRA cherche des titres correspondant à votre sélection…</div>
      ) : activeGenreResults.length > 0 ? (
        renderMediaRail(activeGenreResults.slice(0, 24))
      ) : (
        <div className={styles.discoverEmpty}>{genreScope === 'collection' ? 'Aucun titre ne correspond à tous ces genres dans votre collection.' : 'Aucune recommandation disponible pour cette combinaison pour le moment.'}</div>
      )}
    </section>

  </main></>;
}
