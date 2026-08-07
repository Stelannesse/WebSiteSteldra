'use client';

import { useEffect, useMemo, useState } from 'react';
import MainNav from '../components/mainNav';
import MediaCard from '../components/mediaCard';
import { createClient } from '../lib/supabase';
import type { MediaItem, MyListItem, WatchStatus } from '../types/media';
import styles from '../page.module.css';

const GENRES = [
  { label: 'Action', aliases: ['action'] },
  { label: 'Romance', aliases: ['romance'] },
  { label: 'Fantastique', aliases: ['fantastique', 'fantasy'] },
  {
    label: 'Science-fiction',
    aliases: ['science-fiction', 'science fiction', 'sci-fi'],
  },
  { label: 'Comédie', aliases: ['comédie', 'comedie', 'comedy'] },
  { label: 'Horreur', aliases: ['horreur', 'horror'] },
  { label: 'Thriller', aliases: ['thriller'] },
  {
    label: 'BL',
    aliases: ['bl', 'boys love', 'boy love', 'yaoi', 'shounen ai'],
  },
  {
    label: 'GL',
    aliases: [
      'gl',
      'girls love',
      "girls' love",
      'girl love',
      'yuri',
      'shoujo ai',
    ],
  },
];

const normalize = (value: string) =>
  value
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');

const keyOf = (media: MediaItem) =>
  `${media.type}_${media.id}`;

const yearOf = (media: MediaItem) => {
  const direct = Number(media.year);
  if (Number.isFinite(direct) && direct > 1900) return direct;

  const date = media.release_date || media.first_air_date || '';
  const parsed = Number(String(date).slice(0, 4));

  return Number.isFinite(parsed) && parsed > 1900
    ? parsed
    : null;
};

const matchesGenre = (media: MediaItem, label: string) => {
  const group = GENRES.find((item) => item.label === label);
  if (!group) return false;

  const values = [
    ...(media.genres || []),
    ...(media.tags || []),
  ].map(normalize);

  return group.aliases
    .map(normalize)
    .some((alias) => values.includes(alias));
};

