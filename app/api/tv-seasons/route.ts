import { NextResponse } from 'next/server';

const TMDB_API_KEY = '664b734f314d43f4b897c4e0bc48df8d';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get('id');
  const season = searchParams.get('season') || '1';

  if (!id) {
    return NextResponse.json({ error: 'ID manquant' }, { status: 400 });
  }

  // --- CAS A : ANIME JIKAN ---
  if (String(id).startsWith('jikan_')) {
    try {
      const cleanId = id.replace('jikan_', '');
      // Jikan renvoie les épisodes sous forme de liste globale (souvent par pages de 100)
      const res = await fetch(`https://api.jikan.moe/v4/anime/${cleanId}/episodes?page=${season}`);
      if (!res.ok) throw new Error();
      
      const jikanData = await res.json();
      
      // On formate les données pour qu'elles correspondent à la structure attendue par le front
      const episodes = (jikanData.data || []).map((ep: any) => ({
        id: `jikan_ep_${cleanId}_${ep.mal_id}`,
        episode_number: ep.mal_id,
        name: ep.title_Region || ep.title || `Épisode ${ep.mal_id}`,
        overview: ep.synopsis || ''
      }));

      return NextResponse.json({ episodes });
    } catch (error) {
      return NextResponse.json({ error: 'Erreur Jikan' }, { status: 500 });
    }
  }

  // --- CAS B : SÉRIE / DRAMA TMDB ---
  try {
    const url = `https://api.themoviedb.org/3/tv/${id}/season/${season}?api_key=${TMDB_API_KEY}&language=fr-FR`;
    const res = await fetch(url);
    if (!res.ok) throw new Error();
    
    const data = await res.json();
    return NextResponse.json({ episodes: data.episodes || [] });
  } catch (error) {
    return NextResponse.json({ error: 'Erreur TMDB' }, { status: 500 });
  }
}