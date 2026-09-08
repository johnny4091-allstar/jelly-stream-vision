import { createServerFn } from "@tanstack/react-start";

import { jfDelete, jfGet, jfPost } from "./jellyfin.server";
import { readJfSession } from "./session.server";
import type { JfItem } from "./jellyfin.types";

async function requireSession() {
  const s = await readJfSession();
  if (!s) throw new Error("Unauthorized");
  return s;
}

export interface HomeData {
  userName: string;
  views: JfItem[];
  resume: JfItem[];
  nextUp: JfItem[];
  rows: { title: string; viewId: string; items: JfItem[] }[];
  hero: JfItem | null;
}

export const getHomeFn = createServerFn({ method: "GET" }).handler(async (): Promise<HomeData> => {
  const s = await requireSession();
  const t = s.token;
  const viewsRes = await jfGet<{ Items: JfItem[] }>(`/Users/${s.userId}/Views`, t);
  const views = (viewsRes.Items ?? []).filter(
    (v) => v.CollectionType === "movies" || v.CollectionType === "tvshows",
  );
  const resumeRes = await jfGet<{ Items: JfItem[] }>(
    `/Users/${s.userId}/Items/Resume?Limit=12&MediaTypes=Video&Fields=Overview`,
    t,
  );
  const nextUpRes = await jfGet<{ Items: JfItem[] }>(
    `/Shows/NextUp?UserId=${s.userId}&Limit=12&Fields=Overview`,
    t,
  );
  const rows: HomeData["rows"] = [];
  for (const view of views) {
    const latest = await jfGet<JfItem[]>(
      `/Users/${s.userId}/Items/Latest?Limit=16&ParentId=${view.Id}&Fields=Overview`,
      t,
    );
    rows.push({ title: `Recently Added in ${view.Name}`, viewId: view.Id, items: latest ?? [] });
  }
  const hero =
    resumeRes.Items?.find((i) => i.Type === "Movie") ??
    rows.flatMap((r) => r.items).find((i) => i.Type === "Movie" || i.Type === "Series") ??
    null;
  return {
    userName: s.userName,
    views,
    resume: resumeRes.Items ?? [],
    nextUp: nextUpRes.Items ?? [],
    rows,
    hero,
  };
});

export const getItemFn = createServerFn({ method: "GET" })
  .inputValidator((data: { id: string }) => data)
  .handler(async ({ data }) => {
    const s = await requireSession();
    return await jfGet<JfItem>(
      `/Users/${s.userId}/Items/${data.id}?Fields=Overview,People,Genres,MediaSources`,
      s.token,
    );
  });

export const getSeasonsFn = createServerFn({ method: "GET" })
  .inputValidator((data: { seriesId: string }) => data)
  .handler(async ({ data }) => {
    const s = await requireSession();
    const res = await jfGet<{ Items: JfItem[] }>(
      `/Shows/${data.seriesId}/Seasons?UserId=${s.userId}&Fields=Overview`,
      s.token,
    );
    return res.Items ?? [];
  });

export const getEpisodesFn = createServerFn({ method: "GET" })
  .inputValidator((data: { seriesId: string; seasonId: string }) => data)
  .handler(async ({ data }) => {
    const s = await requireSession();
    const res = await jfGet<{ Items: JfItem[] }>(
      `/Shows/${data.seriesId}/Episodes?UserId=${s.userId}&SeasonId=${data.seasonId}&Fields=Overview`,
      s.token,
    );
    return res.Items ?? [];
  });

export const getLibraryItemsFn = createServerFn({ method: "GET" })
  .inputValidator((data: { viewId: string }) => data)
  .handler(async ({ data }) => {
    const s = await requireSession();
    const res = await jfGet<{ Items: JfItem[] }>(
      `/Users/${s.userId}/Items?ParentId=${data.viewId}&SortBy=SortName&SortOrder=Ascending&Fields=Overview&Limit=200&Recursive=true&IncludeItemTypes=Movie,Series`,
      s.token,
    );
    return res.Items ?? [];
  });

export const searchFn = createServerFn({ method: "GET" })
  .inputValidator((data: { term: string }) => data)
  .handler(async ({ data }) => {
    const s = await requireSession();
    if (!data.term.trim()) return [] as JfItem[];
    const res = await jfGet<{ Items: JfItem[] }>(
      `/Users/${s.userId}/Items?searchTerm=${encodeURIComponent(data.term)}&IncludeItemTypes=Movie,Series,Episode&Recursive=true&Limit=30&Fields=Overview`,
      s.token,
    );
    return res.Items ?? [];
  });

