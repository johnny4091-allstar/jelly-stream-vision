export interface JfUserData {
  PlayedPercentage?: number;
  PlaybackPositionTicks?: number;
  Played?: boolean;
  UnplayedItemCount?: number;
}

export interface JfItem {
  Id: string;
  Name: string;
  Type: string;
  Overview?: string;
  ProductionYear?: number;
  OfficialRating?: string;
  CommunityRating?: number;
  RunTimeTicks?: number;
  SeriesName?: string;
  ParentIndexNumber?: number;
  IndexNumber?: number;
  SeasonId?: string;
  SeriesId?: string;
  ImageTags?: Record<string, string>;
  BackdropImageTags?: string[];
  ParentBackdropImageTags?: string[];
  ParentBackdropItemId?: string;
  UserData?: JfUserData;
  MediaSources?: { Id: string }[];
  People?: { Name: string; Role?: string; Type: string }[];
  Genres?: string[];
  ChildCount?: number;
  CollectionType?: string;
}

export function itemImageUrl(id: string, type = "Primary", maxWidth = 500) {
  return `/api/proxy/Items/${id}/Images/${type}?maxWidth=${maxWidth}&quality=85`;
}

export function backdropUrl(item: JfItem, maxWidth = 1600) {
  if (item.Type === "Episode" && item.ParentBackdropItemId) {
    return `/api/proxy/Items/${item.ParentBackdropItemId}/Images/Backdrop/0?maxWidth=${maxWidth}&quality=80`;
  }
  if (item.BackdropImageTags?.length) {
    return `/api/proxy/Items/${item.Id}/Images/Backdrop/0?maxWidth=${maxWidth}&quality=80`;
  }
  if (item.ParentBackdropItemId) {
    return `/api/proxy/Items/${item.ParentBackdropItemId}/Images/Backdrop/0?maxWidth=${maxWidth}&quality=80`;
  }
  return itemImageUrl(item.Id, "Primary", maxWidth);
}

export function posterOf(item: JfItem): { id: string; type: string } {
  if (item.Type === "Episode" && item.SeriesId) return { id: item.SeriesId, type: "Primary" };
  if (item.Type === "Season" && item.SeriesId) return { id: item.SeriesId, type: "Primary" };
  return { id: item.Id, type: "Primary" };
}

export function ticksToSeconds(ticks?: number) {
  return ticks ? ticks / 10_000_000 : 0;
}

export function formatRuntime(ticks?: number) {
  const mins = Math.round(ticksToSeconds(ticks) / 60);
  if (!mins) return "";
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return h ? `${h}h ${m}m` : `${m}m`;
}

export function episodeLabel(item: JfItem) {
  if (item.Type !== "Episode") return "";
  const s = item.ParentIndexNumber ?? 0;
  const e = item.IndexNumber ?? 0;
  return `S${s} · E${e}`;
}
