import { createServerFn } from "@tanstack/react-start";

import { jfDelete, jfGet, jfPost } from "./jellyfin.server";
import { readJfSession } from "./session.server";

async function requireSession() {
  const s = await readJfSession();
  if (!s) throw new Error("Unauthorized");
  return s;
}

export interface LiveProgramLite {
  id: string;
  name: string;
  start: string | null;
  end: string | null;
}

export interface LiveChannel {
  id: string;
  name: string;
  number: string;
  hasImage: boolean;
  favorite: boolean;
  category: string;
  groups: { id: string; label: string }[];
  now: LiveProgramLite | null;
}

export interface LiveCategory {
  id: string;
  label: string;
  count: number;
}

/** Keyword rules used to tag channels into browsable categories. */
const CATEGORY_RULES: { id: string; keywords: string[] }[] = [
  {
    id: "sports",
    keywords: [
      "sport", "espn", "nfl", "nba", "mlb", "nhl", "golf", "tennis", "ufc", "wwe", "fight",
      "racing", "nascar", "f1", "soccer", "futbol", "fútbol", "rugby", "cricket", "bein",
      "dazn", "fs1", "fs2", "tsn", "sportsnet", "olympic", "boxing", "motogp", "pga",
    ],
  },
  {
    id: "news",
    keywords: [
      "news", "cnn", "fox news", "msnbc", "bbc", "cnbc", "bloomberg", "al jazeera", "newsmax",
      "oan", "weather", "c-span", "cspan", "sky news", "noticias",
    ],
  },
  {
    id: "kids",
    keywords: [
      "kid", "cartoon", "nick", "disney", "boomerang", "pbs kids", "baby", "junior", "teen",
      "toon", "family", "anime",
    ],
  },
  {
    id: "movies",
    keywords: [
      "movie", "cinema", "film", "hbo", "showtime", "starz", "cinemax", "epix", "mgm", "amc",
      "tcm", "screen", "flix",
    ],
  },
  {
    id: "music",
    keywords: ["music", "mtv", "vh1", "cmt", "vevo", "radio", "concert", "hits"],
  },
  {
    id: "documentary",
    keywords: [
      "discovery", "history", "nat geo", "national geographic", "animal", "science", "smithsonian",
      "documentary", "docu", "investigation", "travel",
    ],
  },
  {
    id: "entertainment",
    keywords: [
      "abc", "nbc", "cbs", "fox", "cw", "tnt", "tbs", "usa", "bravo", "lifetime", "e!", "fx",
      "comedy", "paramount", "syfy", "tlc", "hgtv", "food", "oxygen", "we tv", "ion", "reality",
    ],
  },
];

function categoryOf(name: string) {
  const lower = name.toLowerCase();
  for (const rule of CATEGORY_RULES) {
    if (rule.keywords.some((keyword) => lower.includes(keyword))) return rule.id;
  }
  return "other";
}

function groupId(label: string) {
  return label.trim().toLocaleLowerCase().replace(/[^\p{L}\p{N}]+/gu, "-").replace(/^-|-$/g, "");
}

function groupsOf(channel: Pick<RawChannel, "Name" | "Genres" | "Tags">) {
  const serverGroups = [...(channel.Genres ?? []), ...(channel.Tags ?? [])]
    .map((label) => label.trim())
    .filter(Boolean);
  const unique = [...new Map(serverGroups.map((label) => [groupId(label), label])).entries()]
    .filter(([id]) => Boolean(id))
    .map(([id, label]) => ({ id, label }));
  if (unique.length) return unique;
  const fallback = categoryOf(channel.Name ?? "");
  return [{ id: fallback, label: fallback.charAt(0).toUpperCase() + fallback.slice(1) }];
}

type RawChannel = {
  Id: string;
  Name?: string;
  Number?: string;
  ChannelNumber?: string;
  ImageTags?: Record<string, string>;
  UserData?: { IsFavorite?: boolean };
  Genres?: string[];
  Tags?: string[];
  CurrentProgram?: {
    Id: string;
    Name?: string;
    StartDate?: string;
    EndDate?: string;
  };
};