export default function DiscoverPage() {
  const supabase = createClient();

  const [myList, setMyList] =
    useState<Record<string, MyListItem>>({});

  const [selectedGenre, setSelectedGenre] =
    useState('Action');

  const [loading, setLoading] = useState(true);
  const [suggestions, setSuggestions] =
    useState<MediaItem[]>([]);
  const [suggestionsLoading, setSuggestionsLoading] =
    useState(false);

  useEffect(() => {
    const loadCollection = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        window.location.href = '/login';
        return;
      }

      const { data, error } = await supabase
        .from('media_progress')
        .select('*')
        .eq('user_id', user.id);

      if (error) {
        console.error(
          'Erreur chargement Découvrir :',
          error
        );
        setLoading(false);
        return;
      }

      const next: Record<string, MyListItem> = {};

      (data || []).forEach((row: any) => {
        const media: MediaItem = {
          ...(row.media_data || {}),
          id: row.media_id,
          type:
            row.media_data?.type ||
            row.media_type,
        };

        next[keyOf(media)] = {
          media,
          status: row.status,
          watchCount: Number(row.watch_count) || 0,
          favorite: Boolean(
            row.media_data?.favorite
          ),
          addedAt:
            row.media_data?.steldra_added_at ||
            row.created_at ||
            null,
          lastInteractionAt:
            row.media_data?.steldra_last_interaction_at ||
            row.updated_at ||
            row.created_at ||
            null,
        };
      });

      setMyList(next);
      setLoading(false);
    };

    void loadCollection();
  }, []);

  const collection = useMemo(
    () =>
      Object.values(myList).map(
        (entry) => entry.media
      ),
    [myList]
  );

  const selectedCollection = useMemo(
    () =>
      collection.filter((media) =>
        matchesGenre(media, selectedGenre)
      ),
    [collection, selectedGenre]
  );

  const completedInGenre = useMemo(
    () =>
      selectedCollection.filter(
        (media) =>
          myList[keyOf(media)]?.status === 'vu'
      ),
    [selectedCollection, myList]
  );

  const favoritesInGenre = useMemo(
    () =>
      selectedCollection.filter(
        (media) =>
          Boolean(myList[keyOf(media)]?.favorite)
      ),
    [selectedCollection, myList]
  );

  const recentByRelease = useMemo(
    () =>
      [...selectedCollection]
        .sort(
          (a, b) =>
            (yearOf(b) || 0) -
            (yearOf(a) || 0)
        )
        .slice(0, 16),
    [selectedCollection]
  );

  const decades = useMemo(() => {
    const map = new Map<number, MediaItem[]>();

    selectedCollection.forEach((media) => {
      const year = yearOf(media);
      if (!year) return;

      const decade =
        Math.floor(year / 10) * 10;

      const current = map.get(decade) || [];
      current.push(media);
      map.set(decade, current);
    });

    return Array.from(map.entries())
      .sort(([a], [b]) => b - a)
      .slice(0, 4);
  }, [selectedCollection]);

  useEffect(() => {
    const loadSuggestions = async () => {
      /*
       * On choisit comme point de départ :
       * 1. un favori du genre,
       * 2. sinon un média vu,
       * 3. sinon n'importe quel média du genre.
       */
      const seed =
        favoritesInGenre[0] ||
        completedInGenre[0] ||
        selectedCollection[0];

      if (!seed) {
        setSuggestions([]);
        return;
      }

      if (
        seed.type === 'manga' ||
        seed.type === 'manhwa'
      ) {
        setSuggestions([]);
        return;
      }

      setSuggestionsLoading(true);

      try {
        const response = await fetch(
          `/api/recommendations?id=${encodeURIComponent(
            String(seed.id)
          )}&type=${encodeURIComponent(seed.type)}`
        );

        if (!response.ok) {
          setSuggestions([]);
          return;
        }

        const data = await response.json();

        const collectionKeys = new Set(
          Object.keys(myList)
        );

        const normalized: MediaItem[] =
          (data.results || [])
            .map((item: any) => ({
              id: item.id,
              title: item.title,
              poster_path:
                item.poster_path || '',
              type:
                item.type === 'movie'
                  ? 'movie'
                  : 'tv',
              year:
                item.year ?? null,
              release_date:
                item.release_date || undefined,
            }))
            .filter(
              (item: MediaItem) =>
                !collectionKeys.has(
                  keyOf(item)
                )
            );

        setSuggestions(normalized.slice(0, 18));
      } catch (error) {
        console.error(
          'Suggestions Découvrir indisponibles :',
          error
        );
        setSuggestions([]);
      } finally {
        setSuggestionsLoading(false);
      }
    };

    void loadSuggestions();
  }, [
    selectedGenre,
    favoritesInGenre,
    completedInGenre,
    selectedCollection,
  ]);

  const saveStatus = async (
    media: MediaItem,
    status: WatchStatus
  ) => {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) return;

    const key = keyOf(media);
    const current = myList[key];

    const now = new Date().toISOString();

    const mediaData: MediaItem = {
      ...media,
      steldra_added_at:
        current?.addedAt ||
        media.steldra_added_at ||
        now,
      steldra_last_interaction_at: now,
      favorite:
        current?.favorite ||
        media.favorite ||
        false,
    };

    const { error } = await supabase
      .from('media_progress')
      .upsert({
        user_id: user.id,
        media_id: String(media.id),
        media_type: media.type,
        status,
        media_data: mediaData,
      });

    if (error) {
      console.error(
        'Erreur ajout depuis Découvrir :',
        error
      );
      return;
    }

    setMyList((currentList) => ({
      ...currentList,
      [key]: {
        media: mediaData,
        status,
        watchCount:
          status === 'vu'
            ? Math.max(
                current?.watchCount || 0,
                1
              )
            : current?.watchCount || 0,
        favorite:
          current?.favorite || false,
        addedAt:
          current?.addedAt || now,
        lastInteractionAt: now,
      },
    }));

    setSuggestions((items) =>
      items.filter(
        (item) => keyOf(item) !== key
      )
    );
  };

  const remove = async (media: MediaItem) => {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) return;

    await supabase
      .from('media_progress')
      .delete()
      .eq('user_id', user.id)
      .eq('media_id', String(media.id))
      .eq('media_type', media.type);

    setMyList((current) => {
      const copy = { ...current };
      delete copy[keyOf(media)];
      return copy;
    });
  };

  const toggleFavorite = async (
    media: MediaItem
  ) => {
    const key = keyOf(media);
    const current = myList[key];
    if (!current) return;

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) return;

    const favorite = !current.favorite;

    const mediaData: MediaItem = {
      ...current.media,
      favorite,
      steldra_last_interaction_at:
        new Date().toISOString(),
    };

    const { error } = await supabase
      .from('media_progress')
      .update({
        media_data: mediaData,
      })
      .eq('user_id', user.id)
      .eq('media_id', String(media.id))
      .eq('media_type', media.type);

    if (error) return;

    setMyList((list) => ({
      ...list,
      [key]: {
        ...current,
        media: mediaData,
        favorite,
      },
    }));
  };

  const mediaRow = (
    title: string,
    subtitle: string,
    items: MediaItem[],
    allowCollectionActions = true
  ) => {
    if (items.length === 0) return null;

    return (
      <section className={styles.discoverSection}>
        <div
          className={
            styles.discoverSectionHeading
          }
        >
          <div>
            <h2>{title}</h2>
            <p>{subtitle}</p>
          </div>
        </div>

        <div className={styles.discoverRail}>
          {items.map((media) => {
            const current =
              myList[keyOf(media)];

            return (
              <article
                key={keyOf(media)}
                className={styles.discoverCard}
              >
                <MediaCard
                  item={media}
                  currentItem={current}
                  onMarkWatched={(item) =>
                    void saveStatus(
                      item,
                      'vu'
                    )
                  }
                  onToggleInProgress={(item) =>
                    void saveStatus(
                      item,
                      'en_cours'
                    )
                  }
                  onMarkToWatch={(item) =>
                    void saveStatus(
                      item,
                      'a_voir'
                    )
                  }
                  onRemove={(item) =>
                    void remove(item)
                  }
                  onToggleFavorite={
                    allowCollectionActions
                      ? (item) =>
                          void toggleFavorite(
                            item
                          )
                      : undefined
                  }
                  rememberCollectionPosition={false}
                />

                <strong title={media.title}>
                  {media.title}
                </strong>

                {yearOf(media) && (
                  <small>
                    {yearOf(media)}
                  </small>
                )}
              </article>
            );
          })}
        </div>
      </section>
    );
  };

  return (
    <>
      <MainNav />

      <main className={styles.discoverPage}>
        <header className={styles.discoverHero}>
          <span>DÉCOUVRIR</span>
          <h1>
            Qu’avez-vous envie de regarder ?
          </h1>
          <p>
            Choisissez un univers. Steldra
            s’appuie sur votre collection pour
            vous proposer des pistes à explorer.
          </p>
        </header>

        <nav
          className={styles.discoverGenreRail}
          aria-label="Genres à découvrir"
        >
          {GENRES.map((genre) => (
            <button
              key={genre.label}
              type="button"
              className={
                selectedGenre === genre.label
                  ? styles.discoverGenreActive
                  : ''
              }
              onClick={() =>
                setSelectedGenre(genre.label)
              }
            >
              {genre.label}
            </button>
          ))}
        </nav>

        {loading ? (
          <div className={styles.discoverEmpty}>
            Chargement de votre univers...
          </div>
        ) : (
          <>
            {suggestionsLoading ? (
              <section
                className={
                  styles.discoverSection
                }
              >
                <div
                  className={
                    styles.discoverSectionHeading
                  }
                >
                  <div>
                    <h2>
                      {selectedGenre} pour vous
                    </h2>
                    <p>
                      Recherche de suggestions...
                    </p>
                  </div>
                </div>
              </section>
            ) : (
              mediaRow(
                `${selectedGenre} pour vous`,
                'Des titres que vous n’avez pas encore ajoutés',
                suggestions,
                false
              )
            )}

            {mediaRow(
              `Vos ${selectedGenre}`,
              `${selectedCollection.length} titre${
                selectedCollection.length > 1
                  ? 's'
                  : ''
              } dans votre collection`,
              recentByRelease
            )}

            {favoritesInGenre.length > 0 &&
              mediaRow(
                `Vos favoris ${selectedGenre}`,
                'Les titres que vous avez mis en favoris',
                favoritesInGenre.slice(0, 14)
              )}

            {decades.map(
              ([decade, items]) =>
                mediaRow(
                  `${selectedGenre} · années ${decade}`,
                  `${items.length} titre${
                    items.length > 1 ? 's' : ''
                  }`,
                  items.slice(0, 14)
                )
            )}

            {selectedCollection.length === 0 &&
              suggestions.length === 0 && (
                <div
                  className={
                    styles.discoverEmpty
                  }
                >
                  Aucun contenu {selectedGenre} 
                  n’est encore identifié. À
                  mesure que Steldra enrichit
                  votre collection, cette rubrique
                  se complétera.
                </div>
              )}
          </>
        )}
      </main>
    </>
  );
}
