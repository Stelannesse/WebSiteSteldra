/**
 * Rôle du fichier : Page Talents : affiche et filtre les personnalités favorites de l'utilisateur.
 */

'use client';

import Link from 'next/link';
import { FormEvent, useEffect, useMemo, useState } from 'react';
import MainNav from '../components/mainNav';
import { loadTalentFavorites, readTalentFavorites, type TalentFavorite, type TalentRole } from '../lib/talentFavorites';
import styles from './talents.module.css';

type Person = { id:number; name:string; profile_path?:string; department?:string; known_for_department?:string; known_for?:string[] };

const roleConfig: Record<TalentRole, { label:string; icon:string; plural:string }> = {
  actor: { label:'Acteurs favoris', icon:'♥', plural:'acteurs' },
  director: { label:'Réalisateurs favoris', icon:'▣', plural:'réalisateurs' },
  voice: { label:'Doubleurs favoris', icon:'◉', plural:'doubleurs' },
};

/** Composant principal de cette page ou zone d'interface. */
export default function TalentsPage() {
  const [favorites, setFavorites] = useState<TalentFavorite[]>([]);
  const [popular, setPopular] = useState<Person[]>([]);
  const [results, setResults] = useState<Person[]>([]);
  const [query, setQuery] = useState('');
  const [searching, setSearching] = useState(false);
  const [popularPage, setPopularPage] = useState(1);
  const [refreshingPopular, setRefreshingPopular] = useState(false);
  const [openRole, setOpenRole] = useState<TalentRole | null>(null);

  const loadPopular = async (page: number) => {
    setRefreshingPopular(true);
    try {
      const response = await fetch(`/api/people-search?mode=popular&page=${page}`);
      const payload = response.ok ? await response.json() : { people: [] };
      setPopular(payload.people || []);
      setPopularPage(page);
    } catch {
      setPopular([]);
    } finally {
      setRefreshingPopular(false);
    }
  };

  useEffect(() => {
    const sync = () => setFavorites(readTalentFavorites());
    sync();
    void loadTalentFavorites().then(setFavorites);
    window.addEventListener('steldra:talent-favorites-updated', sync);
    void loadPopular(1);
    return () => window.removeEventListener('steldra:talent-favorites-updated', sync);
  }, []);

  const grouped = useMemo(() => ({
    actor: favorites.filter((f) => f.role === 'actor'),
    director: favorites.filter((f) => f.role === 'director'),
    voice: favorites.filter((f) => f.role === 'voice'),
  }), [favorites]);

  const search = async (event: FormEvent) => {
    event.preventDefault();
    const value = query.trim();
    if (value.length < 2) return;
    setSearching(true);
    try {
      const response = await fetch(`/api/people-search?q=${encodeURIComponent(value)}`);
      const payload = response.ok ? await response.json() : { people:[] };
      setResults(payload.people || []);
    } finally { setSearching(false); }
  };

  const refreshPopular = () => {
    const nextPage = popularPage >= 10 ? 1 : popularPage + 1;
    void loadPopular(nextPage);
  };

  return <>
    <MainNav />
    <main data-steldra-ui="page" className={styles.page}>
      <div data-steldra-ui="shell" className={styles.shell}>
        <section data-steldra-ui="hero" className={styles.hero}>
          <div data-steldra-ui="heroCopy" className={styles.heroCopy}>
            <p data-steldra-ui="eyebrow" className={styles.eyebrow}>LES TALENTS DU CINÉMA</p>
            <h1>Acteurs, Réalisateurs & Doubleurs</h1>
            <p>Explorez leurs parcours, retrouvez leurs œuvres et gardez vos talents préférés à portée de main.</p>
            <form data-steldra-ui="searchBar" className={styles.searchBar} onSubmit={search}>
              <span>⌕</span>
              <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Rechercher un acteur, réalisateur ou doubleur…" />
              <button type="submit" disabled={searching || query.trim().length < 2}>{searching ? 'Recherche…' : 'Rechercher'}</button>
            </form>
          </div>
        </section>

        {results.length > 0 && <section data-steldra-ui="section searchResults" className={`${styles.section} ${styles.searchResults}`}>
          <div data-steldra-ui="sectionHead" className={styles.sectionHead}><div><h2>Résultats</h2><p>Choisissez un talent pour ouvrir sa filmographie.</p></div><span>{results.length} résultat{results.length > 1 ? 's' : ''}</span></div>
          <div data-steldra-ui="peopleGrid" className={styles.peopleGrid}>{results.map((person) => <PersonCard key={person.id} person={person} />)}</div>
        </section>}

        <section data-steldra-ui="roleGrid" className={styles.roleGrid}>
          {(Object.keys(roleConfig) as TalentRole[]).map((role) => {
            const items = grouped[role];
            const expanded = openRole === role;
            const shown = expanded ? items : items.slice(0, 8);
            return <article data-steldra-ui="roleCard" className={styles.roleCard} key={role}>
              <div data-steldra-ui="roleHead" className={styles.roleHead}><div data-steldra-ui="roleTitle" className={styles.roleTitle}><span data-steldra-ui="roleIcon" className={styles.roleIcon}>{roleConfig[role].icon}</span><h2>{roleConfig[role].label}</h2></div><span>{items.length} favori{items.length > 1 ? 's' : ''}</span></div>
              <div data-steldra-ui="avatarRow" className={styles.avatarRow}>
                {shown.length ? shown.map((item) => <Link href={`/talents/${item.id}`} data-steldra-ui="avatar" className={styles.avatar} key={`${item.id}-${role}`} title={item.name}>{item.profile_path ? <img src={item.profile_path} alt={item.name}/> : <span data-steldra-ui="emptyAvatar" className={styles.emptyAvatar}>👤</span>}</Link>) : <div data-steldra-ui="emptyAvatar" className={styles.emptyAvatar}>＋</div>}
              </div>
              {items.length > 8 && <div data-steldra-ui="roleActions" className={styles.roleActions}><button type="button" data-steldra-ui="seeAllButton" className={styles.seeAllButton} onClick={() => setOpenRole(expanded ? null : role)}>{expanded ? 'Réduire' : `Voir tout (${items.length})`}</button></div>}
              {expanded && items.length > 0 && <div data-steldra-ui="favoritePeopleGrid" className={styles.favoritePeopleGrid}>{items.map((item) => <Link key={`${item.id}-${role}-card`} data-steldra-ui="personCard" className={styles.personCard} href={`/talents/${item.id}`}>
                <div data-steldra-ui="personPortrait" className={styles.personPortrait}>{item.profile_path ? <img src={item.profile_path} alt={item.name}/> : null}</div>
                <div data-steldra-ui="personMeta" className={styles.personMeta}><strong>{item.name}</strong><span>{item.department || roleConfig[role].plural}</span></div>
              </Link>)}</div>}
            </article>;
          })}
        </section>

        <section data-steldra-ui="section discoverSection" className={`${styles.section} ${styles.discoverSection}`}>
          <div data-steldra-ui="sectionHead" className={styles.sectionHead}><div><h2>À découvrir</h2><p>Des personnalités populaires à explorer.</p></div><div data-steldra-ui="sectionActions" className={styles.sectionActions}><span>{popular.length} talents</span><button type="button" data-steldra-ui="refreshButton" className={styles.refreshButton} onClick={refreshPopular} disabled={refreshingPopular}>{refreshingPopular ? 'Actualisation…' : 'Actualiser'}</button></div></div>
          {popular.length ? <div data-steldra-ui="peopleGrid" className={styles.peopleGrid}>{popular.map((person) => <PersonCard key={`${popularPage}-${person.id}`} person={person}/>)}</div> : <div data-steldra-ui="empty" className={styles.empty}>Chargement des talents…</div>}
        </section>
      </div>
    </main>
  </>;
}

/** Affiche la carte récapitulative d'une personnalité. */
function PersonCard({ person }: { person: Person }) {
  return <Link data-steldra-ui="personCard" className={styles.personCard} href={`/talents/${person.id}`}>
    <div data-steldra-ui="personPortrait" className={styles.personPortrait}>{person.profile_path ? <img src={person.profile_path} alt={person.name}/> : null}</div>
    <div data-steldra-ui="personMeta" className={styles.personMeta}><strong>{person.name}</strong><span>{person.department || 'Talent'}</span></div>
  </Link>;
}
