export interface PosterRecord {
  jfItemId: string;
  title: string;
  year: number | null;
  genres: string[];
  rating: string | null;
  coverUrl: string | null;
  itemType: string;
}

export function posterCoverUrl(p: PosterRecord, maxWidth = 600) {
  return p.coverUrl ?? `/api/proxy/Items/${p.jfItemId}/Images/Primary?maxWidth=${maxWidth}&quality=85`;
}
