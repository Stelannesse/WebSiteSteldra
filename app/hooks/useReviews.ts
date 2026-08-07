import { useState } from 'react';
import type {
  MediaItem,
  MediaReview,
  ReviewRating,
} from '../types/media';

type UseReviewsProps = {
  supabase: any;
  userId: string | null;
  userName: string | null;
};

export default function useReviews({
  supabase,
  userId,
  userName,
}: UseReviewsProps) {
  const [reviewsByMedia, setReviewsByMedia] =
    useState<Record<string, MediaReview[]>>({});

  const [reviewRating, setReviewRating] =
    useState<ReviewRating | null>(null);

  const [reviewComment, setReviewComment] =
    useState('');

  const loadReviews = async (
    mediaId: string | number
  ) => {
    const mediaKey = mediaId.toString();

    try {
      const { data, error } = await supabase
        .from('media_reviews')
        .select('*')
        .eq('media_id', mediaKey)
        .order('created_at', {
          ascending: false,
        });

if (error) {
  console.error('Erreur Supabase reviews :', {
    message: error.message,
    details: error.details,
    hint: error.hint,
    code: error.code,
  });

  throw new Error(error.message);
}
      setReviewsByMedia((previous) => ({
        ...previous,
        [mediaKey]: data || [],
      }));
    } catch (error: unknown) {
  if (error instanceof Error) {
    console.error('Erreur loadReviews :', error.message);
  } else {
    console.error('Erreur loadReviews complète :', error);
  }
      const localReviews = JSON.parse(
        localStorage.getItem(
          `steldra_reviews_${mediaKey}`
        ) || '[]'
      );

      setReviewsByMedia((previous) => ({
        ...previous,
        [mediaKey]: localReviews,
      }));
    }
  };

    const submitReview = async (
    media: MediaItem,
    rating: ReviewRating,
    comment: string
  ) => {
    const mediaKey = media.id.toString();

    const payload = {
      user_id: userId,
      user_name: userName || 'Anonyme',
      media_id: mediaKey,
      media_type: media.type,
      rating,
      comment,
      created_at: new Date().toISOString(),
    };

    try {
      const { data, error } = await supabase
        .from('media_reviews')
        .insert(payload)
        .select()
        .single();

      if (error) {
        throw error;
      }

      setReviewsByMedia((previous) => ({
        ...previous,
        [mediaKey]: [
          data,
          ...(previous[mediaKey] || []),
        ],
      }));

      setReviewComment('');
      setReviewRating(null);
    } catch (error) {
      console.error(
        'Erreur submitReview :',
        error
      );

      const existing = JSON.parse(
        localStorage.getItem(
          `steldra_reviews_${mediaKey}`
        ) || '[]'
      );

      const newReview = {
        id: Date.now(),
        ...payload,
      };

      existing.unshift(newReview);

      localStorage.setItem(
        `steldra_reviews_${mediaKey}`,
        JSON.stringify(existing)
      );

      setReviewsByMedia((previous) => ({
        ...previous,
        [mediaKey]: existing,
      }));

      setReviewComment('');
      setReviewRating(null);
    }
  };
    const deleteReview = async (
    reviewId: string | number,
    mediaId: string | number
  ) => {
    const mediaKey = mediaId.toString();

    try {
      const { error } = await supabase
        .from('media_reviews')
        .delete()
        .eq('id', reviewId);

      if (error) {
        throw error;
      }

      setReviewsByMedia((previous) => ({
        ...previous,
        [mediaKey]: (
          previous[mediaKey] || []
        ).filter(
          (review) =>
            review.id !== reviewId
        ),
      }));
    } catch (error) {
      console.warn(
        'Suppression locale',
        error
      );

      const existing = JSON.parse(
        localStorage.getItem(
          `steldra_reviews_${mediaKey}`
        ) || '[]'
      );

      const filtered = existing.filter(
        (review: MediaReview) =>
          review.id !== reviewId
      );

      localStorage.setItem(
        `steldra_reviews_${mediaKey}`,
        JSON.stringify(filtered)
      );

      setReviewsByMedia((previous) => ({
        ...previous,
        [mediaKey]: filtered,
      }));
    }
  };
    return {
    reviewsByMedia,
    reviewRating,
    reviewComment,

    setReviewRating,
    setReviewComment,

    loadReviews,
    submitReview,
    deleteReview,
  };
}