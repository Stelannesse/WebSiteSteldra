export type TalentRole = 'actor' | 'director' | 'voice';

export type TalentFavorite = {
  id: number;
  name: string;
  profile_path?: string;
  department?: string;
  role: TalentRole;
  addedAt: string;
};

const STORAGE_KEY = 'steldra_talent_favorites_v1';

export function readTalentFavorites(): TalentFavorite[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    const value = raw ? JSON.parse(raw) : [];
    return Array.isArray(value) ? value : [];
  } catch {
    return [];
  }
}

export function writeTalentFavorites(items: TalentFavorite[]) {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  window.dispatchEvent(new CustomEvent('steldra:talent-favorites-updated'));
}

export function toggleTalentFavorite(item: Omit<TalentFavorite, 'addedAt'>) {
  const current = readTalentFavorites();
  const exists = current.some((favorite) => favorite.id === item.id && favorite.role === item.role);
  const next = exists
    ? current.filter((favorite) => !(favorite.id === item.id && favorite.role === item.role))
    : [{ ...item, addedAt: new Date().toISOString() }, ...current];
  writeTalentFavorites(next);
  return next;
}