/** Watchlist = items favourited on the Jellyfin account ("My List"). */
export const getWatchlistFn = createServerFn({ method: "GET" }).handler(async () => {
  const s = await requireSession();
  const res = await jfGet<{ Items: JfItem[] }>(
    `/Users/${s.userId}/Items?Filters=IsFavorite&IncludeItemTypes=Movie,Series&Recursive=true&SortBy=DateCreated&SortOrder=Descending&Limit=200&Fields=Overview`,
    s.token,
  );
  return res.Items ?? [];
});

export const getPlaybackInfoFn = createServerFn({ method: "POST" })
  .inputValidator((data: { itemId: string; startTicks?: number; deviceId?: string }) => data)
  .handler(async ({ data }) => {
    const s = await requireSession();
    const res = await jfPost<{
      PlaySessionId: string;
      MediaSources: {
        Id: string;
        DefaultAudioStreamIndex?: number;
        TranscodingUrl?: string;
        SupportsDirectStream?: boolean;
        SupportsDirectPlay?: boolean;
        Container?: string;
        MediaStreams?: { Type: string; Index: number; IsDefault?: boolean }[];
      }[];
    }>(
      `/Items/${data.itemId}/PlaybackInfo?UserId=${s.userId}&StartTimeTicks=${data.startTicks ?? 0}`,
      {
        DeviceProfile: {
          // Browsers can only direct-play mp4/webm with browser-safe codecs.
          // Listing mkv/hevc here made TV episodes "direct play" and fail silently.
          MaxStreamingBitrate: 8_000_000,
          MaxStaticBitrate: 8_000_000,
          DirectPlayProfiles: [
            {
              Type: "Video",
              Container: "mp4,m4v",
              VideoCodec: "h264,vp9,av1",
              AudioCodec: "aac,mp3,opus",
            },
            { Type: "Video", Container: "webm", VideoCodec: "vp8,vp9,av1", AudioCodec: "vorbis,opus" },
          ],
          TranscodingProfiles: [
            {
              Type: "Video",
              Container: "ts",
              Protocol: "hls",
              VideoCodec: "h264",
              AudioCodec: "aac",
              MaxAudioChannels: "2",
              Context: "Streaming",
            },
          ],
          SubtitleProfiles: [],
        },

        AutoOpenLiveStream: true,
      },
      s.token,
      data.deviceId,
    );
    const src = res?.MediaSources?.[0];
    const audioIndex =
      src?.DefaultAudioStreamIndex ??
      src?.MediaStreams?.find((m) => m.Type === "Audio" && m.IsDefault)?.Index ??
      src?.MediaStreams?.find((m) => m.Type === "Audio")?.Index;
    return {
      playSessionId: res?.PlaySessionId ?? "",
      mediaSourceId: src?.Id ?? "",
      audioStreamIndex: audioIndex ?? null,
      // Jellyfin's own transcode URL already carries the correct, working parameters.
      transcodingUrl: src?.TranscodingUrl
        ? (() => {
            const url = new URL(src.TranscodingUrl, "http://jellyfin.local");
            // The proxy authenticates upstream; never expose the Jellyfin token in the browser URL.
            url.searchParams.delete("ApiKey");
            url.searchParams.delete("api_key");
            return `${url.pathname}${url.search}`;
          })()
        : null,
      supportsDirectPlay: Boolean(src?.SupportsDirectPlay),
      container: src?.Container ?? null,
    };

  });

export const reportPlayingFn = createServerFn({ method: "POST" })
  .inputValidator(
    (data: { itemId: string; positionTicks: number; playSessionId: string; kind: "Started" | "Progress" | "Stopped"; isPaused?: boolean; deviceId?: string }) => data,
  )
  .handler(async ({ data }) => {
    const s = await requireSession();
    // Progress reporting is best-effort telemetry: never let it break playback.
    try {
      await jfPost(
      `/Sessions/Playing/${data.kind}`,
      {
        ItemId: data.itemId,
        PlaySessionId: data.playSessionId,
        PositionTicks: Math.floor(data.positionTicks),
        CanSeek: true,
        IsPaused: data.isPaused ?? false,
        PlayMethod: "Transcode",
      },
      s.token,
      data.deviceId,
      );
    } catch (err) {
      console.warn("Jellyfin progress report failed", err);
      return { ok: false as const };
    }
    return { ok: true as const };
  });

