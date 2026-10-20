/**
 * Rôle du fichier : Compatibilité avec l'ancienne fenêtre média : redirige son contenu vers le composant de fiche actuel.
 */

'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import type { MediaItem } from '../types/media';

type LegacyMediaModalProps = {
  selectedMedia: MediaItem | null;
  [key: string]: unknown;
};

/**
 * Compatibilité avec l'ancien système de fiche en modal.
 *
 * STELDRA utilise désormais exclusivement la page plein écran
 * /media/[type]/[id]. Si un ancien écran tente encore d'ouvrir
 * cette modal, on redirige vers la nouvelle fiche au lieu
 * d'afficher l'ancien design.
 */
/** Composant principal de cette page ou zone d'interface. */
export default function MediaModal({ selectedMedia }: LegacyMediaModalProps) {
  const router = useRouter();

  useEffect(() => {
    if (!selectedMedia) return;

    try {
      sessionStorage.setItem(
        'steldra_selected_media',
        JSON.stringify(selectedMedia),
      );
    } catch {
      // La navigation fonctionne même si sessionStorage est indisponible.
    }

    router.push(`/media/${selectedMedia.type}/${selectedMedia.id}`);
  }, [router, selectedMedia]);

  return null;
}
