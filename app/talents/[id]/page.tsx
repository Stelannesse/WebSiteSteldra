'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import MainNav from '../../components/mainNav';
import { readTalentFavorites, toggleTalentFavorite, type TalentFavorite, type TalentRole } from '../../lib/talentFavorites';
import styles from './talentDetail.module.css';

type Person = { id:number; name:string; profile_path?:string; department?:string; biography?:string; birthday?:string; place_of_birth?:string; acting_count?:number; directing_count?:number };
type Credit = { id:number; title:string; poster_path?:string; type:'movie'|'tv'; year?:number; recommendation_reason?:'acting'|'directing'|'voice'; recommendation_label?:string };
type VoxCategory = 'Film'|"Film d'animation"|'Série'|"Série d'animation"|'Jeu vidéo'|'Autre';
type VoxographyCredit = { title:string; year?:number|null; role?:string; dubbedActor?:string; category:VoxCategory; sourceUrl?:string; media?: { id:number; type:'movie'|'tv'; title:string; year?:number|null; poster_path?:string } | null; mediaResolved?: boolean };
type View = 'filmography'|'dubbing'|'directing';
type VoxFilter = 'Tout'|VoxCategory;

const roleLabels: Record<TalentRole,string> = { actor:'Acteur favori', director:'Réalisateur favori', voice:'Doubleur favori' };
const voxCategories: VoxFilter[] = ['Tout','Film',"Film d'animation",'Série',"Série d'animation",'Jeu vidéo'];

