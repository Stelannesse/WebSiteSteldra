import type { MediaItem } from '../types/media';

type ReviewRating = 'like' | 'dislike';

type Review = {
  id: string | number;
  user_id?: string | null;
  user_name?: string | null;
  rating: ReviewRating;
  comment?: string;
  created_at: string;
};

type ReviewSectionProps = {
  media: MediaItem;
  reviews: Review[];
  reviewRating: ReviewRating;
  reviewComment: string;
  userId: string | null;
  userName: string | null;

  onRatingChange: (rating: ReviewRating) => void;
  onCommentChange: (comment: string) => void;
  onSubmit: () => void;
  onCancel: () => void;

  onDelete: (
    reviewId: string | number,
    mediaId: string | number,
    reviewUserId?: string | null,
    reviewUserName?: string | null
  ) => void;
};

export default function ReviewSection({
  media,
  reviews,
  reviewRating,
  reviewComment,
  userId,
  userName,
  onRatingChange,
  onCommentChange,
  onSubmit,
  onCancel,
  onDelete,
}: ReviewSectionProps) {
  const canDeleteReview = (review: Review) => {
    const belongsToCurrentUser =
      Boolean(
        review.user_id &&
        userId &&
        review.user_id === userId
      ) ||
      Boolean(
        review.user_name &&
        userName &&
        review.user_name === userName
      );

    if (belongsToCurrentUser) {
      return true;
    }

    try {
      const localReviews = JSON.parse(
        localStorage.getItem(
          `steldra_reviews_${media.id}`
        ) || '[]'
      );

      return localReviews.some(
        (localReview: Review) =>
          localReview.id === review.id
      );
    } catch {
      return false;
    }
  };

  return (
    <section
      style={{
        marginTop: '1.2rem',
        borderTop: '1px solid #393E46',
        paddingTop: '1rem',
      }}
    >
      <h3
        style={{
          fontSize: '1.1rem',
          marginBottom: '0.6rem',
        }}
      >
        Avis des utilisateurs
      </h3>

      <div
        style={{
          display: 'flex',
          gap: '0.6rem',
          alignItems: 'center',
          marginBottom: '0.6rem',
        }}
      >
        <button
          type="button"
          onClick={() => onRatingChange('like')}
          style={{
            padding: '0.4rem 0.8rem',
            borderRadius: '6px',
            border:
              reviewRating === 'like'
                ? '2px solid #00ADB5'
                : '1px solid #393E46',
            background:
              reviewRating === 'like'
                ? '#00ADB5'
                : '#2a2e35',
            color:
              reviewRating === 'like'
                ? '#222831'
                : '#FFF',
            cursor: 'pointer',
          }}
        >
          J’aime
        </button>

        <button
          type="button"
          onClick={() => onRatingChange('dislike')}
          style={{
            padding: '0.4rem 0.8rem',
            borderRadius: '6px',
            border:
              reviewRating === 'dislike'
                ? '2px solid #FF6B6B'
                : '1px solid #393E46',
            background:
              reviewRating === 'dislike'
                ? '#FF6B6B'
                : '#2a2e35',
            color:
              reviewRating === 'dislike'
                ? '#222831'
                : '#FFF',
            cursor: 'pointer',
          }}
        >
          Je n’aime pas
        </button>
      </div>

      <textarea
        value={reviewComment}
        onChange={(event) =>
          onCommentChange(event.target.value)
        }
        placeholder="Laisser un commentaire (optionnel)"
        style={{
          width: '100%',
          minHeight: '60px',
          padding: '0.6rem',
          borderRadius: '8px',
          background: '#222831',
          border: '1px solid #393E46',
          color: '#EEE',
          marginBottom: '0.6rem',
          resize: 'vertical',
        }}
      />

      <div
        style={{
          display: 'flex',
          gap: '0.6rem',
        }}
      >
        <button
          type="button"
          onClick={onSubmit}
          style={{
            padding: '0.6rem 1rem',
            background: '#00ADB5',
            border: 'none',
            color: '#222831',
            fontWeight: 'bold',
            borderRadius: '8px',
            cursor: 'pointer',
          }}
        >
          Envoyer
        </button>

        <button
          type="button"
          onClick={onCancel}
          style={{
            padding: '0.6rem 1rem',
            background: '#393E46',
            border: 'none',
            color: '#EEE',
            borderRadius: '8px',
            cursor: 'pointer',
          }}
        >
          Annuler
        </button>
      </div>

      <div style={{ marginTop: '1rem' }}>
        {reviews.length === 0 ? (
          <p style={{ opacity: 0.6 }}>
            Pas encore d’avis — soyez le premier !
          </p>
        ) : (
          reviews.map((review) => {
            const canDelete =
              canDeleteReview(review);

            return (
              <article
                key={review.id}
                style={{
                  padding: '0.6rem',
                  background: '#2a2e35',
                  borderRadius: '8px',
                  marginBottom: '0.6rem',
                  border: '1px solid #393E46',
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    gap: '0.8rem',
                  }}
                >
                  <strong>
                    {review.user_name || 'Utilisateur'}
                  </strong>

                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.6rem',
                    }}
                  >
                    <span
                      style={{
                        opacity: 0.7,
                        fontSize: '0.85rem',
                      }}
                    >
                      {new Date(
                        review.created_at
                      ).toLocaleString('fr-FR')}
                    </span>

                    {canDelete && (
                      <button
                        type="button"
                        onClick={() =>
                          onDelete(
                            review.id,
                            media.id,
                            review.user_id,
                            review.user_name
                          )
                        }
                        style={{
                          background: 'transparent',
                          border:
                            '1px solid rgba(255,255,255,0.08)',
                          color: '#EEE',
                          padding: '0.25rem 0.5rem',
                          borderRadius: '6px',
                          cursor: 'pointer',
                          fontSize: '0.8rem',
                        }}
                      >
                        Supprimer
                      </button>
                    )}
                  </div>
                </div>

                <div style={{ marginTop: '0.4rem' }}>
                  {review.rating === 'like'
                    ? ' J’aime'
                    : ' Je n’aime pas'}
                </div>

                {review.comment && (
                  <div
                    style={{
                      marginTop: '0.4rem',
                      opacity: 0.9,
                    }}
                  >
                    {review.comment}
                  </div>
                )}
              </article>
            );
          })
        )}
      </div>
    </section>
  );
}