import { NextResponse } from 'next/server';

const TMDB_API_KEY = '664b734f314d43f4b897c4e0bc48df8d';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get('id');
  const type = searchParams.get('type'); 

  if (!id || !type) {
    return NextResponse.json({ error: 'Paramètres manquants' }, { status: 400 });
  }

  // --- CAS A : GESTION DES ANIMES PROVENANT DE JIKAN ---
  if (String(id).startsWith('jikan_')) {
    try {
      const cleanId = id.replace('jikan_', '');
      const res = await fetch(`https://api.jikan.moe/v4/anime/${cleanId}`);
      if (!res.ok) throw new Error();
      const jikanData = await res.json();
      
      return NextResponse.json({
        synopsis: jikanData.data?.synopsis || 'Aucun synopsis disponible pour cet anime.',
        actors: [],
        seasons_count: 1
      });
    } catch {
      return NextResponse.json({ synopsis: 'Erreur lors du chargement du synopsis Jikan.', actors: [], seasons_count: 1 });
    }
  }

  // --- CAS B : GESTION DES MANGAS ET MANHWAS PROVENANT DE MANGADEX ---
  if (type === 'manga' || type === 'manhwa') {
    try {
      const res = await fetch(`https://api.mangadex.org/manga/${id}`);
      if (!res.ok) throw new Error();
      const dexData = await res.json();
      
      // Récupération de la description en français, sinon en anglais
      const descriptions = dexData.data?.attributes?.description || {};
      const synopsis = descriptions.fr || descriptions.en || 'Aucun résumé disponible pour ce manga.';

      return NextResponse.json({
        synopsis: synopsis,
        actors: [],
        seasons_count: 0
      });
    } catch {
      return NextResponse.json({ synopsis: 'Erreur lors du chargement depuis MangaDex.', actors: [], seasons_count: 0 });
    }
  }

  // --- CAS C : GESTION TMDB STANDARD (FILMS, SÉRIES, DRAMAS) ---
  const tmdbType = type === 'movie' ? 'movie' : 'tv';

  try {
    const url = `https://api.themoviedb.org/3/${tmdbType}/${id}?api_key=${TMDB_API_KEY}&language=fr-FR&append_to_response=credits`;
    const res = await fetch(url);
    
    if (!res.ok) return NextResponse.json({ error: 'Non trouvé sur TMDB' }, { status: 404 });
    const data = await res.json();

    const actors = data.credits?.cast?.slice(0, 5).map((actor: any) => ({
      name: actor.name,
      character: actor.character,
      profile_path: actor.profile_path ? `https://image.tmdb.org/t/p/w185${actor.profile_path}` : null
    })) || [];

    return NextResponse.json({
      synopsis: data.overview || 'Aucun synopsis disponible en français.',
      actors: actors,
      seasons_count: data.number_of_seasons || 0
    });
  } catch (error) {
    return NextResponse.json({ error: 'Erreur serveur TMDB' }, { status: 500 });
  }
}