/** The channel list is large (thousands of rows); cache it briefly per user. */
const channelCache = new Map<string, { at: number; items: LiveChannel[] }>();
const CHANNEL_TTL = 60_000;

async function loadChannels(userId: string, token: string): Promise<LiveChannel[]> {
  const cached = channelCache.get(userId);
  if (cached && Date.now() - cached.at < CHANNEL_TTL) return cached.items;
  const res = await jfGet<{ Items?: RawChannel[] }>(
    `/LiveTv/Channels?UserId=${userId}&AddCurrentProgram=true&EnableUserData=true&EnableImages=true&Fields=Genres,Tags`,
    token,
  );
  const items: LiveChannel[] = (res.Items ?? []).map((c) => {
    const name = c.Name ?? "Channel";
    const groups = groupsOf(c);
    return {
      id: c.Id,
      name,
      number: c.ChannelNumber ?? c.Number ?? "",
      hasImage: Boolean(c.ImageTags?.["Primary"]),
      favorite: Boolean(c.UserData?.IsFavorite),
      category: categoryOf(name),
      groups,
      now: c.CurrentProgram
        ? {
            id: c.CurrentProgram.Id,
            name: c.CurrentProgram.Name ?? "",
            start: c.CurrentProgram.StartDate ?? null,
            end: c.CurrentProgram.EndDate ?? null,
          }
        : null,
    };
  });
  channelCache.set(userId, { at: Date.now(), items });
  return items;
}

export const getLiveChannelsFn = createServerFn({ method: "GET" })
  .inputValidator(
    (data: { search?: string; category?: string; favoritesOnly?: boolean; page?: number; pageSize?: number }) =>
      data,
  )
  .handler(async ({ data }) => {
    const s = await requireSession();
    const all = await loadChannels(s.userId, s.token);
    const categories: LiveCategory[] = [];
    const counts = new Map<string, number>();
    const labels = new Map<string, string>();
    for (const c of all) {
      for (const group of c.groups) {
        counts.set(group.id, (counts.get(group.id) ?? 0) + 1);
        labels.set(group.id, group.label);
      }
    }
    for (const [id, count] of counts) categories.push({ id, label: labels.get(id) ?? id, count });
    categories.sort((a, b) => b.count - a.count);

    const term = (data.search ?? "").trim().toLowerCase();
    let list = all;
    if (data.favoritesOnly) list = list.filter((c) => c.favorite);
    if (data.category && data.category !== "all")
      list = list.filter((c) => c.groups.some((group) => group.id === data.category));
    if (term)
      list = list.filter(
        (c) => c.name.toLowerCase().includes(term) || c.number.toLowerCase().startsWith(term),
      );

    const pageSize = Math.min(Math.max(data.pageSize ?? 60, 12), 200);
    const page = Math.max(data.page ?? 0, 0);
    return {
      total: list.length,
      favoriteCount: all.filter((c) => c.favorite).length,
      categories,
      channels: list.slice(page * pageSize, page * pageSize + pageSize),
    };
  });

export interface GuideProgram {
  id: string;
  channelId: string;
  name: string;
  overview: string | null;
  start: string | null;
  end: string | null;
  isSeries: boolean;
  isNews: boolean;
  isSports: boolean;
  isKids: boolean;
}

/** Programs airing on the given channels inside a time window. */
export const getGuideFn = createServerFn({ method: "GET" })
  .inputValidator((data: { channelIds: string[]; startIso?: string; hours?: number }) => data)
  .handler(async ({ data }): Promise<GuideProgram[]> => {
    const s = await requireSession();
    if (!data.channelIds.length) return [];
    const start = data.startIso ? new Date(data.startIso) : new Date();
    const end = new Date(start.getTime() + (data.hours ?? 4) * 3_600_000);
    type Raw = {
      Id: string;
      ChannelId: string;
      Name?: string;
      Overview?: string;
      StartDate?: string;
      EndDate?: string;
      IsSeries?: boolean;
      IsNews?: boolean;
      IsSports?: boolean;
      IsKids?: boolean;
    };
    const query = new URLSearchParams({
      UserId: s.userId,
      ChannelIds: data.channelIds.join(","),
      MinEndDate: start.toISOString(),
      MaxStartDate: end.toISOString(),
      SortBy: "StartDate",
      Fields: "Overview",
      Limit: "2000",
    });
    const res = await jfGet<{ Items?: Raw[] }>(`/LiveTv/Programs?${query.toString()}`, s.token).catch(
      () => ({ Items: [] as Raw[] }),
    );
    return (res.Items ?? []).map((p) => ({
      id: p.Id,
      channelId: p.ChannelId,
      name: p.Name ?? "",
      overview: p.Overview ?? null,
      start: p.StartDate ?? null,
      end: p.EndDate ?? null,
      isSeries: Boolean(p.IsSeries),
      isNews: Boolean(p.IsNews),
      isSports: Boolean(p.IsSports),
      isKids: Boolean(p.IsKids),
    }));
  });

