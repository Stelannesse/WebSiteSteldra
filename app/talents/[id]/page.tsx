/**
 * Rôle du fichier : Page Talent : présente une personnalité, ses œuvres et son statut de favori.
 */

'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import MainNav from '../../components/mainNav';
import { loadTalentFavorites, readTalentFavorites, toggleTalentFavorite, type TalentFavorite, type TalentRole } from '../../lib/talentFavorites';
import styles from './talentDetail.module.css';

type Person = { id:number; name:string; profile_path?:string; department?:string; biography?:string; birthday?:string; place_of_birth?:string; acting_count?:number; directing_count?:number };
type Credit = { id:number; title:string; poster_path?:string; type:'movie'|'tv'; year?:number; recommendation_reason?:'acting'|'directing'|'voice'; recommendation_label?:string };
type VoxCategory = 'Film'|"Film d'animation"|'Série'|"Série d'animation"|'Jeu vidéo'|'Autre';
type VoxographyCredit = { title:string; year?:number|null; role?:string; dubbedActor?:string; category:VoxCategory; sourceUrl?:string; media?: { id:number; type:'movie'|'tv'; title:string; year?:number|null; poster_path?:string } | null; mediaResolved?: boolean };
type View = 'filmography'|'dubbing'|'directing';
type VoxFilter = 'Tout'|VoxCategory;

const roleLabels: Record<TalentRole,string> = { actor:'Acteur favori', director:'Réalisateur favori', voice:'Doubleur favori' };
const voxCategories: VoxFilter[] = ['Tout','Film',"Film d'animation",'Série',"Série d'animation",'Jeu vidéo'];

// Transmet les données déjà disponibles avant de charger les détails supplémentaires.
function rememberCredit(media: { id: number; type: 'movie' | 'tv'; title: string; poster_path?: string; year?: number | null }) {
  try { sessionStorage.setItem('steldra_selected_media', JSON.stringify(media)); } catch { /* La navigation reste disponible si le stockage est bloqué. */ }
}

// Cache borné pour retrouver immédiatement une fiche récemment consultée.
type TalentPayload = { person: Person | null; results?: Credit[] };
const talentCache = new Map<string, { expires: number; payload: TalentPayload }>();

/** Affiche une image avec l'affiche de secours en cas d'erreur. */
function SteldraPoster({ src, alt }: { src?: string; alt: string }) {
  const [failed, setFailed] = useState(!src);
  useEffect(() => setFailed(!src), [src]);
  if (failed) return <div data-steldra-ui="posterFallback" className={styles.posterFallback} aria-label={`Affiche indisponible pour ${alt}`}><span>S</span></div>;
  return <img src={src} alt={alt} loading="lazy" decoding="async" referrerPolicy="no-referrer" onError={() => setFailed(true)} />;
}

