export type MediaType =
  | 'movie'
  | 'tv'
  | 'drama'
  | 'anime'
  | 'manga'
  | 'manhwa';

export type WatchStatus =
  | 'vu'
  | 'a_voir'
  | 'en_cours';

export type FilterStatus =
  | 'tout'
  | 'termine'
  | 'en_cours'
  | 'a_voir';

export type ReviewRating = 'like' | 'dislike';

export interface MediaItem {
  id: string | number;
  title: string;
  poster_path?: string;
  runtime?: number;
  seasons?: number;
  episodes?: number;
  chapters?: number;
  volumes?: number;
  synopsis?: string;
  type: MediaType;
}

export interface MyListItem {
  media: MediaItem;
  status: WatchStatus;
  watchCount?: number;
}

export interface MediaDetails {
  synopsis: string;
  actors: unknown[];
  seasons_count: number;
  authors?: string[];
}

export interface SeasonEpisode {
  id: string | number;
  episode_number: number;
  name: string;
}

export interface MediaReview {
  id: string | number;
  user_id?: string | null;
  user_name?: string | null;
  media_id: string;
  media_type: MediaType;
  rating: ReviewRating;
  comment?: string;
  created_at: string;
}