function SteldraPoster({ src, alt }: { src?: string; alt: string }) {
  const [failed, setFailed] = useState(!src);
  useEffect(() => setFailed(!src), [src]);
  if (failed) return <div className={styles.posterFallback} aria-label={`Affiche indisponible pour ${alt}`}><span>S</span></div>;
  return <img src={src} alt={alt} loading="lazy" decoding="async" referrerPolicy="no-referrer" onError={() => setFailed(true)} />;
}

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

  useEffect(() => {
    setFavorites(readTalentFavorites());
    if (!id) return;
    let cancelled = false;
    setLoading(true);
    setCredits([]);
    setVoxography([]);
    setVoxLoaded(false);
    setVoxVisibleCount(20);
    setVoxSource('');
    setView('filmography');

    void fetch(`/api/people-search?id=${encodeURIComponent(id)}&mode=profile`)
      .then((response)=>response.ok?response.json():{person:null})
      .then((payload)=>{
        if (cancelled) return;
        setPerson(payload.person || null);
        setLoading(false);
        if (!payload.person) return;
        setCreditsLoading(true);
        void fetch(`/api/people-search?id=${encodeURIComponent(id)}&mode=credits`)
          .then((response)=>response.ok?response.json():{results:[],counts:{}})
          .then((creditsPayload)=>{
            if (cancelled) return;
            setCredits(creditsPayload.results || []);
            setPerson((current)=>current ? { ...current, acting_count:Number(creditsPayload.counts?.acting)||0, directing_count:Number(creditsPayload.counts?.directing)||0 } : current);
          })
          .finally(()=>{ if (!cancelled) setCreditsLoading(false); });
      })
      .catch(()=>{ if (!cancelled) { setPerson(null); setLoading(false); } });

    return () => { cancelled = true; };
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
  const toggle = (role:TalentRole) => {
    if (!person) return;
    setFavorites(toggleTalentFavorite({ id:person.id, name:person.name, profile_path:person.profile_path, department:person.department, role }));
  };

  return <>
    <MainNav/>
    <main className={styles.page}><div className={styles.shell}>
      <nav className={styles.breadcrumbs}><Link href="/">Accueil</Link><span>›</span><Link href="/talents">Talents</Link>{person && <><span>›</span><span>{person.name}</span></>}</nav>
      {loading ? <div className={styles.empty}>Chargement du profil…</div> : !person ? <div className={styles.empty}>Talent introuvable.</div> : <>
        <section className={styles.profile}>
          <div className={styles.portrait}>{person.profile_path ? <img src={person.profile_path} alt={person.name}/> : <div className={styles.portraitFallback}>S</div>}</div>
          <div className={styles.profileMain}>
            <p className={styles.eyebrow}>PORTRAIT STELDRA</p>
            <h1>{person.name}</h1>
            <p className={styles.meta}>{person.department || 'Talent'}{person.birthday ? ` · ${person.birthday}` : ''}{person.place_of_birth ? ` · ${person.place_of_birth}` : ''}</p>
            <div className={styles.favoriteBar}>{(['actor','director','voice'] as TalentRole[]).map((role)=><button key={role} type="button" className={`${styles.favoriteButton} ${isFavorite(role)?styles.favoriteActive:''}`} onClick={()=>toggle(role)}>{isFavorite(role)?'♥':'♡'} {roleLabels[role]}</button>)}</div>
            <div className={styles.stats}><span>{person.acting_count||0} à l’écran</span><span>{person.directing_count||0} réalisations</span>{voxLoaded && <span>{voxography.length} doublages VF</span>}</div>
          </div>
          {person.biography && <p className={styles.bio}>{person.biography}</p>}
        </section>

        <section className={styles.section}>
          <div className={styles.primaryTabs}>
            <button className={`${styles.primaryTab} ${view==='filmography'?styles.activePrimaryTab:''}`} onClick={()=>changeView('filmography')}><b>Filmographie</b><small>Rôles à l’écran</small></button>
            <button className={`${styles.primaryTab} ${view==='dubbing'?styles.activePrimaryTab:''}`} onClick={()=>changeView('dubbing')}><b>Doublage VF</b><small>Films, séries, animation & jeux</small></button>
            <button className={`${styles.primaryTab} ${view==='directing'?styles.activePrimaryTab:''}`} onClick={()=>changeView('directing')}><b>Réalisation</b><small>Crédits de réalisateur</small></button>
          </div>

          {view === 'dubbing' ? (
            voxLoading ? <div className={styles.empty}>Chargement du doublage VF…</div> : !voxLoaded ? <div className={styles.empty}>Ouvrez l’onglet Doublage VF pour charger la voxographie.</div> : voxography.length ? <>
              <div className={styles.voxHeader}>
                <div><strong>Doublage VF</strong><span>Une liste séparée de la filmographie, sans affiches noires ni faux crédits TMDB.</span></div>
                {voxSource && <a href={voxSource} target="_blank" rel="noreferrer">Source {voxProvider || 'VF'} ↗</a>}
              </div>

              {recurringActors.length > 0 && <div className={styles.recurringBlock}><span className={styles.miniLabel}>ACTEURS DOUBLÉS RÉGULIÈREMENT</span><div className={styles.recurringChips}>{recurringActors.map((actor)=><button key={actor.name} onClick={()=>setVoxQuery(actor.name)}>{actor.name}<em>{actor.count}</em></button>)}</div></div>}

              <div className={styles.voxControls}>
                <input value={voxQuery} onChange={(event)=>setVoxQuery(event.target.value)} placeholder="Rechercher Andrew Garfield, Spider-Man, Natsu…" />
                {voxQuery && <button onClick={()=>setVoxQuery('')}>Effacer</button>}
              </div>
              <div className={styles.voxFilters}>{voxCategories.map((category)=>{
                const count = category === 'Tout' ? voxography.length : voxography.filter((item)=>item.category===category).length;
                if (category !== 'Tout' && count === 0) return null;
                return <button key={category} className={voxFilter===category?styles.activeVoxFilter:''} onClick={()=>setVoxFilter(category)}>{category}<span>{count}</span></button>;
              })}</div>

              <div className={styles.voxGrid}>{pagedVoxography.map((credit,index)=>{
                const body = <>
                  <div className={styles.voxPoster}><SteldraPoster src={credit.media?.poster_path || undefined} alt={credit.title}/>{!credit.mediaResolved && <span className={styles.posterLoading}>…</span>}</div>
                  <div className={styles.voxCardBody}>
                    <div className={styles.voxBadge}>{credit.category}</div>
                    <strong className={styles.voxCardTitle}>{credit.title}</strong>
                    <span className={styles.voxYear}>{credit.year || 'Année inconnue'}</span>
                    <div className={styles.voxCardMeta}><span>Personnage</span><b>{credit.role || '—'}</b></div>
                    {credit.dubbedActor && <div className={styles.voxCardMeta}><span>Interprète original</span><b>{credit.dubbedActor}</b></div>}
                  </div>
                </>;
                return credit.media
                  ? <Link className={`${styles.voxCard} ${styles.voxCardClickable}`} href={`/media/${credit.media.type}/${credit.media.id}`} key={`${credit.title}-${credit.role}-${credit.year}-${index}`}>{body}<span className={styles.openHint}>Voir la fiche ↗</span></Link>
                  : <article className={styles.voxCard} key={`${credit.title}-${credit.role}-${credit.year}-${index}`}>{body}{credit.mediaResolved && <span className={styles.noMatchHint}>Fiche média introuvable</span>}</article>;
              })}</div>
              {visibleVoxography.length > pagedVoxography.length && <div className={styles.loadMoreWrap}><button className={styles.loadMoreButton} onClick={()=>setVoxVisibleCount((count)=>count+20)}>Voir plus ({visibleVoxography.length-pagedVoxography.length} restants)</button></div>}
              {voxMediaResolving && <div className={styles.enrichingNote}>STELDRA complète seulement les affiches visibles…</div>}
              {!visibleVoxography.length && <div className={styles.empty}>Aucun doublage pour ce filtre.</div>}
            </> : <div className={styles.empty}>Aucune voxographie VF structurée trouvée pour ce talent.</div>
          ) : (
            <div className={styles.mediaArea}>
              <div className={styles.sectionTitle}><strong>{view==='filmography'?'Filmographie':'Réalisation'}</strong><span>{view==='filmography'?'Uniquement les apparitions à l’écran — les doublages sont dans leur onglet.':'Crédits de réalisation.'}</span></div>
              {creditsLoading ? <div className={styles.empty}>Chargement…</div> : (view==='filmography'?screenCredits:directingCredits).length ? <div className={styles.grid}>{(view==='filmography'?screenCredits:directingCredits).map((credit)=><Link className={styles.media} href={`/media/${credit.type}/${credit.id}`} key={`${credit.type}-${credit.id}-${credit.recommendation_reason}`}>
                <div className={styles.poster}><SteldraPoster src={credit.poster_path} alt={credit.title}/></div>
                <strong>{credit.title}</strong><span>{credit.year||'—'}{credit.recommendation_label?` · ${credit.recommendation_label}`:''}</span>
              </Link>)}</div> : <div className={styles.empty}>Aucun crédit dans cette rubrique.</div>}
            </div>
          )}
        </section>
      </>}
    </div></main>
  </>;
}
