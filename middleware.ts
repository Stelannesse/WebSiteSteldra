import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({
    request: { headers: request.headers },
  })

  // Création du client Supabase côté serveur avec gestion des cookies
  const supabase = createServerClient(
    'https://wskopejsjetymbrbvtvu.supabase.co',
    'sb_publishable_plVYk8L2MjTz4p7S5TOz9Q_yHJL_mBC',

    //process.env.NEXT_PUBLIC_SUPABASE_URL!,
    //process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) { return request.cookies.get(name)?.value },
        set(name: string, value: string, options: CookieOptions) {
          response.cookies.set({ name, value, ...options })
        },
        remove(name: string, options: CookieOptions) {
          response.cookies.set({ name, value: '', ...options })
        },
      },
    }
  )

  // Récupération de la session utilisateur
  const { data: { session } } = await supabase.auth.getSession()

  // 1. Si on est sur /login, on laisse passer (pas de redirection)
  if (request.nextUrl.pathname === '/login') {
    return response
  }

  // 2. Si pas de session, on force la redirection vers /login
  if (!session) {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  return response
}

export const config = {
  // On cible tout sauf les fichiers statiques et images
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}