/** Toggle favourite ("My List" / heart) on the Jellyfin account itself. */
export const setFavoriteFn = createServerFn({ method: "POST" })
  .inputValidator((data: { itemId: string; favorite: boolean }) => data)
  .handler(async ({ data }) => {
    const s = await requireSession();
    const path = `/Users/${s.userId}/FavoriteItems/${data.itemId}`;
    if (data.favorite) await jfPost(path, null, s.token);
    else await jfDelete(path, s.token);
    return { ok: true as const, favorite: data.favorite };
  });

/** Thumbs up / down / clear, stored as the Jellyfin user rating. */
export const setRatingFn = createServerFn({ method: "POST" })
  .inputValidator((data: { itemId: string; likes: boolean | null }) => data)
  .handler(async ({ data }) => {
    const s = await requireSession();
    const base = `/Users/${s.userId}/Items/${data.itemId}/Rating`;
    if (data.likes === null) await jfDelete(base, s.token);
    else await jfPost(`${base}?Likes=${data.likes}`, null, s.token);
    return { ok: true as const, likes: data.likes };
  });

/** Mark watched / unwatched on the Jellyfin account. */
export const setPlayedFn = createServerFn({ method: "POST" })
  .inputValidator((data: { itemId: string; played: boolean }) => data)
  .handler(async ({ data }) => {
    const s = await requireSession();
    const path = `/Users/${s.userId}/PlayedItems/${data.itemId}`;
    if (data.played) await jfPost(path, null, s.token);
    else await jfDelete(path, s.token);
    return { ok: true as const, played: data.played };
  });

/** Kill the server-side transcode for a play session so the next title can start. */
export const stopTranscodeFn = createServerFn({ method: "POST" })
  .inputValidator((data: { playSessionId: string; deviceId?: string }) => data)
  .handler(async ({ data }) => {
    const s = await requireSession();
    const q = new URLSearchParams({
      deviceId: data.deviceId ?? "aurora-web",
      playSessionId: data.playSessionId,
    });
    try {
      await jfDelete(`/Videos/ActiveEncodings?${q.toString()}`, s.token, data.deviceId);
    } catch {
      /* session may already be gone */
    }
    return { ok: true as const };
  });

export interface ActiveSession {
  id: string;
  userName: string;
  device: string;
  client: string;
  title: string | null;
  subtitle: string | null;
  itemId: string | null;
  isPaused: boolean;
  playMethod: string | null;
  positionSeconds: number;
  runtimeSeconds: number | null;
  lastActivity: string | null;
}

/** Live Jellyfin sessions (admin only) — who is playing what right now. */
export const getActiveSessionsFn = createServerFn({ method: "GET" }).handler(
  async (): Promise<ActiveSession[]> => {
    const s = await requireSession();
    if (!s.isAdmin) throw new Error("Forbidden");
    type Raw = {
      Id: string;
      UserName?: string;
      DeviceName?: string;
      Client?: string;
      LastActivityDate?: string;
      NowPlayingItem?: {
        Id: string;
        Name?: string;
        SeriesName?: string;
        Type?: string;
        IndexNumber?: number;
        ParentIndexNumber?: number;
        RunTimeTicks?: number;
      };
      PlayState?: { IsPaused?: boolean; PositionTicks?: number; PlayMethod?: string };
    };
    let raw: Raw[] = [];
    try {
      raw = await jfGet<Raw[]>("/Sessions?ActiveWithinSeconds=120");
    } catch (err) {
      console.warn("Jellyfin sessions fetch failed", err);
      return [];
    }
    return (raw ?? []).map((r) => {
      const np = r.NowPlayingItem;
      const ep =
        np?.Type === "Episode" && np.ParentIndexNumber != null && np.IndexNumber != null
          ? `S${np.ParentIndexNumber} E${np.IndexNumber} · ${np.Name ?? ""}`
          : null;
      return {
        id: r.Id,
        userName: r.UserName ?? "Unknown",
        device: r.DeviceName ?? "Unknown device",
        client: r.Client ?? "",
        title: np ? (np.SeriesName ?? np.Name ?? null) : null,
        subtitle: ep,
        itemId: np?.Id ?? null,
        isPaused: Boolean(r.PlayState?.IsPaused),
        playMethod: r.PlayState?.PlayMethod ?? null,
        positionSeconds: Math.floor((r.PlayState?.PositionTicks ?? 0) / 10_000_000),
        runtimeSeconds: np?.RunTimeTicks ? Math.floor(np.RunTimeTicks / 10_000_000) : null,
        lastActivity: r.LastActivityDate ?? null,
      };
    });
  },
);
