import { createServerFn } from "@tanstack/react-start";
import { clearSession } from "@tanstack/react-start/server";

import { jfDelete, jfGet, jfPost } from "./jellyfin.server";
import { getJfSessionConfig, readJfSession } from "./session.server";
import type { JfItem } from "./jellyfin.types";

async function requireSession() {
  const s = await readJfSession();
  if (!s) throw new Error("Unauthorized");
  return s;
}

/** A session minted against the old server is no longer valid; drop it. */
async function dropStaleSession(err: unknown): Promise<never> {
  const msg = err instanceof Error ? err.message : String(err);
  if (msg.includes(" 401 ")) {
    await clearSession(getJfSessionConfig());
    throw new Error("Unauthorized");
  }
  throw err;
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
  const viewsRes = await jfGet<{ Items: JfItem[] }>(`/Users/${s.userId}/Views`, t).catch(
    dropStaleSession,
  );
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
    const fields = "Overview,People,Genres,MediaSources";
    try {
      return await jfGet<JfItem>(
        `/Users/${s.userId}/Items/${data.id}?Fields=${fields}`,
        s.token,
      );
    } catch (error) {
      // Older links could lose the final character of Jellyfin's 32-character ID.
      // Resolve a unique hexadecimal prefix so those links remain usable.
      if (!/^[a-f0-9]{24,31}$/i.test(data.id)) throw error;
      const result = await jfGet<{ Items?: JfItem[] }>(
        `/Users/${s.userId}/Items?Recursive=true&IncludeItemTypes=Movie,Episode,Series&Fields=${fields}&Limit=10000`,
        s.token,
      );
      const matches = (result.Items ?? []).filter((item) => item.Id.startsWith(data.id));
      const match = matches[0];
      if (matches.length !== 1 || !match) throw error;
      return match;
    }
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

export interface ClientDirectPlayProfile {
  container: string;
  videoCodecs: string[];
  audioCodecs: string[];
}

const FALLBACK_DIRECT_PLAY: ClientDirectPlayProfile[] = [
  { container: "mp4,m4v", videoCodecs: ["h264", "vp9", "av1"], audioCodecs: ["aac", "mp3", "opus"] },
  { container: "webm", videoCodecs: ["vp8", "vp9", "av1"], audioCodecs: ["vorbis", "opus"] },
];

export const getPlaybackInfoFn = createServerFn({ method: "POST" })
  .inputValidator(
    (data: {
      itemId: string;
      startTicks?: number;
      audioStreamIndex?: number;
      deviceId?: string;
      capabilities?: ClientDirectPlayProfile[];
    }) => data,
  )
  .handler(async ({ data }) => {
    const s = await requireSession();
    // Direct-play profiles come from what the device reports it can decode, so
    // MKV/HEVC/AC3 files play untouched where supported and transcode elsewhere.
    const caps =
      data.capabilities && data.capabilities.length ? data.capabilities : FALLBACK_DIRECT_PLAY;
    const directPlayProfiles = caps
      .filter((c) => c.container && c.videoCodecs?.length && c.audioCodecs?.length)
      .map((c) => ({
        Type: "Video",
        Container: c.container,
        VideoCodec: c.videoCodecs.join(","),
        AudioCodec: c.audioCodecs.join(","),
      }));
    type PlaybackInfoResponse = {
      PlaySessionId: string;
      MediaSources: {
        Id: string;
        DefaultAudioStreamIndex?: number;
        TranscodingUrl?: string;
        SupportsDirectStream?: boolean;
        SupportsDirectPlay?: boolean;
        Container?: string;
        MediaStreams?: {
          Type: string;
          Index: number;
          IsDefault?: boolean;
          Language?: string;
          DisplayTitle?: string;
          Title?: string;
          Codec?: string;
          Channels?: number;
        }[];
      }[];
    };
    const { getBitrateCap } = await import("./settings.server");
    const cap = await getBitrateCap();
    const playbackPath =
      `/Items/${data.itemId}/PlaybackInfo?UserId=${s.userId}&StartTimeTicks=${data.startTicks ?? 0}` +
      // Never burn subtitles into the picture: that forces a full re-encode, which
      // pins the server CPU and stalls playback a few minutes in.
      `&SubtitleStreamIndex=-1&MaxStreamingBitrate=${cap}` +
      (data.audioStreamIndex != null ? `&AudioStreamIndex=${data.audioStreamIndex}` : "");
    const fixedProfile = {
        DeviceProfile: {
          // Capped so the server remuxes (copies) H.264 video into HLS instead of
          // re-encoding it at an absurd bitrate.
          MaxStreamingBitrate: cap,
          MaxStaticBitrate: 200_000_000,
          DirectPlayProfiles: directPlayProfiles,
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
          SubtitleProfiles: [
            { Format: "vtt", Method: "External" },
            { Format: "srt", Method: "External" },
            { Format: "subrip", Method: "External" },
          ],
        },

        AutoOpenLiveStream: true,
    };
    let res: PlaybackInfoResponse | null = null;
    try {
      res = await jfPost<PlaybackInfoResponse>(playbackPath, fixedProfile, s.token, data.deviceId);
    } catch (error) {
      // Some Jellyfin versions reject detailed browser profiles intermittently.
      // Retry with the minimal HLS profile before falling back to the known-good
      // master playlist endpoint.
      console.warn("Jellyfin playback negotiation failed; retrying minimal HLS", error);
      try {
        res = await jfPost<PlaybackInfoResponse>(
          playbackPath,
          {
            DeviceProfile: {
              MaxStreamingBitrate: cap,
              MaxStaticBitrate: cap,
              DirectPlayProfiles: [],
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
              // External-only: an empty list makes the server burn subtitles in,
              // which kills its encoder.
              SubtitleProfiles: [
                { Format: "vtt", Method: "External" },
                { Format: "srt", Method: "External" },
                { Format: "subrip", Method: "External" },
              ],
            },
            AutoOpenLiveStream: true,
          },
          s.token,
          data.deviceId,
        );
      } catch (retryError) {
        console.warn("Jellyfin playback negotiation unavailable; using direct HLS endpoint", retryError);
      }
    }
    const src = res?.MediaSources?.[0];
    const audioIndex =
      data.audioStreamIndex ??
      src?.DefaultAudioStreamIndex ??
      src?.MediaStreams?.find((m) => m.Type === "Audio" && m.IsDefault)?.Index ??
      src?.MediaStreams?.find((m) => m.Type === "Audio")?.Index;
    const audioTracks = (src?.MediaStreams ?? [])
      .filter((m) => m.Type === "Audio")
      .map((m) => ({
        index: m.Index,
        language: m.Language ?? null,
        label: m.DisplayTitle ?? m.Title ?? m.Language ?? `Track ${m.Index}`,
        codec: m.Codec ?? null,
        channels: m.Channels ?? null,
      }));
    const canDirect = Boolean(src?.SupportsDirectPlay || src?.SupportsDirectStream);
    return {
      playSessionId: res?.PlaySessionId ?? crypto.randomUUID().replaceAll("-", ""),
      mediaSourceId: src?.Id ?? data.itemId,
      audioStreamIndex: audioIndex ?? null,
      audioTracks,
      // Jellyfin's own transcode URL already carries the correct, working parameters.
      transcodingUrl: src?.TranscodingUrl
        ? (() => {
            const url = new URL(src.TranscodingUrl, "http://jellyfin.local");
            // The proxy authenticates upstream; never expose the Jellyfin token in the browser URL.
            url.searchParams.delete("ApiKey");
            url.searchParams.delete("api_key");
            // Burning subtitles into the picture makes the server's encoder fail
            // outright ("Error starting ffmpeg"), so strip it in every case.
            url.searchParams.delete("SubtitleMethod");
            url.searchParams.set("SubtitleStreamIndex", "-1");
            return `${url.pathname}${url.search}`;
          })()
        : null,
      supportsDirectPlay: Boolean(src?.SupportsDirectPlay),
      supportsDirectStream: Boolean(src?.SupportsDirectStream),
      playMethod: (src && canDirect
        ? src?.SupportsDirectPlay
          ? "DirectPlay"
          : "DirectStream"
        : "Transcode") as "DirectPlay" | "DirectStream" | "Transcode",
      container: src?.Container ?? null,
      usedFallback: !src,
    };

  });


export const reportPlayingFn = createServerFn({ method: "POST" })
  .inputValidator(
    (data: { itemId: string; positionTicks: number; playSessionId: string; kind: "Started" | "Progress" | "Stopped"; isPaused?: boolean; deviceId?: string; playMethod?: "DirectPlay" | "DirectStream" | "Transcode" }) => data,
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
        PlayMethod: data.playMethod ?? "Transcode",
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

/**
 * Series and Season IDs are not playable — Jellyfin returns 500 for PlaybackInfo
 * on them. Resolve those to the next-up (or first) episode before playback.
 */
export const getPlayableItemFn = createServerFn({ method: "GET" })
  .inputValidator((data: { id: string }) => data)
  .handler(async ({ data }) => {
    const s = await requireSession();
    const fields = "Overview,People,Genres,MediaSources";
    const item = await getItemFn({ data: { id: data.id } });
    if (item.Type !== "Series" && item.Type !== "Season") return item;

    const seriesId = item.Type === "Season" ? (item.SeriesId ?? item.Id) : item.Id;
    const nextUp = await jfGet<{ Items?: JfItem[] }>(
      `/Shows/NextUp?UserId=${s.userId}&SeriesId=${seriesId}&Limit=1&Fields=${fields}`,
      s.token,
    );
    const candidate =
      nextUp.Items?.[0] ??
      (
        await jfGet<{ Items?: JfItem[] }>(
          `/Shows/${seriesId}/Episodes?UserId=${s.userId}${item.Type === "Season" ? `&SeasonId=${item.Id}` : ""}&Limit=1&Fields=${fields}`,
          s.token,
        )
      ).Items?.[0];
    return candidate ?? item;
  });

export interface ServerUsage {
  serverName: string;
  version: string;
  os: string;
  activeStreams: number;
  transcodingStreams: number;
  directStreams: number;
  /** Sum of the bitrates the server is currently pushing, in bits per second. */
  totalBitrate: number;
  capBps: number;
  streams: {
    id: string;
    userName: string;
    title: string;
    method: string;
    bitrate: number | null;
    framerate: number | null;
    videoCodec: string | null;
    audioCodec: string | null;
    hardware: boolean;
    reasons: string[];
  }[];
}

/** Server load + bandwidth Aurora is pulling right now (admin only). */
export const getServerUsageFn = createServerFn({ method: "GET" }).handler(
  async (): Promise<ServerUsage> => {
    const s = await requireSession();
    if (!s.isAdmin) throw new Error("Forbidden");
    const { getBitrateCap } = await import("./settings.server");
    const capBps = await getBitrateCap();

    type Info = { ServerName?: string; Version?: string; OperatingSystemDisplayName?: string };
    type Raw = {
      Id: string;
      UserName?: string;
      NowPlayingItem?: { Name?: string; SeriesName?: string };
      PlayState?: { PlayMethod?: string };
      TranscodingInfo?: {
        Bitrate?: number;
        Framerate?: number;
        VideoCodec?: string;
        AudioCodec?: string;
        IsVideoDirect?: boolean;
        IsAudioDirect?: boolean;
        HardwareAccelerationType?: string;
        TranscodeReasons?: string[];
      };
    };

    let info: Info = {};
    let raw: Raw[] = [];
    try {
      [info, raw] = await Promise.all([
        jfGet<Info>("/System/Info"),
        jfGet<Raw[]>("/Sessions?ActiveWithinSeconds=120"),
      ]);
    } catch (err) {
      console.warn("Server usage fetch failed", err);
    }

    const playing = (raw ?? []).filter((r) => r.NowPlayingItem);
    const streams = playing.map((r) => {
      const t = r.TranscodingInfo;
      const method = r.PlayState?.PlayMethod ?? "Unknown";
      return {
        id: r.Id,
        userName: r.UserName ?? "Unknown",
        title: r.NowPlayingItem?.SeriesName ?? r.NowPlayingItem?.Name ?? "Unknown",
        method,
        bitrate: t?.Bitrate ?? null,
        framerate: t?.Framerate ?? null,
        videoCodec: t?.VideoCodec ?? null,
        audioCodec: t?.AudioCodec ?? null,
        hardware: Boolean(t?.HardwareAccelerationType),
        reasons: t?.TranscodeReasons ?? [],
      };
    });

    return {
      serverName: info.ServerName ?? "Media server",
      version: info.Version ?? "",
      os: info.OperatingSystemDisplayName ?? "",
      activeStreams: streams.length,
      transcodingStreams: streams.filter((x) => x.method === "Transcode").length,
      directStreams: streams.filter((x) => x.method !== "Transcode").length,
      totalBitrate: streams.reduce((sum, x) => sum + (x.bitrate ?? 0), 0),
      capBps,
      streams,
    };
  },
);

/** Change the streaming quality ceiling (admin only). */
export const setBitrateCapFn = createServerFn({ method: "POST" })
  .inputValidator((input: { mbps: number }) => input)
  .handler(async ({ data }): Promise<{ capBps: number }> => {
    const s = await requireSession();
    if (!s.isAdmin) throw new Error("Forbidden");
    const { setBitrateCap } = await import("./settings.server");
    const capBps = await setBitrateCap(Math.round(data.mbps * 1_000_000));
    return { capBps };
  });
