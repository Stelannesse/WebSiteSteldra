'use client';

import {
  useEffect,
  useState,
} from 'react';

import MainNav from '../components/mainNav';
import TimeStats from '../components/timeStats';

import { createClient } from '../lib/supabase';

import type {
  MediaItem,
  MyListItem,
} from '../types/media';

export default function StatistiquesPage() {
  const [supabase] = useState(
    () => createClient()
  );

  const [myList, setMyList] = useState<
    Record<string, MyListItem>
  >({});

  const [
    watchedEpisodes,
    setWatchedEpisodes,
  ] = useState<Record<string, boolean>>({});

  const [loading, setLoading] =
    useState(true);

  const [error, setError] =
    useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    const loadStatistics = async () => {
      setLoading(true);
      setError(null);

      try {
        const {
          data: { user },
        } = await supabase.auth.getUser();

        if (cancelled) {
          return;
        }

        /*
         * Utilisateur connecté :
         * chargement depuis Supabase.
         */
        if (user) {
          const { data, error: supabaseError } =
            await supabase
              .from('media_progress')
              .select('*')
              .eq('user_id', user.id);

          if (supabaseError) {
            throw supabaseError;
          }

          const loadedList:
            Record<string, MyListItem> = {};

          const loadedEpisodes:
            Record<string, boolean> = {};

          (data || []).forEach((item) => {
            const storedMedia =
              item.media_data as
                | MediaItem
                | null;

            if (!storedMedia) {
              return;
            }

            const mediaType =
              storedMedia.type ||
              item.media_type;

            const mediaId =
              item.media_id;

            const mediaKey =
              `${mediaType}_${mediaId}`;

            const media: MediaItem = {
              ...storedMedia,
              id: mediaId,
              type: mediaType,
            };

            loadedList[mediaKey] = {
              media,
              status:
                item.status || 'a_voir',
              watchCount:
                Number(item.watch_count) || 0,
            };

            /*
             * Compatibilité avec les deux noms
             * de colonne utilisés dans ton projet.
             */
            const storedEpisodes =
              item.watched_episode ||
              item.watched_episodes ||
              {};

            Object.assign(
              loadedEpisodes,
              storedEpisodes
            );
          });

          if (!cancelled) {
            setMyList(loadedList);
            setWatchedEpisodes(
              loadedEpisodes
            );
          }

          return;
        }

        /*
         * Utilisateur non connecté :
         * chargement depuis le localStorage.
         */
        const savedList =
          localStorage.getItem(
            'steldra_multimedia_list_v1'
          );

        const savedEpisodes =
          localStorage.getItem(
            'steldra_watched_episodes_v1'
          );

        if (!cancelled) {
          if (savedList) {
            setMyList(
              JSON.parse(savedList)
            );
          }

          if (savedEpisodes) {
            setWatchedEpisodes(
              JSON.parse(savedEpisodes)
            );
          }
        }
      } catch (loadError) {
        console.error(
          'Erreur chargement statistiques :',
          loadError
        );

        if (!cancelled) {
          setError(
            'Les statistiques n’ont pas pu être chargées.'
          );
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    void loadStatistics();

    return () => {
      cancelled = true;
    };
  }, [supabase]);

  return (
    <>
      <MainNav />

      <main
        style={{
          minHeight: '100vh',
          padding:
            'clamp(1rem, 4vw, 2rem)',
          backgroundColor: '#1b1f24',
          color: '#EEEEEE',
        }}
      >
        <div
          style={{
            width: '100%',
            maxWidth: '1100px',
            margin: '0 auto',
          }}
        >
          <header
            style={{
              marginBottom: '1.5rem',
            }}
          >
            <p
              style={{
                margin: 0,
                color: '#00ADB5',
                fontWeight: 'bold',
                textTransform: 'uppercase',
                fontSize: '0.78rem',
                letterSpacing: '0.08em',
              }}
            >
              Mon activité
            </p>

            <h1
              style={{
                margin:
                  '0.35rem 0 0',
                fontSize:
                  'clamp(1.7rem, 5vw, 2.5rem)',
              }}
            >
              Mes statistiques
            </h1>

            <p
              style={{
                maxWidth: '650px',
                margin:
                  '0.6rem 0 0',
                lineHeight: 1.6,
                opacity: 0.7,
              }}
            >
              Retrouve ton temps de
              visionnage et la répartition
              de ta collection.
            </p>
          </header>

          {loading ? (
            <div
              style={{
                padding: '2rem',
                border:
                  '1px solid #393E46',
                borderRadius: '16px',
                backgroundColor:
                  '#222831',
                textAlign: 'center',
              }}
            >
              Chargement des statistiques...
            </div>
          ) : error ? (
            <div
              style={{
                padding: '1rem',
                border:
                  '1px solid #7f3e3e',
                borderRadius: '12px',
                backgroundColor:
                  'rgba(180, 60, 60, 0.12)',
              }}
            >
              {error}
            </div>
          ) : Object.keys(myList).length ===
            0 ? (
            <div
              style={{
                padding: '2rem',
                border:
                  '1px solid #393E46',
                borderRadius: '16px',
                backgroundColor:
                  '#222831',
                textAlign: 'center',
              }}
            >
              <h2
                style={{
                  marginTop: 0,
                }}
              >
                Aucune statistique disponible
              </h2>

              <p
                style={{
                  marginBottom: 0,
                  opacity: 0.7,
                }}
              >
                Ajoute des médias à ta
                collection pour commencer à
                afficher tes statistiques.
              </p>
            </div>
          ) : (
            <TimeStats
              myList={myList}
              watchedEpisodes={
                watchedEpisodes
              }
            />
          )}
        </div>
      </main>
    </>
  );
}