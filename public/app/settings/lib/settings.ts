import { SteldraSettings } from "../types/settings";

export const defaultSettings: SteldraSettings = {
  reduceAnimations: false,
  showCollectionTitles: true,
  showTierListSignature: true,
  confirmTierListReset: true,
};

const STORAGE_KEY = "steldra_settings_v1";

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

export function saveSettings(settings: SteldraSettings) {
  localStorage.setItem(
    STORAGE_KEY,
    JSON.stringify(settings)
  );
}