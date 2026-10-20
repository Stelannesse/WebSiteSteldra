/**
 * Rôle du fichier : Fabrique le client Supabase utilisé dans les composants exécutés par le navigateur.
 */

// Supabase client setup
// Supabase client setup
import { createBrowserClient } from '@supabase/ssr'

/** Crée et retourne une instance du client Supabase côté navigateur. */
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}