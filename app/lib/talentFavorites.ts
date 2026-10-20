/**
 * Rôle du fichier : Gestion des talents favoris : synchronise le stockage local avec Supabase lorsque l'utilisateur est connecté.
 */

import { createClient } from './supabase';

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
const UPDATE_EVENT = 'steldra:talent-favorites-updated';

/** Convertit une ligne de base de données en talent favori valide. */
function normalizeFavorite(row: any): TalentFavorite {
  return {
    id: Number(row.talent_id ?? row.id),
    name: String(row.name || ''),
    profile_path: row.profile_path || undefined,
    department: row.department || undefined,
    role: row.role as TalentRole,
    addedAt: row.created_at || row.addedAt || new Date().toISOString(),
  };
}

/** Lit les talents favoris conservés dans le navigateur. */
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

/** Enregistre les talents favoris dans le navigateur. */
export function writeTalentFavorites(items: TalentFavorite[]) {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  window.dispatchEvent(new CustomEvent(UPDATE_EVENT));
}

/**
 * Charge les favoris du compte Supabase afin qu'ils soient identiques sur PC,
 * téléphone et tablette. Les anciens favoris locaux sont importés une fois dans
 * le compte pour éviter de perdre ce qui avait déjà été enregistré.
 */
/** Charge les favoris depuis Supabase, avec repli sur le stockage local. */
export async function loadTalentFavorites(): Promise<TalentFavorite[]> {
  const local = readTalentFavorites();
  if (typeof window === 'undefined') return local;

  try {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return local;

    // Migration douce des favoris qui existaient avant la synchronisation cloud.
    if (local.length) {
      const rows = local.map((item) => ({
        user_id: user.id,
        talent_id: item.id,
        role: item.role,
        name: item.name,
        profile_path: item.profile_path || null,
        department: item.department || null,
        created_at: item.addedAt || new Date().toISOString(),
      }));

      const { error: migrationError } = await supabase
        .from('talent_favorites')
        .upsert(rows, { onConflict: 'user_id,talent_id,role', ignoreDuplicates: true });

      if (migrationError) {
        console.warn('Synchronisation des favoris talents indisponible :', migrationError);
        return local;
      }
    }

    const { data, error } = await supabase
      .from('talent_favorites')
      .select('talent_id,role,name,profile_path,department,created_at')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });

    if (error) {
      console.warn('Chargement des favoris talents impossible :', error);
      return local;
    }

    const favorites = (data || []).map(normalizeFavorite);
    writeTalentFavorites(favorites);
    return favorites;
  } catch (error) {
    console.warn('Chargement des favoris talents impossible :', error);
    return local;
  }
}

/** Ajoute ou retire un talent des favoris puis synchronise le résultat. */
export async function toggleTalentFavorite(
  item: Omit<TalentFavorite, 'addedAt'>
): Promise<TalentFavorite[]> {
  const current = readTalentFavorites();
  const exists = current.some((favorite) => favorite.id === item.id && favorite.role === item.role);
  const now = new Date().toISOString();
  const next = exists
    ? current.filter((favorite) => !(favorite.id === item.id && favorite.role === item.role))
    : [{ ...item, addedAt: now }, ...current];

  // Mise à jour immédiate de l'interface, même hors connexion.
  writeTalentFavorites(next);

  try {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return next;

    if (exists) {
      const { error } = await supabase
        .from('talent_favorites')
        .delete()
        .eq('user_id', user.id)
        .eq('talent_id', item.id)
        .eq('role', item.role);
      if (error) throw error;
    } else {
      const { error } = await supabase
        .from('talent_favorites')
        .upsert({
          user_id: user.id,
          talent_id: item.id,
          role: item.role,
          name: item.name,
          profile_path: item.profile_path || null,
          department: item.department || null,
          created_at: now,
        }, { onConflict: 'user_id,talent_id,role' });
      if (error) throw error;
    }
  } catch (error) {
    // On garde le cache local : l'utilisateur ne perd pas son clic si le réseau
    // est momentanément indisponible. Un prochain chargement retentera la synchro.
    console.warn('Sauvegarde du favori talent impossible :', error);
  }

  return next;
}
