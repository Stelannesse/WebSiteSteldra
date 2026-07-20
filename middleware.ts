import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({
    request: { headers: request.headers },
  })

  // Création du client Supabase côté serveur avec gestion des cookies
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      // Dans ton middleware.ts, remplace la partie cookies par :
cookies: {
  getAll() {
    return request.cookies.getAll()
  },
  setAll(cookiesToSet) {
    cookiesToSet.forEach(({ name, value, options }) =>
      request.cookies.set(name, value)
    )
    response = NextResponse.next({
      request
    })
    cookiesToSet.forEach(({ name, value, options }) =>
      response.cookies.set(name, value, options)
    )
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
  matcher: [
    /*
     * Applique le middleware sur tous les chemins SAUF :
     * - _next/static (fichiers de style/scripts)
     * - _next/image (images)
     * - favicon.ico
     * - fichiers avec extension (ex: .png, .css)
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}


