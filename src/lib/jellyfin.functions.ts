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

  const resume = resumeRes.Items ?? [];
  // The app keeps its own watch record, so progress survives when the media
  // server misses a report. Use it to fill in bars and Continue Watching.
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: hist } = await supabaseAdmin
      .from("watch_history")
      .select("jf_item_id, title, subtitle, item_type, last_position_seconds, runtime_seconds, last_played_at")
      .eq("jf_user_id", s.userId)
      .order("last_played_at", { ascending: false })
      .limit(60);

    const pct = new Map<string, { percent: number; seconds: number }>();
    for (const h of hist ?? []) {
      const runtime = h.runtime_seconds ?? 0;
      const pos = h.last_position_seconds ?? 0;
      if (runtime <= 0 || pos <= 0) continue;
      const percent = (pos / runtime) * 100;
      if (percent < 1 || percent > 92) continue;
      if (!pct.has(h.jf_item_id)) pct.set(h.jf_item_id, { percent, seconds: pos });
    }

    const applyProgress = (items: JfItem[]) => {
      for (const it of items) {
        const p = pct.get(it.Id);
        if (!p) continue;
        const serverPct = it.UserData?.PlayedPercentage ?? 0;
        if (serverPct >= p.percent) continue;
        it.UserData = {
          ...(it.UserData ?? {}),
          PlayedPercentage: p.percent,
          PlaybackPositionTicks: Math.floor(p.seconds * 10_000_000),
        };
      }
    };
    applyProgress(resume);
    applyProgress(nextUpRes.Items ?? []);
    for (const r of rows) applyProgress(r.items);

    const missing = [...pct.keys()].filter((id) => !resume.some((i) => i.Id === id)).slice(0, 8);
    if (missing.length) {
      const extra = await jfGet<{ Items: JfItem[] }>(
        `/Users/${s.userId}/Items?Ids=${missing.join(",")}&Fields=Overview`,
        t,
      ).catch(() => ({ Items: [] as JfItem[] }));
      const found = (extra.Items ?? []).filter((i) => !i.UserData?.Played);
      applyProgress(found);
      resume.push(...found);
    }

    // Live TV has no position to resume, but the channel you were last on
    // belongs in Continue Watching too (last 12 hours).
    const cutoff = Date.now() - 12 * 60 * 60 * 1000;
    const seenChannels = new Set<string>();
    const liveItems: JfItem[] = [];
    for (const h of hist ?? []) {
      if (h.item_type !== "TvChannel") continue;
      if (new Date(h.last_played_at).getTime() < cutoff) continue;
      if (seenChannels.has(h.jf_item_id)) continue;
      seenChannels.add(h.jf_item_id);
      liveItems.push({
        Id: h.jf_item_id,
        Name: h.title,
        Type: "TvChannel",
        ...(h.subtitle ? { Overview: h.subtitle } : {}),
      });
      if (liveItems.length >= 4) break;
    }
    resume.unshift(...liveItems);
  } catch (err) {
    console.warn("history progress merge failed", err);
  }

  const hero =
    resume.find((i) => i.Type === "Movie") ??
    rows.flatMap((r) => r.items).find((i) => i.Type === "Movie" || i.Type === "Series") ??
    null;
  return {
    userName: s.userName,
    views,
    resume,
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
           IsExternal?: boolean;
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
    // Subtitles are disabled app-wide: never surface any tracks.
    const subtitleTracks: { index: number; language: string | null; label: string }[] = [];
    const canDirect = Boolean(src?.SupportsDirectPlay || src?.SupportsDirectStream);
    return {
      playSessionId: res?.PlaySessionId ?? crypto.randomUUID().replaceAll("-", ""),
      mediaSourceId: src?.Id ?? data.itemId,
      audioStreamIndex: audioIndex ?? null,
      audioTracks,
       subtitleTracks,
      // Jellyfin's own transcode URL already carries the correct, working parameters.
      transcodingUrl: src?.TranscodingUrl
        ? (() => {
            const url = new URL(src.TranscodingUrl, "http://jellyfin.local");
            // The proxy authenticates upstream; never expose the Jellyfin token in the browser URL.
            url.searchParams.delete("ApiKey");
            url.searchParams.delete("api_key");
            // Burning subtitles into the picture makes the server's encoder fail
            // outright ("Error starting ffmpeg"), so force external handling.
            url.searchParams.set("SubtitleMethod", "External");
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
    (data: { itemId: string; positionTicks: number; playSessionId: string; kind: "Started" | "Progress" | "Stopped"; isPaused?: boolean; deviceId?: string; mediaSourceId?: string; playMethod?: "DirectPlay" | "DirectStream" | "Transcode" }) => data,
  )
  .handler(async ({ data }) => {
    const s = await requireSession();
    const ticks = Math.max(0, Math.floor(data.positionTicks));
    // Progress reporting is best-effort telemetry: never let it break playback.
    try {
      await jfPost(
      `/Sessions/Playing/${data.kind}`,
      {
        UserId: s.userId,
        ItemId: data.itemId,
        ...(data.mediaSourceId ? { MediaSourceId: data.mediaSourceId } : {}),
        PlaySessionId: data.playSessionId,
        PositionTicks: ticks,
        CanSeek: true,
        IsPaused: data.isPaused ?? false,
        PlayMethod: data.playMethod ?? "Transcode",
      },

      s.token,
      data.deviceId,
      );
      // Belt and braces: the session report is transient, this writes the resume
      // position straight onto the user's item data so Continue Watching sticks.
      if (data.kind !== "Started" && ticks > 0) {
        await jfPost(
          `/Users/${s.userId}/PlayingItems/${data.itemId}/Progress?PositionTicks=${ticks}&IsPaused=${data.isPaused ?? false}&PlaySessionId=${encodeURIComponent(data.playSessionId)}`,
          null,
          s.token,
          data.deviceId,
        ).catch(() => null);
      }
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

/**
 * Resolve who's watching: Emby sessions sometimes omit UserName, so map the
 * session's UserId/UserName through the media server's user list and Aurora's
 * own accounts (jf_user_id / jf_username) to show the Aurora sign-in name.
 */
async function buildUserNameResolver(): Promise<
  (userId?: string, userName?: string) => string
> {
  const jfUsers = await jfGet<{ Id: string; Name?: string }[]>("/Users").catch(
    () => [] as { Id: string; Name?: string }[],
  );
  const mediaName = new Map((jfUsers ?? []).map((u) => [u.Id, (u.Name ?? "").trim()]));
  type Row = { username: string; jf_username: string; jf_user_id: string | null };
  let rows: Row[] = [];
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data } = await supabaseAdmin
      .from("app_users")
      .select("username, jf_username, jf_user_id");
    rows = (data ?? []) as Row[];
  } catch {
    /* name resolution is best-effort */
  }
  const byJfId = new Map(rows.filter((r) => r.jf_user_id).map((r) => [r.jf_user_id!, r.username]));
  const byJfName = new Map(rows.map((r) => [r.jf_username.toLowerCase(), r.username]));
  return (userId, userName) => {
    if (userId && byJfId.has(userId)) return byJfId.get(userId)!;
    const media = (userName?.trim() || (userId ? (mediaName.get(userId) ?? "") : "")).trim();
    if (media) {
      const aurora = byJfName.get(media.toLowerCase());
      return aurora ?? media;
    }
    return "Unknown";
  };
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

/** Suggestions for the search bar: fast, name-only, small result set. */
export const searchSuggestFn = createServerFn({ method: "GET" })
  .inputValidator((data: { term: string }) => data)
  .handler(async ({ data }) => {
    const s = await requireSession();
    const term = data.term.trim();
    if (!term) return [] as JfItem[];
    const res = await jfGet<{ Items: JfItem[] }>(
      `/Users/${s.userId}/Items?searchTerm=${encodeURIComponent(term)}&IncludeItemTypes=Movie,Series&Recursive=true&Limit=8`,
      s.token,
    ).catch(() => ({ Items: [] as JfItem[] }));
    return res.Items ?? [];
  });

/** Recommendations seeded from what the user has been watching. */
export const getRecommendationsFn = createServerFn({ method: "GET" }).handler(
  async (): Promise<{ seedTitle: string | null; items: JfItem[] }> => {
    const s = await requireSession();
    const t = s.token;
    const resume = await jfGet<{ Items: JfItem[] }>(
      `/Users/${s.userId}/Items/Resume?Limit=4&MediaTypes=Video`,
      t,
    ).catch(() => ({ Items: [] as JfItem[] }));
    const seeds = (resume.Items ?? []).slice(0, 3);
    const seen = new Set(seeds.map((i) => i.Id));
    const out: JfItem[] = [];
    for (const seed of seeds) {
      const seedId = seed.SeriesId ?? seed.Id;
      const sim = await jfGet<{ Items: JfItem[] }>(
        `/Items/${seedId}/Similar?UserId=${s.userId}&Limit=12&Fields=Overview`,
        t,
      ).catch(() => ({ Items: [] as JfItem[] }));
      for (const item of sim.Items ?? []) {
        if (seen.has(item.Id)) continue;
        seen.add(item.Id);
        out.push(item);
      }
    }
    if (out.length < 8) {
      const fallback = await jfGet<{ Items: JfItem[] }>(
        `/Users/${s.userId}/Items?IncludeItemTypes=Movie,Series&Recursive=true&SortBy=Random&Limit=20&Fields=Overview`,
        t,
      ).catch(() => ({ Items: [] as JfItem[] }));
      for (const item of fallback.Items ?? []) {
        if (seen.has(item.Id)) continue;
        seen.add(item.Id);
        out.push(item);
      }
    }
    return {
      seedTitle: seeds[0]?.SeriesName ?? seeds[0]?.Name ?? null,
      items: out.slice(0, 20),
    };
  },
);
