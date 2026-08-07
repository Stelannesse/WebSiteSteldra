import { NextResponse } from 'next/server';

const TMDB_API_KEY = process.env.TMDB_API_KEY

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const query = searchParams.get('q');

  if (!query || query.trim().length < 2) {
    return NextResponse.json({ results: [] });
  }

  const encodedQuery = encodeURIComponent(query);
  const formattedResults: any[] = [];

  // --- 1. TMDB (FILMS, SÉRIES, DRAMAS, ANIMES) ---
  try {
    // TMDB limite chaque page à 20 résultats. Une recherche de saga comme
    // "Star Wars" dépassait donc facilement la première page. On récupère
    // plusieurs pages en parallèle puis on déduplique les médias.
    const tmdbPages = await Promise.all(
      [1, 2, 3].map(async (page) => {
        const tmdbUrl = `https://api.themoviedb.org/3/search/multi?api_key=${TMDB_API_KEY}&language=fr-FR&query=${encodedQuery}&page=${page}&include_adult=false`;
        const response = await fetch(tmdbUrl);
        return response.ok ? response.json() : { results: [] };
      })
    );

    const uniqueTmdbResults = new Map<string, any>();

    tmdbPages.flatMap((page) => page.results || []).forEach((item: any) => {
      if (item?.id && (item.media_type === 'movie' || item.media_type === 'tv')) {
        uniqueTmdbResults.set(`${item.media_type}_${item.id}`, item);
      }
    });

    const tmdbResults = Array.from(uniqueTmdbResults.values());

    if (tmdbResults.length > 0) {
      // Pour éviter de faire ramer le serveur, on limite les requêtes de détails lourdes aux 6 premiers résultats TV
      let tvCount = 0;

      const tvDetailsPromises = tmdbResults.map(async (item: any) => {
        if (item.media_type === 'movie') {
          return {
            id: item.id,
            title: item.title || item.original_title,
            poster_path: item.poster_path || '',
            type: 'movie', 
            runtime: item.runtime || 0,
            year: item.release_date ? Number(String(item.release_date).slice(0, 4)) : null,
            release_date: item.release_date || ''
          };
        } 
        
        if (item.media_type === 'tv') {
          const isAnimation = item.genre_ids?.includes(16);
          const isAsian = item.origin_country?.some((c: string) => ['JP', 'KR', 'TW', 'CN', 'TH'].includes(c));
          
          let finalType: 'tv' | 'anime' | 'drama' = 'tv';
          if (isAnimation && item.origin_country?.includes('JP')) {
            finalType = 'anime';
          } else if (!isAnimation && isAsian) {
            finalType = 'drama';
          } else if (isAnimation) {
            finalType = 'anime';
          }
          
          tvCount++;
          // Si on a trop de séries dans la recherche, on ne charge les détails en temps réel que pour les 4 premières pour garder de la vitesse
          if (tvCount > 6) {
            return {
              id: item.id,
              title: item.name || item.original_name,
              poster_path: item.poster_path || '',
              type: finalType,
              seasons: 1,
              episodes: 0,
              airing_status: 'en_cours',
              year: item.first_air_date ? Number(String(item.first_air_date).slice(0, 4)) : null,
              first_air_date: item.first_air_date || ''
            };
          }

          try {
            // Ajout d'un timeout de 1.5 seconde max pour cette sous-requête
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 1500);

            const tvDetailedRes = await fetch(
              `https://api.themoviedb.org/3/tv/${item.id}?api_key=${TMDB_API_KEY}&language=fr-FR`,
              { signal: controller.signal }
            );
            clearTimeout(timeoutId);
            const detailedData = await tvDetailedRes.json();

            return {
              id: item.id,
              title: item.name || item.original_name,
              poster_path: item.poster_path || '',
              type: finalType,
              seasons: detailedData.number_of_seasons || 1,
              episodes: detailedData.number_of_episodes || 0,
              airing_status: detailedData.status === 'Ended' ? 'termine' : 'en_cours',
              year: item.first_air_date ? Number(String(item.first_air_date).slice(0, 4)) : null,
              first_air_date: item.first_air_date || ''
            };
          } catch {
            return {
              id: item.id,
              title: item.name || item.original_name,
              poster_path: item.poster_path || '',
              type: finalType,
              seasons: 1,
              episodes: 0,
              airing_status: 'en_cours',
              year: item.first_air_date ? Number(String(item.first_air_date).slice(0, 4)) : null,
              first_air_date: item.first_air_date || ''
            };
          }
        }
        return null;
      });

      const tmdbFormatted = await Promise.all(tvDetailsPromises);
      tmdbFormatted.forEach(item => {
        if (item) formattedResults.push(item);
      });
    }
  } catch (error) {
    console.error('Erreur TMDB:', error);
  }

  // --- 2. JIKAN (ANIMES) ---
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 1200); // 1.2s max pour Jikan, sinon on passe à la suite

    const jikanUrl = `https://api.jikan.moe/v4/anime?q=${encodedQuery}&limit=4`;
    const jikanRes = await fetch(jikanUrl, { signal: controller.signal });
    clearTimeout(timeoutId);
    
    if (jikanRes.status === 200) {
      const jikanData = await jikanRes.json();
      if (jikanData.data) {
        jikanData.data.forEach((anime: any) => {
          const animeTitle = anime.title_english || anime.title;
          const alreadyExists = formattedResults.some(
            r => r.type === 'anime' && r.title.toLowerCase() === animeTitle.toLowerCase()
          );
          
          if (!alreadyExists) {
            formattedResults.push({
              id: `jikan_${anime.mal_id}`,
              title: animeTitle,
              poster_path: anime.images?.jpg?.image_url || '',
              type: 'anime',
              episodes: anime.episodes || 0,
              seasons: 1, 
              airing_status: anime.airing ? 'en_cours' : 'termine'
            });
          }
        });
      }
    }
  } catch {
    // Échec silencieux si Jikan rame ou est bloqué
  }

  // --- 3. MANGADEX (MANGAS vs MANHWAS) ---
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 1500);

    const mangadexUrl = `https://api.mangadex.org/manga?title=${encodedQuery}&limit=6&includes[]=cover_art`;
    const mangadexRes = await fetch(mangadexUrl, { signal: controller.signal }).then(res => res.json());
    clearTimeout(timeoutId);

    if (mangadexRes.data) {
      mangadexRes.data.forEach((manga: any) => {
        const coverRel = manga.relationships?.find((rel: any) => rel.type === 'cover_art');
        const fileName = coverRel?.attributes?.fileName || '';
        const coverUrl = fileName ? `https://uploads.mangadex.org/covers/${manga.id}/${fileName}` : '';
        const title = manga.attributes?.title?.en || Object.values(manga.attributes?.title || {})[0] || 'Titre inconnu';
        
        const lang = manga.attributes?.originalLanguage;
        const finalMangaType = lang === 'ko' ? 'manhwa' : 'manga';

        formattedResults.push({
          id: manga.id,
          title: title,
          poster_path: coverUrl, 
          type: finalMangaType,
          chapters: manga.attributes?.lastChapter || 0,
          airing_status: manga.attributes?.status === 'ongoing' ? 'en_cours' : 'termine'
        });
      });
    }
  } catch {
    // Échec silencieux pour MangaDex
  }

  return NextResponse.json({ results: formattedResults });
}