/**
 * Public guide preview for the landing page — no sign-in required.
 * Uses the server API key only; returns a small slice of channels with
 * current and upcoming programs. Never exposes user data.
 */
export const getPublicGuideFn = createServerFn({ method: "GET" }).handler(
  async (): Promise<{ channels: LiveChannel[]; programs: GuideProgram[] }> => {
    const res = await jfGet<{ Items?: RawChannel[] }>(
      `/LiveTv/Channels?AddCurrentProgram=true&EnableImages=true&Limit=40&SortBy=SortName`,
    );
    const channels: LiveChannel[] = (res.Items ?? []).map((c) => ({
      id: c.Id,
      name: c.Name ?? "Channel",
      number: c.ChannelNumber ?? c.Number ?? "",
      hasImage: Boolean(c.ImageTags?.["Primary"]),
      favorite: false,
      category: categoryOf(c.Name ?? ""),
      groups: groupsOf(c),
      now: c.CurrentProgram
        ? {
            id: c.CurrentProgram.Id,
            name: c.CurrentProgram.Name ?? "",
            start: c.CurrentProgram.StartDate ?? null,
            end: c.CurrentProgram.EndDate ?? null,
          }
        : null,
    }));
    if (!channels.length) return { channels: [], programs: [] };

    const start = new Date();
    const end = new Date(start.getTime() + 6 * 3_600_000);
    type Raw = {
      Id: string;
      ChannelId: string;
      Name?: string;
      Overview?: string;
      StartDate?: string;
      EndDate?: string;
      IsSeries?: boolean;
      IsNews?: boolean;
      IsSports?: boolean;
      IsKids?: boolean;
    };
    const query = new URLSearchParams({
      ChannelIds: channels.map((c) => c.id).join(","),
      MinEndDate: start.toISOString(),
      MaxStartDate: end.toISOString(),
      SortBy: "StartDate",
      Limit: "800",
    });
    const progs = await jfGet<{ Items?: Raw[] }>(`/LiveTv/Programs?${query.toString()}`).catch(
      () => ({ Items: [] as Raw[] }),
    );
    const programs: GuideProgram[] = (progs.Items ?? []).map((p) => ({
      id: p.Id,
      channelId: p.ChannelId,
      name: p.Name ?? "",
      overview: null,
      start: p.StartDate ?? null,
      end: p.EndDate ?? null,
      isSeries: Boolean(p.IsSeries),
      isNews: Boolean(p.IsNews),
      isSports: Boolean(p.IsSports),
      isKids: Boolean(p.IsKids),
    }));
    return { channels, programs };
  },
);

export const getLiveChannelFn = createServerFn({ method: "GET" })
  .inputValidator((data: { channelId: string }) => data)
  .handler(async ({ data }): Promise<LiveChannel | null> => {
    const s = await requireSession();
    const all = await loadChannels(s.userId, s.token);
    return all.find((c) => c.id === data.channelId) ?? null;
  });

export interface RecordingItem {
  id: string;
  name: string;
  subtitle: string | null;
  overview: string | null;
  channelName: string | null;
  start: string | null;
  runtimeSeconds: number | null;
  hasImage: boolean;
}

