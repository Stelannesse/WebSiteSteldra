// Cache en mémoire partagé entre les pages, isolé par client et utilisateur.
// Les autorisations restent contrôlées par Supabase pour chaque lecture/écriture.
const authCache = new WeakMap<object, { user: any; expires: number; pending?: Promise<any> }>();
const wiredClients = new WeakSet<object>();
type Snapshot = { rows: any[]; complete: boolean; expires: number; pending?: Promise<{ data: any[]; error: any }>; listeners: Set<(rows: any[], complete: boolean) => void> };
const collections = new Map<string, Snapshot>();
let generation = 0;
function invalidate() { generation++; collections.clear(); }
if (typeof window !== 'undefined') {
  window.addEventListener('steldra:progress-updated', invalidate);
}

/** Réutilise brièvement la vérification d'identité au lieu de la refaire dans chaque page. */
export async function readUser(supabase: any) {
  if (!wiredClients.has(supabase)) {
    wiredClients.add(supabase);
    supabase.auth.onAuthStateChange?.((event: string) => {
      if (['SIGNED_OUT', 'SIGNED_IN', 'USER_UPDATED'].includes(event)) {
        authCache.delete(supabase);
        invalidate();
      }
    });
  }
  const cached = authCache.get(supabase);
  if (cached?.pending) return cached.pending;
  if (cached && cached.expires > Date.now()) return { data: { user: cached.user }, error: null };
  const entry = { user: null as any, expires: 0, pending: undefined as Promise<any> | undefined };
  entry.pending = supabase.auth.getUser().then((result: any) => {
    if (!result.error && authCache.get(supabase) === entry) {
      entry.user = result.data.user;
      entry.expires = Date.now() + 30_000;
    }
    return result;
  }).finally(() => { entry.pending = undefined; });
  authCache.set(supabase, entry);
  return entry.pending;
}

/** Pagination partagée : premier lot court, puis complément en arrière-plan. */
async function loadRows(key: string, query: (from: number, to: number) => PromiseLike<{ data: any[] | null; error: any }>, onData?: (rows: any[], complete: boolean) => void): Promise<{ data: any[]; error: any }> {
  let entry = collections.get(key);
  if (entry?.complete && entry.expires > Date.now()) {
    onData?.(entry.rows, true);
    return { data: entry.rows, error: null };
  }
  if (entry?.pending) {
    if (onData) entry.listeners.add(onData);
    if (entry.rows.length) onData?.(entry.rows, false);
    const waitingGeneration = generation;
    const result = await entry.pending;
    return generation === waitingGeneration ? result : loadRows(key, query, onData);
  }
  const previousRows = entry?.rows || [];
  entry = { rows: previousRows, complete: false, expires: 0, listeners: new Set(onData ? [onData] : []) };
  collections.set(key, entry);
  const current = entry;
  const startedAtGeneration = generation;
  if (previousRows.length) onData?.(previousRows, false);
  current.pending = (async () => {
    let rows: any[] = [];
    let from = 0;
    while (true) {
      const pageSize = from === 0 ? 24 : 500;
      const { data, error } = await query(from, from + pageSize - 1);
      if (error) return { data: rows, error };
      rows = rows.concat(data || []);
      const complete = (data || []).length < pageSize;
      current.rows = rows;
      current.complete = complete;
      // Ne réapplique pas une ancienne lecture après une modification de progression.
      if (generation === startedAtGeneration) current.listeners.forEach((listener) => listener(rows, complete));
      if (complete) {
        current.expires = Date.now() + 60_000;
        return { data: rows, error: null };
      }
      from += pageSize;
    }
  })().finally(() => { current.pending = undefined; current.listeners.clear(); });
  const result = await current.pending;
  if (generation !== startedAtGeneration) return loadRows(key, query, onData);
  return result;
}

/** Collection partagée, avec un ordre stable entre les pages. */
export function loadCollection(supabase: any, userId: string, onData?: (rows: any[], complete: boolean) => void) {
  return loadRows(`collection:${userId}`, (from, to) => supabase.from('media_progress').select('*')
    .in('media_type', ['movie', 'tv', 'drama', 'anime']).eq('user_id', userId)
    .order('media_id', { ascending: true }).order('media_type', { ascending: true }).range(from, to), onData);
}

/** Les visionnages les plus récents sont disponibles dès la première réponse. */
export function loadHistory(supabase: any, userId: string, onData?: (rows: any[], complete: boolean) => void) {
  return loadRows(`history:${userId}`, (from, to) => supabase.from('watch_history')
    .select('id,media_id,media_type,media_data,watched_at').in('media_type', ['movie', 'tv', 'drama', 'anime'])
    .eq('user_id', userId).order('watched_at', { ascending: false }).order('id', { ascending: false }).range(from, to), onData);
}

export function invalidateBrowserData() { invalidate(); }
