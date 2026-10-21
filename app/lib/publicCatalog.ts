// Uniquement les données publiques du catalogue : aucune donnée de compte ici.
const catalog = new Map<string, { expires: number; value?: any; pending?: Promise<any> }>();
export async function loadPublicCatalog(url: string): Promise<any> {
  if (!/^\/api\/(people-search|discover-feed|recommendations)(\?|$)/.test(url)) throw new Error('Catalogue invalide');
  const cached = catalog.get(url);
  if (cached?.pending) return cached.pending;
  if (cached && cached.expires > Date.now()) return cached.value;
  if (catalog.size >= 60) catalog.delete(catalog.keys().next().value as string);
  const entry = { expires: 0, value: undefined as any, pending: undefined as Promise<any> | undefined };
  entry.pending = fetch(url, { signal: AbortSignal.timeout(12000) }).then(async (response) => {
    if (!response.ok) throw new Error('Catalogue indisponible');
    entry.value = await response.json();
    entry.expires = Date.now() + 5 * 60 * 1000;
    return entry.value;
  }).catch((error) => { catalog.delete(url); throw error; }).finally(() => { entry.pending = undefined; });
  catalog.set(url, entry);
  return entry.pending;
}
