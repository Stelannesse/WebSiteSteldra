// STELDRA_MEDIA_V13_FULLPAGE — fiche média plein écran officielle
import type { MediaType } from '../../../types/media';
import MediaPageClient from './MediaPageClient';

type MediaDetailPageProps = {
  params: Promise<{
    type: MediaType;
    id: string;
  }>;
};

export default async function MediaDetailPage({
  params,
}: MediaDetailPageProps) {
  const { type, id } = await params;

  return (
    <MediaPageClient
      type={type}
      id={id}
    />
  );
}