/** Composant principal de cette page ou zone d'interface. */
export default function TalentDetailPage() {
  const params = useParams<{id:string}>();
  const id = params?.id;
  const [person,setPerson] = useState<Person|null>(null);
  const [credits,setCredits] = useState<Credit[]>([]);
  const [voxography,setVoxography] = useState<VoxographyCredit[]>([]);
  const [voxSource,setVoxSource] = useState('');
  const [voxProvider,setVoxProvider] = useState('');
  const [voxLoading,setVoxLoading] = useState(false);
  const [voxLoaded,setVoxLoaded] = useState(false);
  const [creditsLoading,setCreditsLoading] = useState(false);
  const [voxQuery,setVoxQuery] = useState('');
  const [voxFilter,setVoxFilter] = useState<VoxFilter>('Tout');
  const [voxMediaResolving,setVoxMediaResolving] = useState(false);
  const [voxVisibleCount,setVoxVisibleCount] = useState(20);
  const [favorites,setFavorites] = useState<TalentFavorite[]>([]);
  const [view,setView] = useState<View>('filmography');
  const [loading,setLoading] = useState(true);
  const [creditVisibleCount, setCreditVisibleCount] = useState(24);

  useEffect(() => {
    setFavorites(readTalentFavorites());
    void loadTalentFavorites().then(setFavorites);
    if (!id) return;
    let cancelled = false;
    setLoading(true);
    setCredits([]);
    setVoxography([]);
    setVoxLoaded(false);
    setVoxVisibleCount(20);
    setVoxSource('');
    setView('filmography');

    setCreditVisibleCount(24);
    setPerson(null);
    const controller = new AbortController();
    const applyPayload = (payload: TalentPayload) => {
      if (cancelled) return;
      setPerson(payload.person || null);
      setCredits(payload.results || []);
      setLoading(false);
      setCreditsLoading(false);
    };
    const cached = talentCache.get(id);
    if (cached && cached.expires > Date.now()) {
      applyPayload(cached.payload);
    } else {
      setCreditsLoading(true);
      // Profil et crédits sont récupérés ensemble, en parallèle côté serveur.
      void fetch(`/api/people-search?id=${encodeURIComponent(id)}`, { signal: controller.signal })
        .then((response) => { if (!response.ok) throw new Error('Talent indisponible'); return response.json(); })
        .then((payload: TalentPayload) => {
          if (cancelled) return;
          if (payload.person) {
            if (talentCache.size >= 20) talentCache.delete(talentCache.keys().next().value as string);
            talentCache.set(id, { expires: Date.now() + 5 * 60 * 1000, payload });
          }
          applyPayload(payload);
        })
        .catch(() => { if (!cancelled) applyPayload({ person: null }); });
    }

    return () => { cancelled = true; controller.abort(); };
  },[id]);

  const loadVoxography = () => {
    if (!person || voxLoaded || voxLoading) return;
    setVoxLoading(true);
    void fetch(`/api/voxography?name=${encodeURIComponent(person.name)}&v=56`)
      .then((response)=>response.ok?response.json():{items:[],source:null,provider:null})
      .then((payload)=>{
        const items: VoxographyCredit[] = Array.isArray(payload.items) ? payload.items.map((item: VoxographyCredit)=>({ ...item, media:null, mediaResolved:false })) : [];
        setVoxography(items);
        setVoxSource(payload.source || '');
        setVoxProvider(payload.provider || '');
        setVoxLoaded(true);
        // V58 : aucune recherche d'affiche ici. Les médias sont enrichis uniquement
        // pour les cartes réellement visibles afin de garder la fiche rapide et prudente.
      })
      .catch(()=>setVoxLoaded(true))
      .finally(()=>setVoxLoading(false));
  };

  const changeView = (next: View) => {
    setView(next);
    setCreditVisibleCount(24);
    if (next === 'dubbing') loadVoxography();
  };

  const screenCredits = useMemo(() => credits.filter((credit)=>credit.recommendation_reason === 'acting'), [credits]);
  const directingCredits = useMemo(() => credits.filter((credit)=>credit.recommendation_reason === 'directing'), [credits]);

  useEffect(() => { setVoxVisibleCount(20); }, [voxFilter, voxQuery]);

  const visibleVoxography = useMemo(() => {
    const query = voxQuery.trim().toLocaleLowerCase('fr');
    return voxography
      .filter((credit)=>voxFilter === 'Tout' || credit.category === voxFilter)
      .filter((credit)=>!query || [credit.title,credit.role,credit.dubbedActor,credit.category].filter(Boolean).join(' ').toLocaleLowerCase('fr').includes(query))
      .sort((a,b)=>String(a.title).localeCompare(String(b.title),'fr',{sensitivity:'base'}));
  },[voxography,voxFilter,voxQuery]);

  const pagedVoxography = useMemo(() => visibleVoxography.slice(0, voxVisibleCount), [visibleVoxography, voxVisibleCount]);

  useEffect(() => {
    if (view !== 'dubbing' || !voxLoaded || voxLoading) return;
    const unresolved = pagedVoxography.filter((credit)=>!credit.mediaResolved);
    if (!unresolved.length) return;
    let cancelled = false;
    setVoxMediaResolving(true);
    void (async () => {
      let cursor = 0;
      const workers = Array.from({ length: 3 }, async () => {
        while (!cancelled && cursor < unresolved.length) {
          const credit = unresolved[cursor++];
          const key = `${credit.title}|||${credit.role||''}|||${credit.year||''}|||${credit.category}`;
          if (credit.category === 'Jeu vidéo') {
            if (!cancelled) setVoxography((current)=>current.map((item)=>`${item.title}|||${item.role||''}|||${item.year||''}|||${item.category}`===key?{...item,media:null,mediaResolved:true}:item));
            continue;
          }
          try {
            const params = new URLSearchParams({ title:credit.title, category:credit.category });
            if (credit.year) params.set('year',String(credit.year));
            const response = await fetch(`/api/voxography-media?${params.toString()}`);
            const mediaPayload = response.ok ? await response.json() : { media:null };
            if (!cancelled) setVoxography((current)=>current.map((item)=>`${item.title}|||${item.role||''}|||${item.year||''}|||${item.category}`===key?{...item,media:mediaPayload.media||null,mediaResolved:true}:item));
          } catch {
            if (!cancelled) setVoxography((current)=>current.map((item)=>`${item.title}|||${item.role||''}|||${item.year||''}|||${item.category}`===key?{...item,media:null,mediaResolved:true}:item));
          }
        }
      });
      await Promise.all(workers);
      if (!cancelled) setVoxMediaResolving(false);
    })();
    return () => { cancelled = true; };
  }, [view, voxLoaded, voxLoading, pagedVoxography]);

  const recurringActors = useMemo(() => {
    const counts = new Map<string,{name:string;count:number}>();
    for (const credit of voxography) {
      const actor = credit.dubbedActor?.trim();
      if (!actor) continue;
      const key = actor.toLocaleLowerCase('fr');
      const current = counts.get(key) || {name:actor,count:0};
      current.count += 1;
      counts.set(key,current);
    }
    return [...counts.values()].filter((item)=>item.count >= 2).sort((a,b)=>b.count-a.count || a.name.localeCompare(b.name,'fr')).slice(0,10);
  },[voxography]);

  const isFavorite = (role:TalentRole) => favorites.some((f)=>f.id===person?.id && f.role===role);
  const toggle = async (role:TalentRole) => {
    if (!person) return;
    const next = await toggleTalentFavorite({ id:person.id, name:person.name, profile_path:person.profile_path, department:person.department, role });
    setFavorites(next);
  };

  return <>
    <MainNav/>
    <main data-steldra-ui="page" className={styles.page}><div data-steldra-ui="shell" className={styles.shell}>
      <nav data-steldra-ui="breadcrumbs" className={styles.breadcrumbs}><Link href="/">Accueil</Link><span>›</span><Link href="/talents">Talents</Link>{person && <><span>›</span><span>{person.name}</span></>}</nav>
      {loading ? <div data-steldra-ui="empty" className={styles.empty}>Chargement du profil…</div> : !person ? <div data-steldra-ui="empty" className={styles.empty}>Talent introuvable.</div> : <>
        <section data-steldra-ui="profile" className={styles.profile}>
          <div data-steldra-ui="portrait" className={styles.portrait}>{person.profile_path ? <img src={person.profile_path} alt={person.name}/> : <div data-steldra-ui="portraitFallback" className={styles.portraitFallback}>S</div>}</div>
          <div data-steldra-ui="profileMain" className={styles.profileMain}>
            <p data-steldra-ui="eyebrow" className={styles.eyebrow}>PORTRAIT STELDRA</p>
            <h1>{person.name}</h1>
            <p data-steldra-ui="meta" className={styles.meta}>{person.department || 'Talent'}{person.birthday ? ` · ${person.birthday}` : ''}{person.place_of_birth ? ` · ${person.place_of_birth}` : ''}</p>
            <div data-steldra-ui="favoriteBar" className={styles.favoriteBar}>{(['actor','director','voice'] as TalentRole[]).map((role)=><button key={role} type="button" data-steldra-ui="favoriteButton favoriteActive" className={`${styles.favoriteButton} ${isFavorite(role)?styles.favoriteActive:''}`} onClick={()=>toggle(role)}>{isFavorite(role)?'♥':'♡'} {roleLabels[role]}</button>)}</div>
            <div data-steldra-ui="stats" className={styles.stats}><span>{person.acting_count||0} à l’écran</span><span>{person.directing_count||0} réalisations</span>{voxLoaded && <span>{voxography.length} doublages VF</span>}</div>
          </div>
          {person.biography && <p data-steldra-ui="bio" className={styles.bio}>{person.biography}</p>}
        </section>

        <section data-steldra-ui="section" className={styles.section}>
          <div data-steldra-ui="primaryTabs" className={styles.primaryTabs}>
            <button data-steldra-ui="primaryTab activePrimaryTab" className={`${styles.primaryTab} ${view==='filmography'?styles.activePrimaryTab:''}`} onClick={()=>changeView('filmography')}><b>Filmographie</b><small>Rôles à l’écran</small></button>
            <button data-steldra-ui="primaryTab activePrimaryTab" className={`${styles.primaryTab} ${view==='dubbing'?styles.activePrimaryTab:''}`} onClick={()=>changeView('dubbing')}><b>Doublage VF</b><small>Films, séries, animation & jeux</small></button>
            <button data-steldra-ui="primaryTab activePrimaryTab" className={`${styles.primaryTab} ${view==='directing'?styles.activePrimaryTab:''}`} onClick={()=>changeView('directing')}><b>Réalisation</b><small>Crédits de réalisateur</small></button>
          </div>

          {view === 'dubbing' ? (
            voxLoading ? <div data-steldra-ui="empty" className={styles.empty}>Chargement du doublage VF…</div> : !voxLoaded ? <div data-steldra-ui="empty" className={styles.empty}>Ouvrez l’onglet Doublage VF pour charger la voxographie.</div> : voxography.length ? <>
              <div data-steldra-ui="voxHeader" className={styles.voxHeader}>
                <div><strong>Doublage VF</strong><span>Une liste séparée de la filmographie, sans affiches noires ni faux crédits TMDB.</span></div>
                {voxSource && <a href={voxSource} target="_blank" rel="noreferrer">Source {voxProvider || 'VF'} ↗</a>}
              </div>

              {recurringActors.length > 0 && <div data-steldra-ui="recurringBlock" className={styles.recurringBlock}><span data-steldra-ui="miniLabel" className={styles.miniLabel}>ACTEURS DOUBLÉS RÉGULIÈREMENT</span><div data-steldra-ui="recurringChips" className={styles.recurringChips}>{recurringActors.map((actor)=><button key={actor.name} onClick={()=>setVoxQuery(actor.name)}>{actor.name}<em>{actor.count}</em></button>)}</div></div>}

              <div data-steldra-ui="voxControls" className={styles.voxControls}>
                <input value={voxQuery} onChange={(event)=>setVoxQuery(event.target.value)} placeholder="Rechercher Andrew Garfield, Spider-Man, Natsu…" />
                {voxQuery && <button onClick={()=>setVoxQuery('')}>Effacer</button>}
              </div>
              <div data-steldra-ui="voxFilters" className={styles.voxFilters}>{voxCategories.map((category)=>{
                const count = category === 'Tout' ? voxography.length : voxography.filter((item)=>item.category===category).length;
                if (category !== 'Tout' && count === 0) return null;
                return <button key={category} className={voxFilter===category?styles.activeVoxFilter:''} onClick={()=>setVoxFilter(category)}>{category}<span>{count}</span></button>;
              })}</div>

              <div data-steldra-ui="voxGrid" className={styles.voxGrid}>{pagedVoxography.map((credit,index)=>{
                const body = <>
                  <div data-steldra-ui="voxPoster" className={styles.voxPoster}><SteldraPoster src={credit.media?.poster_path || undefined} alt={credit.title}/>{!credit.mediaResolved && <span data-steldra-ui="posterLoading" className={styles.posterLoading}>…</span>}</div>
                  <div data-steldra-ui="voxCardBody" className={styles.voxCardBody}>
                    <div data-steldra-ui="voxBadge" className={styles.voxBadge}>{credit.category}</div>
                    <strong data-steldra-ui="voxCardTitle" className={styles.voxCardTitle}>{credit.title}</strong>
                    <span data-steldra-ui="voxYear" className={styles.voxYear}>{credit.year || 'Année inconnue'}</span>
                    <div data-steldra-ui="voxCardMeta" className={styles.voxCardMeta}><span>Personnage</span><b>{credit.role || '—'}</b></div>
                    {credit.dubbedActor && <div data-steldra-ui="voxCardMeta" className={styles.voxCardMeta}><span>Interprète original</span><b>{credit.dubbedActor}</b></div>}
                  </div>
                </>;
                return credit.media
                  ? <Link data-steldra-ui="voxCard voxCardClickable" className={`${styles.voxCard} ${styles.voxCardClickable}`} href={`/media/${credit.media.type}/${credit.media.id}`} onClick={() => { if (credit.media) rememberCredit(credit.media); }} key={`${credit.title}-${credit.role}-${credit.year}-${index}`}>{body}<span data-steldra-ui="openHint" className={styles.openHint}>Voir la fiche ↗</span></Link>
                  : <article data-steldra-ui="voxCard" className={styles.voxCard} key={`${credit.title}-${credit.role}-${credit.year}-${index}`}>{body}{credit.mediaResolved && <span data-steldra-ui="noMatchHint" className={styles.noMatchHint}>Fiche média introuvable</span>}</article>;
              })}</div>
              {visibleVoxography.length > pagedVoxography.length && <div data-steldra-ui="loadMoreWrap" className={styles.loadMoreWrap}><button data-steldra-ui="loadMoreButton" className={styles.loadMoreButton} onClick={()=>setVoxVisibleCount((count)=>count+20)}>Voir plus ({visibleVoxography.length-pagedVoxography.length} restants)</button></div>}
              {voxMediaResolving && <div data-steldra-ui="enrichingNote" className={styles.enrichingNote}>STELDRA complète seulement les affiches visibles…</div>}
              {!visibleVoxography.length && <div data-steldra-ui="empty" className={styles.empty}>Aucun doublage pour ce filtre.</div>}
            </> : <div data-steldra-ui="empty" className={styles.empty}>Aucune voxographie VF structurée trouvée pour ce talent.</div>
          ) : (
            <div data-steldra-ui="mediaArea" className={styles.mediaArea}>
              <div data-steldra-ui="sectionTitle" className={styles.sectionTitle}><strong>{view==='filmography'?'Filmographie':'Réalisation'}</strong><span>{view==='filmography'?'Uniquement les apparitions à l’écran — les doublages sont dans leur onglet.':'Crédits de réalisation.'}</span></div>
              {creditsLoading ? <div data-steldra-ui="empty" className={styles.empty}>Chargement…</div> : (view==='filmography'?screenCredits:directingCredits).length ? <div data-steldra-ui="grid" className={styles.grid}>{(view==='filmography'?screenCredits:directingCredits).slice(0, creditVisibleCount).map((credit)=><Link prefetch={false} data-steldra-ui="media" className={styles.media} href={`/media/${credit.type}/${credit.id}`} onClick={() => rememberCredit(credit)} key={`${credit.type}-${credit.id}-${credit.recommendation_reason}`}>
                <div data-steldra-ui="poster" className={styles.poster}><SteldraPoster src={credit.poster_path} alt={credit.title}/></div>
                <strong>{credit.title}</strong><span>{credit.year||'—'}{credit.recommendation_label?` · ${credit.recommendation_label}`:''}</span>
              </Link>)}</div> : <div data-steldra-ui="empty" className={styles.empty}>Aucun crédit dans cette rubrique.</div>}
              {view !== 'dubbing' && (view === 'filmography' ? screenCredits : directingCredits).length > creditVisibleCount && <button type="button" onClick={() => setCreditVisibleCount((count) => count + 24)}>Voir 24 titres de plus</button>}
            </div>
          )}
        </section>
      </>}
    </div></main>
  </>;
}
