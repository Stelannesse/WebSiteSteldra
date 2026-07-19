import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server' // Important ici

// Route de callback pour gérer l'authentification OAuth avec Supabase
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const next = searchParams.get('next') ?? '/'

  // Si un code est présent, on échange le code contre une session et on redirige vers la page souhaitée
  if (code) {
    const response = NextResponse.redirect(`${origin}${next}`)
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          get(name: string) { return request.cookies.get(name)?.value },
          set(name: string, value: string, options: CookieOptions) {
            response.cookies.set(name, value, options)
          },
          remove(name: string, options: CookieOptions) {
            response.cookies.set(name, '', options)
          },
        },
      }
    )
    await supabase.auth.exchangeCodeForSession(code)
    return response // On retourne la réponse qui contient le cookie et la redirection
  }

  return NextResponse.redirect(`${origin}/login`)
}