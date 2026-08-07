import { NextResponse } from 'next/server';

const TMDB_API_KEY = process.env.TMDB_API_KEY;

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);

  const id = searchParams.get('id');
  const type = searchParams.get('type');

  if (!id || !type) {
    return NextResponse.json(
      { error: 'Paramètres manquants' },
      { status: 400 }
    );
  }
  

  // =====================================================
  // CAS A : ANIMES PROVENANT DE JIKAN
  // =====================================================

  if (String(id).startsWith('jikan_')) {
    try {
      const cleanId = id.replace('jikan_', '');

      const res = await fetch(
        `https://api.jikan.moe/v4/anime/${cleanId}`
      );

      if (!res.ok) {
        throw new Error(
          'Impossible de charger les données Jikan'
        );
      }

      const jikanData = await res.json();

      const durationText =
        jikanData.data?.duration || '';

      /*
       * Jikan renvoie généralement une valeur du type :
       * "24 min per ep"
       * "1 hr 45 min"
       */
      const hoursMatch =
        durationText.match(/(\d+)\s*hr/i);

      const minutesMatch =
        durationText.match(/(\d+)\s*min/i);

      const episodeRuntime =
        (hoursMatch
          ? Number(hoursMatch[1]) * 60
          : 0) +
        (minutesMatch
          ? Number(minutesMatch[1])
          : 0);

      return NextResponse.json({
        synopsis:
          jikanData.data?.synopsis ||
          'Aucun synopsis disponible pour cet anime.',

        actors: [],

        seasons_count: 1,

        runtime: null,

        episode_runtime:
          episodeRuntime > 0
            ? episodeRuntime
            : null,
        genres: [
          ...(jikanData.data?.genres || []).map((genre: any) => genre.name),
          ...(jikanData.data?.themes || []).map((theme: any) => theme.name),
        ].filter(Boolean),
        rating:
          typeof jikanData.data?.score === 'number'
            ? jikanData.data.score
            : null,

        year:
          Number(jikanData.data?.year) ||
          Number(
            String(
              jikanData.data?.aired?.from || ''
            ).slice(0, 4)
          ) ||
          null,

        first_air_date:
          jikanData.data?.aired?.from || null,
      });
    } catch {
      return NextResponse.json({
        synopsis:
          'Erreur lors du chargement du synopsis Jikan.',

        actors: [],

        seasons_count: 1,

        runtime: null,

        episode_runtime: null,
        genres: [],
      });
    }
  }

  // =====================================================
  // CAS B : MANGAS ET MANHWAS MANGADEX
  // =====================================================

  if (type === 'manga' || type === 'manhwa') {
    try {
      const res = await fetch(
        `https://api.mangadex.org/manga/${id}`
      );

      if (!res.ok) {
        throw new Error(
          'Impossible de charger les données MangaDex'
        );
      }

      const dexData = await res.json();

      const descriptions =
        dexData.data?.attributes?.description || {};

      const synopsis =
        descriptions.fr ||
        descriptions.en ||
        'Aucun résumé disponible pour ce manga.';

      const mangaTags = (dexData.data?.attributes?.tags || [])
        .map((tag: any) => tag.attributes?.name?.fr || tag.attributes?.name?.en)
        .filter(Boolean);

      return NextResponse.json({
        synopsis,

        actors: [],

        seasons_count: 0,

        runtime: null,

        episode_runtime: null,

        genres: mangaTags,

        year:
          Number(dexData.data?.attributes?.year) ||
          null,
      });
    } catch {
      return NextResponse.json({
        synopsis:
          'Erreur lors du chargement depuis MangaDex.',

        actors: [],

        seasons_count: 0,

        runtime: null,

        episode_runtime: null,
        genres: [],
      });
    }
  }

  // =====================================================
  // CAS C : FILMS, SÉRIES ET DRAMAS TMDB
  // =====================================================

  const tmdbType =
    type === 'movie'
      ? 'movie'
      : 'tv';

  try {
    const url =
      `https://api.themoviedb.org/3/` +
      `${tmdbType}/${id}` +
      `?api_key=${TMDB_API_KEY}` +
      `&language=fr-FR` +
      `&append_to_response=credits`;

    const res = await fetch(url);

    if (!res.ok) {
      return NextResponse.json(
        { error: 'Non trouvé sur TMDB' },
        { status: 404 }
      );
    }

    const data = await res.json();

    const actors =
      data.credits?.cast
        ?.slice(0, 10)
        .map((actor: any) => ({
          id: actor.id,

          name: actor.name,

          character: actor.character,

          profile_path:
            actor.profile_path
              ? `https://image.tmdb.org/t/p/w185${actor.profile_path}`
              : null,
        })) || [];

    /*
     * Film :
     * data.runtime contient la durée totale.
     */
    const runtime =
      tmdbType === 'movie' &&
      typeof data.runtime === 'number' &&
      data.runtime > 0
        ? data.runtime
        : null;

    /*
     * Série :
     * episode_run_time est généralement un tableau.
     * Exemple : [45]
     */
    const episodeRuntimeFromArray =
      Array.isArray(data.episode_run_time)
        ? data.episode_run_time.find(
            (value: unknown) =>
              typeof value === 'number' &&
              value > 0
          )
        : null;

    /*
     * TMDB peut aussi fournir une durée moyenne
     * dans last_episode_to_air.
     */
    const episodeRuntimeFromLastEpisode =
      typeof data.last_episode_to_air
        ?.runtime === 'number' &&
      data.last_episode_to_air.runtime > 0
        ? data.last_episode_to_air.runtime
        : null;

const episodeRuntime =
  tmdbType === 'tv'
    ? episodeRuntimeFromArray ??
      episodeRuntimeFromLastEpisode ??
      null
    : null;

console.log('TMDB RUNTIME :', runtime);
console.log('TMDB EPISODE RUNTIME :', episodeRuntime);

return NextResponse.json({
  synopsis:
    data.overview ||
    'Aucun synopsis disponible en français.',

  actors,

  seasons_count:
    data.number_of_seasons || 0,

  runtime,

  episode_runtime: episodeRuntime,
  genres: (data.genres || []).map((genre: any) => genre.name).filter(Boolean),
  genre_ids: (data.genres || []).map((genre: any) => genre.id).filter(Boolean),
  rating:
    typeof data.vote_average === 'number'
      ? data.vote_average
      : null,

  year:
    Number(
      String(
        tmdbType === 'movie'
          ? data.release_date || ''
          : data.first_air_date || ''
      ).slice(0, 4)
    ) || null,

  release_date:
    tmdbType === 'movie'
      ? data.release_date || null
      : null,

  first_air_date:
    tmdbType === 'tv'
      ? data.first_air_date || null
      : null,
});

  } catch (error) {
    console.error(
      'Erreur dans media-details :',
      error
    );

    return NextResponse.json(
      { error: 'Erreur serveur TMDB' },
      { status: 500 }
    ); 
  }}