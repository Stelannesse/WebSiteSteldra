/**
 * Rôle du fichier : API Détail média : centralise les informations TMDB d'un film ou d'une série (crédits, vidéos et données associées).
 */

import { NextResponse } from 'next/server';

const TMDB_API_KEY = process.env.TMDB_API_KEY;

/** Traite la requête HTTP GET, valide ses paramètres puis renvoie une réponse JSON. */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);

  const id = searchParams.get('id');
  const type = searchParams.get('type');
  const summaryOnly = searchParams.get('mode') === 'summary';
  if (!['movie', 'tv', 'drama', 'anime'].includes(type || '')) {
    return NextResponse.json({ error: 'Ce contenu appartient au site de lecture.' }, { status: 400 });
  }

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

        poster_path:
          jikanData.data?.images?.jpg?.large_image_url ||
          jikanData.data?.images?.jpg?.image_url ||
          null,
        backdrop_path: null,
        directors: [],
        creators: [],
        countries: ['Japon'],
        status: jikanData.data?.status || null,
        tagline: null,
        original_title: jikanData.data?.title_japanese || jikanData.data?.title || null,
        trailers: jikanData.data?.trailer?.youtube_id
          ? [{
              key: jikanData.data.trailer.youtube_id,
              name: 'Bande-annonce',
              site: 'YouTube',
              type: 'Trailer',
              official: true,
            }]
          : [],
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

  if (!TMDB_API_KEY) {
    return NextResponse.json({ error: 'Le service des fiches est indisponible : la clé TMDB_API_KEY manque sur le serveur.' }, { status: 503 });
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
      `${summaryOnly ? '' : '&append_to_response=credits,videos'}`;

    const res = await fetch(url, { next: { revalidate: 3600 } });

    if (!res.ok) {
      const status = res.status === 404 ? 404 : res.status === 429 ? 429 : 502;
      const error = res.status === 404
        ? 'Cette œuvre est introuvable sur TMDB.'
        : res.status === 401 || res.status === 403
          ? 'TMDB refuse la connexion du serveur. Vérifiez la clé TMDB_API_KEY.'
          : res.status === 429
            ? 'TMDB reçoit trop de demandes. Réessayez dans quelques instants.'
            : 'Le service des fiches est temporairement indisponible.';
      return NextResponse.json({ error }, { status });
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

    const directors = Array.from(
      new Set(
        (data.credits?.crew || [])
          .filter((member: any) => member.job === 'Director')
          .map((member: any) => member.name)
          .filter(Boolean)
      )
    );

    const creators = (data.created_by || [])
      .map((creator: any) => creator.name)
      .filter(Boolean);

    const countries = (data.production_countries || [])
      .map((country: any) => country.name)
      .filter(Boolean);

    let trailerResults = Array.isArray(data.videos?.results)
      ? data.videos.results
      : [];

    if (!summaryOnly && trailerResults.length === 0) {
      try {
        const fallbackVideosRes = await fetch(
          `https://api.themoviedb.org/3/${tmdbType}/${id}/videos?api_key=${TMDB_API_KEY}&language=en-US`
        );
        if (fallbackVideosRes.ok) {
          const fallbackVideos = await fallbackVideosRes.json();
          trailerResults = Array.isArray(fallbackVideos?.results)
            ? fallbackVideos.results
            : [];
        }
      } catch {
        // La fiche reste utilisable même si les vidéos ne sont pas disponibles.
      }
    }

    const trailers = trailerResults
      .filter((video: any) => video?.site === 'YouTube' && ['Trailer', 'Teaser', 'Clip'].includes(video?.type))
      .sort((a: any, b: any) => Number(Boolean(b.official)) - Number(Boolean(a.official)))
      .slice(0, 8)
      .map((video: any) => ({
        key: video.key,
        name: video.name,
        site: video.site,
        type: video.type,
        official: Boolean(video.official),
      }));

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

  title: data.title || data.name || '',
  episodes: data.number_of_episodes || 0,
  creator_people: (tmdbType === 'movie'
    ? (data.credits?.crew || []).filter((member: any) => member.job === 'Director')
    : (data.created_by || [])).map((member: any) => ({ id: member.id, name: member.name })),
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

  poster_path: data.poster_path || null,
  backdrop_path: data.backdrop_path || null,
  directors,
  creators,
  countries,
  status: data.status || null,
  tagline: data.tagline || null,
  original_title:
    tmdbType === 'movie'
      ? data.original_title || null
      : data.original_name || null,
  trailers,
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