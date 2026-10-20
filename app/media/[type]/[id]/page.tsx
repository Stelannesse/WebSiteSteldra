/**
 * Rôle du fichier : Page serveur d'un média : lit les paramètres de l'URL et délègue l'interface au composant client.
 */

// STELDRA_MEDIA_V13_FULLPAGE — fiche média plein écran officielle
import { notFound } from 'next/navigation';
import { isCinemaType } from '../../../lib/cinemaScope';
import type { MediaType } from '../../../types/media';
import MediaPageClient from './MediaPageClient';

type MediaDetailPageProps = {
  params: Promise<{
    type: MediaType;
    id: string;
  }>;
};

/** Composant principal de cette page ou zone d'interface. */
export default async function MediaDetailPage({
  params,
}: MediaDetailPageProps) {
  const { type, id } = await params;
  if (!isCinemaType(type)) notFound();

  return (
    <MediaPageClient
      type={type}
      id={id}
    />
  );
}