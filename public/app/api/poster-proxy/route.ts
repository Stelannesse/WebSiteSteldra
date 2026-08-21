import { NextRequest, NextResponse } from 'next/server';

const ALLOWED_HOSTS = new Set([
  'image.tmdb.org',
  'cdn.myanimelist.net',
  'images.myanimelist.net',
  'uploads.mangadex.org',
]);

export async function GET(request: NextRequest) {
  const rawUrl = request.nextUrl.searchParams.get('url');

  if (!rawUrl) {
    return new NextResponse('URL manquante', { status: 400 });
  }

  let url: URL;

  try {
    url = new URL(rawUrl);
  } catch {
    return new NextResponse('URL invalide', { status: 400 });
  }

  if (url.protocol !== 'https:' || !ALLOWED_HOSTS.has(url.hostname)) {
    return new NextResponse('Source non autorisée', { status: 403 });
  }

  try {
    const response = await fetch(url, {
      next: { revalidate: 60 * 60 * 24 * 7 },
    });

    if (!response.ok) {
      return new NextResponse('Affiche introuvable', { status: response.status });
    }

    const contentType = response.headers.get('content-type') || 'image/jpeg';
    const body = await response.arrayBuffer();

    return new NextResponse(body, {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'public, max-age=86400, s-maxage=604800, stale-while-revalidate=86400',
      },
    });
  } catch (error) {
    console.error('Erreur proxy affiche :', error);
    return new NextResponse('Impossible de charger l’affiche', { status: 502 });
  }
}
