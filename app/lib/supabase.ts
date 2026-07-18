// Supabase client setup
import { createBrowserClient } from '@supabase/ssr'

const url = 'https://wskopejsjetymbrbvtvu.supabase.co'//process.env.NEXT_PUBLIC_SUPABASE_URL
const key = 'sb_publishable_plVYk8L2MjTz4p7S5TOz9Q_yHJL_mBC' //process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
console.log("URL Supabase:", url);
console.log("Clé Supabase:", key);

export const supabase = createBrowserClient(
  url!,
  key!
)