/** Frontière d'affichage : les anciennes données de lecture restent conservées. */
export const CINEMA_TYPES = ["movie", "tv", "drama", "anime"] as const;
export const isCinemaType = (type: unknown): boolean =>
  typeof type === "string" &&
  (CINEMA_TYPES as readonly string[]).includes(type);
export const isCinemaRow = (row: any): boolean =>
  isCinemaType(row?.media_data?.type || row?.media_type);
