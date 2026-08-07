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
  runtime?: number | null;
  seasons?: number;
  episodes?: number;
  episode_runtime?: number | null;
  chapters?: number;
  volumes?: number;
  synopsis?: string;
  year?: number | null;
  release_date?: string;
  first_air_date?: string;
  type: MediaType;
  favorite?: boolean;
  steldra_added_at?: string;
  steldra_last_interaction_at?: string;
}

export interface MyListItem {
  media: MediaItem;
  status: WatchStatus;
  watchCount?: number;
  favorite?: boolean;
  addedAt?: string | null;
  lastInteractionAt?: string | null;
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
};

export interface CustomList {
  id: string;
  user_id: string;
  name: string;
  description: string | null;
  is_ordered: boolean;
  created_at: string;
  updated_at: string;
}

export interface CustomListItem {
  id: string;
  list_id: string;
  media_id: string;
  media_type: string;
  media_data: MediaItem;
  position: number;
  created_at: string;
}
