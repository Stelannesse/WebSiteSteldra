/**
 * Rôle du fichier : Persistance des préférences : fournit les valeurs par défaut et gère leur lecture/écriture locale.
 */

import { SteldraSettings } from "../types/settings";

export const defaultSettings: SteldraSettings = {
  reduceAnimations: false,
  showCollectionTitles: true,
  showTierListSignature: true,
  confirmTierListReset: true,
};

const STORAGE_KEY = "steldra_settings_v1";

/** Lit les préférences enregistrées et complète les valeurs manquantes par les défauts. */
export function getSettings(): SteldraSettings {
  if (typeof window === "undefined") {
    return defaultSettings;
  }

  const saved = localStorage.getItem(STORAGE_KEY);

  if (!saved) {
    return defaultSettings;
  }

  try {
    return {
      ...defaultSettings,
      ...JSON.parse(saved),
    };
  } catch {
    return defaultSettings;
  }
}

/** Enregistre les préférences et avertit l'interface de leur mise à jour. */
export function saveSettings(settings: SteldraSettings) {
  localStorage.setItem(
    STORAGE_KEY,
    JSON.stringify(settings)
  );
}