export const getRecordingsFn = createServerFn({ method: "GET" }).handler(
  async (): Promise<RecordingItem[]> => {
    const s = await requireSession();
    type Raw = {
      Id: string;
      Name?: string;
      EpisodeTitle?: string;
      Overview?: string;
      ChannelName?: string;
      StartDate?: string;
      RunTimeTicks?: number;
      ImageTags?: Record<string, string>;
    };
    const res = await jfGet<{ Items?: Raw[] }>(
      `/LiveTv/Recordings?UserId=${s.userId}&Fields=Overview&Limit=200`,
      s.token,
    ).catch(() => ({ Items: [] as Raw[] }));
    return (res.Items ?? []).map((r) => ({
      id: r.Id,
      name: r.Name ?? "Recording",
      subtitle: r.EpisodeTitle ?? null,
      overview: r.Overview ?? null,
      channelName: r.ChannelName ?? null,
      start: r.StartDate ?? null,
      runtimeSeconds: r.RunTimeTicks ? Math.floor(r.RunTimeTicks / 10_000_000) : null,
      hasImage: Boolean(r.ImageTags?.["Primary"]),
    }));
  },
);

export interface TimerItem {
  id: string;
  name: string;
  channelName: string | null;
  start: string | null;
  end: string | null;
  series: boolean;
  status: string | null;
}

export const getTimersFn = createServerFn({ method: "GET" }).handler(
  async (): Promise<TimerItem[]> => {
    const s = await requireSession();
    type Raw = {
      Id: string;
      Name?: string;
      ChannelName?: string;
      StartDate?: string;
      EndDate?: string;
      Status?: string;
    };
    const [single, series] = await Promise.all([
      jfGet<{ Items?: Raw[] }>("/LiveTv/Timers", s.token).catch(() => ({ Items: [] as Raw[] })),
      jfGet<{ Items?: Raw[] }>("/LiveTv/SeriesTimers", s.token).catch(() => ({ Items: [] as Raw[] })),
    ]);
    return [
      ...(single.Items ?? []).map((t) => ({
        id: t.Id,
        name: t.Name ?? "Scheduled",
        channelName: t.ChannelName ?? null,
        start: t.StartDate ?? null,
        end: t.EndDate ?? null,
        series: false,
        status: t.Status ?? null,
      })),
      ...(series.Items ?? []).map((t) => ({
        id: t.Id,
        name: t.Name ?? "Series",
        channelName: t.ChannelName ?? null,
        start: t.StartDate ?? null,
        end: t.EndDate ?? null,
        series: true,
        status: t.Status ?? null,
      })),
    ];
  },
);

/** Schedule a recording for one airing, or for the whole series. */
export const recordProgramFn = createServerFn({ method: "POST" })
  .inputValidator((data: { programId: string; series?: boolean }) => data)
  .handler(async ({ data }) => {
    const s = await requireSession();
    const defaults = await jfGet<Record<string, unknown>>(
      `/LiveTv/Timers/Defaults?programId=${data.programId}`,
      s.token,
    );
    await jfPost(data.series ? "/LiveTv/SeriesTimers" : "/LiveTv/Timers", defaults, s.token);
    return { ok: true as const };
  });

export const cancelTimerFn = createServerFn({ method: "POST" })
  .inputValidator((data: { timerId: string; series?: boolean }) => data)
  .handler(async ({ data }) => {
    const s = await requireSession();
    await jfDelete(
      data.series ? `/LiveTv/SeriesTimers/${data.timerId}` : `/LiveTv/Timers/${data.timerId}`,
      s.token,
    );
    return { ok: true as const };
  });

/** Heart a channel so it pins to the top of the Live TV grid. */
export const setChannelFavoriteFn = createServerFn({ method: "POST" })
  .inputValidator((data: { channelId: string; favorite: boolean }) => data)
  .handler(async ({ data }) => {
    const s = await requireSession();
    const path = `/Users/${s.userId}/FavoriteItems/${data.channelId}`;
    if (data.favorite) await jfPost(path, null, s.token);
    else await jfDelete(path, s.token);
    const cached = channelCache.get(s.userId);
    if (cached) {
      const hit = cached.items.find((c) => c.id === data.channelId);
      if (hit) hit.favorite = data.favorite;
    }
    return { ok: true as const, favorite: data.favorite };
  });
