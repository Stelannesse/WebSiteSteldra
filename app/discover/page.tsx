'use client';

import { FormEvent, useEffect, useMemo, useState } from 'react';
import MainNav from '../components/mainNav';
import MediaCard from '../components/mediaCard';
import { createClient } from '../lib/supabase';
import type { MediaItem, MyListItem, WatchStatus } from '../types/media';
import styles from '../page.module.css';

type ExploreItem = MediaItem & { recommendation_label?: string; recommendation_reason?: string; collection_id?: number };
type ExploreGroup = { label: string; items: ExploreItem[]; collectionId?: number };
type SagaInfo = { id: number; name: string; overview?: string; poster_path?: string; backdrop_path?: string };
type SelectedSaga = { info: SagaInfo; items: ExploreItem[] };
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

  const [selectedSaga, setSelectedSaga] = useState<SelectedSaga | null>(null);
  const [sagaLoading, setSagaLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { window.location.href = '/login'; return; }
      const [{ data: progress }, { data: likes }] = await Promise.all([
        supabase.from('media_progress').select('*').eq('user_id', user.id),
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

  const groups = useMemo(() => {
    const make = (reason: string): ExploreGroup[] => {
      const map = new Map<string, ExploreItem[]>();
      results.filter(r => r.recommendation_reason === reason).forEach(item => {
        const label = item.recommendation_label || (reason === 'collection' ? 'Même univers' : reason === 'cast' ? 'Acteur ou actrice' : 'Réalisateur');
        map.set(label, [...(map.get(label) || []), item]);
      });
      return [...map.entries()].map(([label, items]) => ({
        label,
        items: items.slice(0, 14),
        collectionId: items.find(item => item.collection_id)?.collection_id,
      }));
    };
    return { universes: make('collection'), actors: make('cast'), directors: make('director') };
  }, [results]);

  const saveStatus = async (media: MediaItem, status: WatchStatus) => {
    const { data: { user } } = await supabase.auth.getUser(); if (!user) return;
    const now = new Date().toISOString(); const current = myList[keyOf(media)];
    const mediaData = { ...media, steldra_added_at: current?.addedAt || now, steldra_last_interaction_at: now, favorite: current?.favorite || false };
    const { error } = await supabase.from('media_progress').upsert({ user_id: user.id, media_id: String(media.id), media_type: media.type, status, media_data: mediaData });
    if (!error) setMyList(v => ({ ...v, [keyOf(media)]: { media: mediaData, status, watchCount: status === 'vu' ? 1 : 0, favorite: current?.favorite || false, addedAt: current?.addedAt || now, lastInteractionAt: now } }));
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

  const openSaga = async (group: ExploreGroup) => {
    if (!group.collectionId) return;
    setSagaLoading(true);
    setSelectedSaga(null);
    try {
      const response = await fetch(`/api/collection?id=${group.collectionId}`);
      const payload = response.ok ? await response.json() : { collection: null, results: [] };
      if (payload.collection) {
        setSelectedSaga({ info: payload.collection, items: payload.results || [] });
      }
    } catch {
      setSelectedSaga(null);
    } finally {
      setSagaLoading(false);
    }
  };

  const formatMinutes = (minutes: number) => {
    const safe = Math.max(0, Math.round(minutes));
    const hours = Math.floor(safe / 60);
    const mins = safe % 60;
    if (!hours) return `${mins} min`;
    return `${hours} h ${String(mins).padStart(2, '0')}`;
  };

  const sagaStats = useMemo(() => {
    if (!selectedSaga) return null;
    const watched = selectedSaga.items.filter(item => myList[keyOf(item)]?.status === 'vu');
    const total = selectedSaga.items.length;
    const watchedMinutes = watched.reduce((sum, item) => {
      const entry = myList[keyOf(item)];
      const runtime = Number(entry?.media.runtime || item.runtime) || 0;
      const count = Math.max(1, Number(entry?.watchCount) || 1);
      return sum + runtime * count;
    }, 0);
    const totalMinutes = selectedSaga.items.reduce((sum, item) => sum + (Number(item.runtime) || 0), 0);
    const next = selectedSaga.items.find(item => myList[keyOf(item)]?.status !== 'vu') || null;
    return {
      watched: watched.length,
      total,
      percent: total ? Math.round((watched.length / total) * 100) : 0,
      watchedMinutes,
      totalMinutes,
      next,
    };
  }, [selectedSaga, myList]);

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

  const renderGroups = (title: string, intro: string, data: ExploreGroup[], sagaMode = false) => (
    <section className={styles.discoverSection}>
      <div className={styles.discoverSectionHeading}><div><h2>{title}</h2><p>{intro}</p></div></div>
      {data.length === 0 ? <div className={styles.discoverEmpty}>Steldra complétera cette rubrique à mesure que vous aimez des titres.</div> : data.map(group => (
        <div key={group.label} className={styles.exploreGroupBlock}>
          <div className={styles.exploreGroupTitleRow}>
            <h3>{group.label}</h3>
            {sagaMode && group.collectionId && (
              <button type="button" className={styles.sagaOpenButton} onClick={() => void openSaga(group)}>
                Voir la saga
              </button>
            )}
          </div>
          {renderMediaRail(group.items)}
        </div>
      ))}
    </section>
  );

  return <><MainNav/><main className={styles.discoverPage}>
    <header className={styles.discoverHero}>
      <span>EXPLORER</span>
      <h1>Explorez selon ce que vous aimez</h1>
      <p>Sagas, acteurs et réalisateurs : Steldra part de vos coups de cœur pour vous ouvrir de nouvelles pistes.</p>
    </header>

    {(sagaLoading || selectedSaga) && (
      <section className={styles.sagaDetailSection}>
        {sagaLoading ? (
          <div className={styles.discoverEmpty}>Steldra prépare la saga…</div>
        ) : selectedSaga && sagaStats ? (
          <>
            <div className={styles.sagaDetailTop}>
              <div>
                <span className={styles.sagaEyebrow}>UNIVERS / SAGA</span>
                <h2>{selectedSaga.info.name}</h2>
                {selectedSaga.info.overview && <p>{selectedSaga.info.overview}</p>}
              </div>
              <button type="button" className={styles.sagaCloseButton} onClick={() => setSelectedSaga(null)}>Fermer</button>
            </div>

            <div className={styles.sagaStatsGrid}>
              <div><span>Progression</span><strong>{sagaStats.watched} / {sagaStats.total} vus</strong></div>
              <div><span>Avancement</span><strong>{sagaStats.percent} %</strong></div>
              <div><span>Temps regardé</span><strong>{formatMinutes(sagaStats.watchedMinutes)}</strong></div>
              <div><span>Durée totale</span><strong>{formatMinutes(sagaStats.totalMinutes)}</strong></div>
            </div>

            <div className={styles.sagaProgressTrack} aria-label={`Progression ${sagaStats.percent} %`}>
              <div style={{ width: `${sagaStats.percent}%` }} />
            </div>

            {sagaStats.next && (
              <div className={styles.sagaNextCard}>
                <span>▶ PROCHAIN</span>
                <strong>{sagaStats.next.title}</strong>
                {sagaStats.next.year && <small>{sagaStats.next.year}</small>}
              </div>
            )}

            <div className={styles.sagaMoviesRail}>
              {selectedSaga.items.map((media, index) => {
                const entry = myList[keyOf(media)];
                const isWatched = entry?.status === 'vu';
                const isNext = sagaStats.next && keyOf(sagaStats.next) === keyOf(media);
                return (
                  <article key={keyOf(media)} className={`${styles.sagaMovieCard} ${isWatched ? styles.sagaMovieWatched : ''} ${isNext ? styles.sagaMovieNext : ''}`}>
                    <div className={styles.sagaOrderBadge}>{isWatched ? '✓' : index + 1}</div>
                    {isNext && <div className={styles.sagaNextBadge}>▶ Prochain</div>}
                    <MediaCard item={media} currentItem={entry} onMarkWatched={m=>void saveStatus(m,'vu')} onToggleInProgress={m=>void saveStatus(m,'en_cours')} onMarkToWatch={m=>void saveStatus(m,'a_voir')} onRemove={m=>void remove(m)} rememberCollectionPosition={false}/>
                    <strong>{media.title}</strong>
                    <small>{media.year || '—'}{media.runtime ? ` · ${media.runtime} min` : ''}</small>
                  </article>
                );
              })}
            </div>
          </>
        ) : null}
      </section>
    )}

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

    {loading ? <div className={styles.discoverEmpty}>Steldra prépare votre espace Explorer...</div> : <>
      {renderGroups(' Univers & sagas','Retrouvez les autres titres des univers que vous aimez.',groups.universes, true)}
      {renderGroups(' Acteurs & actrices','D’autres films et séries avec les visages qui reviennent dans vos coups de cœur.',groups.actors)}
      {renderGroups(' Réalisateurs','Explorez la filmographie des réalisateurs derrière vos films préférés.',groups.directors)}
    </>}
  </main></>;
}
