import { NextResponse } from 'next/server';

/** Ne renvoie que le dernier épisode effectivement diffusé, jamais une annonce. */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get('id') || '';
  const type = searchParams.get('type') || '';
  if (!['tv', 'drama', 'anime'].includes(type) || !/^(?:jikan_)?\d+$/.test(id)) {
    return NextResponse.json({ error: 'Série invalide' }, { status: 400 });
  }
  const today = new Date().toISOString().slice(0, 10);
  try {
    if (id.startsWith('jikan_')) {
      const cleanId = id.slice(6);
      const first = await fetch(`https://api.jikan.moe/v4/anime/${cleanId}/episodes?page=1`, { next: { revalidate: 3600 } });
      if (!first.ok) return NextResponse.json({ error: 'Catalogue indisponible' }, { status: 502 });
      let payload = await first.json();
      const lastPage = Math.max(1, Number(payload.pagination?.last_visible_page) || 1);
      if (lastPage > 1) {
        const last = await fetch(`https://api.jikan.moe/v4/anime/${cleanId}/episodes?page=${lastPage}`, { next: { revalidate: 3600 } });
        if (!last.ok) return NextResponse.json({ error: 'Catalogue indisponible' }, { status: 502 });
        payload = await last.json();
      }
      const episode = (payload.data || []).filter((ep: any) => ep.aired && ep.aired.slice(0, 10) <= today)
        .sort((a: any, b: any) => Number(b.mal_id) - Number(a.mal_id))[0];
      return NextResponse.json({ episodes: episode?.mal_id, episode: episode ? { season: Math.ceil(episode.mal_id / 100), number: episode.mal_id, air_date: episode.aired.slice(0, 10) } : null });
    }
    const key = process.env.TMDB_API_KEY;
    if (!key) return NextResponse.json({ error: 'Catalogue non configuré' }, { status: 503 });
    const response = await fetch(`https://api.themoviedb.org/3/tv/${id}?api_key=${key}&language=fr-FR`, { next: { revalidate: 3600 } });
    if (!response.ok) return NextResponse.json({ error: 'Catalogue indisponible' }, { status: 502 });
    const data = await response.json();
    const episode = data.last_episode_to_air;
    return NextResponse.json({
      episode: episode?.air_date && episode.air_date <= today && episode.season_number > 0
        ? { season: episode.season_number, number: episode.episode_number, air_date: episode.air_date } : null,
      episodes: data.number_of_episodes,
      seasons: data.number_of_seasons,
    });
  } catch {
    return NextResponse.json({ error: 'Catalogue indisponible' }, { status: 502 });
  }
}
