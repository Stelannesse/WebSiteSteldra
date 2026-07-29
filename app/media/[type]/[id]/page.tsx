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