/**
 * Rôle du fichier : Utilitaire de tri alphabétique commun aux listes de médias.
 */

import type { MediaItem } from "../types/media";

const titleCollator = new Intl.Collator("fr", {
  numeric: true,
  sensitivity: "base",
  ignorePunctuation: true,
});

/** Trie les médias par titre sans modifier le tableau reçu. */
export function sortMediaAlphabetically(
  media: MediaItem[]
): MediaItem[] {
  return [...media].sort((firstMedia, secondMedia) => {
    const firstTitle = firstMedia.title?.trim() ?? "";
    const secondTitle = secondMedia.title?.trim() ?? "";

    return titleCollator.compare(firstTitle, secondTitle);
  });
}