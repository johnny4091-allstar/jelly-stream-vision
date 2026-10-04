import { useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, redirect, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { ChevronDown, ChevronLeft, ChevronRight, Heart, Radio, Search, Tv } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { useLiveStream } from "@/hooks/use-live-stream";
import { useLanguage } from "@/lib/i18n";
import {
  getGuideFn,
  getLiveChannelsFn,
  setChannelFavoriteFn,
  type GuideProgram,
  type LiveChannel,
} from "@/lib/livetv.functions";

export const Route = createFileRoute("/live/guide")({
  beforeLoad: async () => {
    const { getSessionFn } = await import("@/lib/auth.functions");
    if (!(await getSessionFn())) throw redirect({ to: "/login" });
  },
  head: () => ({
    meta: [
      { title: "TV Guide — Aurora" },
      { name: "description", content: "Browse live channels and six hours of programming in Aurora's TV guide." },
      { property: "og:title", content: "TV Guide — Aurora" },
      { property: "og:description", content: "Browse live channels and six hours of programming in Aurora's TV guide." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: GuidePage,
});

const SLOT_MINUTES = 30;
const WINDOW_HOURS = 6;
const PX_PER_MINUTE = 4;
const PAGE_SIZE = 24;
const CHANNEL_WIDTH = 240;

function floorToSlot(value: Date) {
  const result = new Date(value);
  result.setSeconds(0, 0);
  result.setMinutes(Math.floor(result.getMinutes() / SLOT_MINUTES) * SLOT_MINUTES);
  return result;
}

function timeLabel(value: Date | string | null) {
  if (!value) return "";
  return new Date(value).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}

function programProgress(program: GuideProgram | null, now: number) {
  if (!program?.start || !program.end) return 0;
  const start = new Date(program.start).getTime();
  const end = new Date(program.end).getTime();
  return Math.max(0, Math.min(100, ((now - start) / Math.max(1, end - start)) * 100));
}

function GuidePage() {
  const { t } = useLanguage();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const setFavorite = useServerFn(setChannelFavoriteFn);
  const timelineRef = useRef<HTMLDivElement>(null);
  const categoryRefs = useRef(new Map<string, HTMLButtonElement>());
  const focusTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [category, setCategory] = useState("all");
  const [favoritesOnly, setFavoritesOnly] = useState(false);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(0);
  const [start, setStart] = useState(() => floorToSlot(new Date()));
  const [now, setNow] = useState(Date.now());
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [previewId, setPreviewId] = useState<string | null>(null);
  const [previewCollapsed, setPreviewCollapsed] = useState(false);

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(timer);
  }, []);
  useEffect(() => () => {
    if (focusTimerRef.current) clearTimeout(focusTimerRef.current);
  }, []);

  const params = { category, favoritesOnly, search, page, pageSize: PAGE_SIZE };
  const channelsQuery = useQuery({
    queryKey: ["live-channels", { guide: "iptv", ...params }],
    queryFn: () => getLiveChannelsFn({ data: params }),
    staleTime: 60_000,
    refetchInterval: 3 * 60_000,
  });
  const channels = channelsQuery.data?.channels ?? [];
  const ids = useMemo(() => channels.map((channel) => channel.id), [channels]);
  const guideQuery = useQuery({
    queryKey: ["live-guide", ids, start.toISOString()],
    queryFn: () => getGuideFn({ data: { channelIds: ids, startIso: start.toISOString(), hours: WINDOW_HOURS } }),
    enabled: ids.length > 0,
    staleTime: 3 * 60_000,
    refetchInterval: 3 * 60_000,
  });

  const programsByChannel = useMemo(() => {
    const result = new Map<string, GuideProgram[]>();
    for (const program of guideQuery.data ?? []) {
      const list = result.get(program.channelId) ?? [];
      list.push(program);
      result.set(program.channelId, list);
    }
    for (const list of result.values()) list.sort((a, b) => new Date(a.start ?? 0).getTime() - new Date(b.start ?? 0).getTime());
    return result;
  }, [guideQuery.data]);

  useEffect(() => {
    if (!channels.length) {
      setSelectedId(null);
      setPreviewId(null);
      return;
    }
    if (!channels.some((channel) => channel.id === selectedId)) {
      setSelectedId(channels[0]?.id ?? null);
      setPreviewId(channels[0]?.id ?? null);
    }
  }, [channels, selectedId]);

  const selectedChannel = channels.find((channel) => channel.id === selectedId) ?? null;
  const previewChannel = channels.find((channel) => channel.id === previewId) ?? selectedChannel;
  const previewPrograms = previewChannel ? programsByChannel.get(previewChannel.id) ?? [] : [];
  const currentProgram = previewPrograms.find((program) => {
    const from = new Date(program.start ?? 0).getTime();
    const to = new Date(program.end ?? 0).getTime();
    return now >= from && now < to;
  }) ?? null;
  const nextProgram = previewPrograms.find((program) => new Date(program.start ?? 0).getTime() >= (currentProgram?.end ? new Date(currentProgram.end).getTime() : now)) ?? null;
  const preview = useLiveStream({
    itemId: previewChannel?.id ?? null,
    enabled: Boolean(previewChannel && !previewCollapsed),
    muted: true,
    streamFailedMessage: t("streamFailed"),
    streamInterruptedMessage: t("streamInterrupted"),
  });

  const slots = useMemo(() => Array.from({ length: WINDOW_HOURS * 2 }, (_, index) => new Date(start.getTime() + index * SLOT_MINUTES * 60_000)), [start]);
  const timelineWidth = WINDOW_HOURS * 60 * PX_PER_MINUTE;
  const end = start.getTime() + WINDOW_HOURS * 3_600_000;
  const nowLeft = ((now - start.getTime()) / 60_000) * PX_PER_MINUTE;
  const pages = Math.ceil((channelsQuery.data?.total ?? 0) / PAGE_SIZE);

  const chooseCategory = (id: string, favorites = false) => {
    setCategory(id);
    setFavoritesOnly(favorites);
    setPage(0);
  };
  const focusChannel = (channel: LiveChannel) => {
    setSelectedId(channel.id);
    if (focusTimerRef.current) clearTimeout(focusTimerRef.current);
    focusTimerRef.current = setTimeout(() => setPreviewId(channel.id), 1000);
  };
  const activateChannel = (channel: LiveChannel) => {
    if (selectedId === channel.id && previewId === channel.id) {
      void navigate({ to: "/live/watch/$channelId", params: { channelId: channel.id } });
      return;
    }
    setSelectedId(channel.id);
    setPreviewId(channel.id);
  };

  useEffect(() => {
    function onBack(event: KeyboardEvent) {
      if (!["Escape", "Backspace", "GoBack"].includes(event.key)) return;
      const active = document.activeElement as HTMLElement | null;
      if (active?.closest('[data-guide-area="rows"]')) {
        event.preventDefault();
        event.stopImmediatePropagation();
        categoryRefs.current.get(favoritesOnly ? "favorites" : category)?.focus();
      }
    }
    window.addEventListener("keydown", onBack, true);
    return () => window.removeEventListener("keydown", onBack, true);
  }, [category, favoritesOnly]);

  return (
    <main className="px-3 pb-10 pt-5 sm:px-6 xl:px-8" data-tv-scope>
      <div className="grid min-w-0 gap-4 xl:grid-cols-[14rem_minmax(0,1fr)]">
        <aside className="min-w-0 xl:row-span-2">
          <div className="mb-3 flex items-center gap-2 rounded-md border border-border bg-card px-3 py-2">
            <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
            <input
              value={search}
              onChange={(event) => { setSearch(event.target.value); setPage(0); }}
              placeholder={t("searchChannels")}
              aria-label={t("searchChannels")}
              className="min-w-0 flex-1 bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground"
            />
          </div>
          <p className="mb-2 hidden px-2 text-xs font-bold uppercase text-muted-foreground xl:block">{t("channelGroups")}</p>
          <div className="flex gap-2 overflow-x-auto pb-2 xl:max-h-[calc(100vh-15rem)] xl:flex-col xl:overflow-y-auto xl:pr-2">
            {[
              { id: "all", label: t("allChannels"), count: channelsQuery.data?.total ?? 0, favorite: false },
              { id: "favorites", label: t("favorites"), count: channelsQuery.data?.favoriteCount ?? 0, favorite: true },
              ...(channelsQuery.data?.categories ?? []).map((item) => ({ ...item, favorite: false })),
            ].map((item) => {
              const active = item.favorite ? favoritesOnly : !favoritesOnly && category === item.id;
              return (
                <Button
                  key={item.id}
                  ref={(node) => { if (node) categoryRefs.current.set(item.id, node); else categoryRefs.current.delete(item.id); }}
                  type="button"
                  variant={active ? "default" : "ghost"}
                  className="h-10 shrink-0 justify-between px-3 xl:w-full"
                  onClick={() => chooseCategory(item.favorite ? "all" : item.id, item.favorite)}
                >
                  <span className="max-w-40 truncate">{item.label}</span>
                  <span className="text-xs tabular-nums opacity-70">{item.count}</span>
                </Button>
              );
            })}
          </div>
        </aside>

        <section className="min-w-0">
          <div className="mb-2 flex items-center justify-between xl:hidden">
            <p className="text-xs font-bold uppercase text-muted-foreground">{t("liveTv")}</p>
            <Button type="button" size="sm" variant="ghost" onClick={() => setPreviewCollapsed((value) => !value)}>
              <ChevronDown className={`transition-transform ${previewCollapsed ? "rotate-180" : ""}`} />
              {previewCollapsed ? t("expandPreview") : t("collapsePreview")}
            </Button>
          </div>
          {!previewCollapsed && (
            <div className="grid gap-4 border-b border-border pb-4 md:grid-cols-[minmax(18rem,1.15fr)_minmax(15rem,0.85fr)]">
              <div className="relative aspect-video overflow-hidden rounded-md bg-secondary">
                <video ref={preview.videoRef} muted playsInline autoPlay className="h-full w-full object-contain" />
                {!previewChannel && <div className="absolute inset-0 grid place-items-center text-sm text-muted-foreground">{t("noChannels")}</div>}
                {preview.loading && previewChannel && <div className="absolute inset-0 grid place-items-center bg-background/80 text-sm font-semibold text-foreground">{t("loadingStream")} {preview.loadingPercent}%</div>}
                {preview.error && <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-background/90 px-4 text-center"><p className="text-sm text-muted-foreground">{t("previewUnavailable")}</p><Button size="sm" variant="secondary" onClick={preview.retry}>{t("retryPlayback")}</Button></div>}
                {previewChannel && <span className="absolute left-3 top-3 rounded bg-primary px-2 py-1 text-[10px] font-black uppercase text-primary-foreground">{t("liveBadge")}</span>}
              </div>
              <div className="min-w-0 self-center">
                <div className="flex items-start gap-3">
                  <div className="flex h-12 w-20 shrink-0 items-center justify-center overflow-hidden rounded-md bg-secondary">
                    {previewChannel?.hasImage ? <img src={`/api/proxy/Items/${previewChannel.id}/Images/Primary?maxWidth=180&quality=85`} alt="" className="h-full w-full object-contain" /> : <Tv className="h-5 w-5 text-muted-foreground" />}
                  </div>
                  <div className="min-w-0"><h2 className="truncate text-xl font-bold text-foreground">{previewChannel?.name ?? t("liveTv")}</h2><p className="text-xs text-muted-foreground">{previewChannel?.number ?? ""}</p></div>
                </div>
                <p className="mt-4 text-[11px] font-bold uppercase text-primary">{t("nowPlaying")}</p>
                <p className="mt-1 truncate text-base font-semibold text-foreground">{currentProgram?.name ?? t("noProgramInfo")}</p>
                <p className="mt-1 text-xs text-muted-foreground">{currentProgram ? `${timeLabel(currentProgram.start)} – ${timeLabel(currentProgram.end)}` : t("noProgramInfo")}</p>
                {currentProgram?.overview && <p className="mt-2 line-clamp-2 text-sm text-muted-foreground">{currentProgram.overview}</p>}
                <div className="mt-3 h-1 overflow-hidden rounded-full bg-secondary"><div className="h-full bg-primary transition-[width]" style={{ width: `${programProgress(currentProgram, now)}%` }} /></div>
                <p className="mt-3 truncate text-xs text-muted-foreground"><span className="font-bold text-foreground">{t("upNext")}:</span> {nextProgram?.name ?? t("noProgramInfo")}</p>
              </div>
            </div>
          )}
        </section>

        <section className="min-w-0" data-guide-area="rows">
          <div className="mb-2 flex flex-wrap items-center gap-2">
            <Button size="icon" variant="secondary" aria-label={t("previous")} onClick={() => setStart((value) => floorToSlot(new Date(value.getTime() - 2 * 3_600_000)))}><ChevronLeft /></Button>
            <Button size="sm" variant="secondary" onClick={() => setStart(floorToSlot(new Date()))}>{t("nowPlaying")}</Button>
            <Button size="icon" variant="secondary" aria-label={t("next")} onClick={() => setStart((value) => floorToSlot(new Date(value.getTime() + 2 * 3_600_000)))}><ChevronRight /></Button>
            <span className="ml-auto text-xs text-muted-foreground">{channelsQuery.isFetching || guideQuery.isFetching ? t("loadingStream") : `${channelsQuery.data?.total ?? 0} ${t("channels").toLocaleLowerCase()}`}</span>
          </div>
          <div ref={timelineRef} className="max-w-full overflow-x-auto rounded-md border border-border bg-card">
            <div style={{ width: CHANNEL_WIDTH + timelineWidth }}>
              <div className="sticky top-0 z-30 flex h-11 border-b border-border bg-card/95 backdrop-blur">
                <div className="sticky left-0 z-40 flex shrink-0 items-center border-r border-border bg-card px-3 text-xs font-semibold text-foreground" style={{ width: CHANNEL_WIDTH }}>
                  {new Date(now).toLocaleDateString([], { weekday: "short", month: "short", day: "numeric" })} · {timeLabel(new Date(now))}
                </div>
                <div className="relative" style={{ width: timelineWidth }}>
                  {slots.map((slot) => <div key={slot.toISOString()} className="absolute inset-y-0 flex items-center border-l border-border/70 pl-2 text-xs text-muted-foreground" style={{ left: ((slot.getTime() - start.getTime()) / 60_000) * PX_PER_MINUTE, width: SLOT_MINUTES * PX_PER_MINUTE }}>{timeLabel(slot)}</div>)}
                </div>
              </div>
              <div className="relative">
                {nowLeft >= 0 && nowLeft <= timelineWidth && <div className="pointer-events-none absolute bottom-0 top-0 z-20 w-px bg-primary" style={{ left: CHANNEL_WIDTH + nowLeft }} />}
                {channels.map((channel) => {
                  const programs = programsByChannel.get(channel.id) ?? [];
                  const active = channel.id === selectedId;
                  return (
                    <div key={channel.id} className={`flex h-[4.5rem] border-b border-border/60 last:border-0 ${active ? "bg-primary/5" : ""}`}>
                      <div className="sticky left-0 z-10 flex shrink-0 items-center gap-2 border-r border-border bg-card px-2" style={{ width: CHANNEL_WIDTH }}>
                        <Button
                          type="button"
                          variant="ghost"
                          className={`h-14 min-w-0 flex-1 justify-start gap-2 px-1 ${active ? "text-primary" : ""}`}
                          onFocus={() => focusChannel(channel)}
                          onMouseEnter={() => focusChannel(channel)}
                          onClick={() => activateChannel(channel)}
                          onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); activateChannel(channel); } }}
                        >
                          <span className="w-8 shrink-0 text-right text-xs tabular-nums text-muted-foreground">{channel.number}</span>
                          <span className="flex h-10 w-14 shrink-0 items-center justify-center overflow-hidden rounded bg-secondary">
                            {channel.hasImage ? <img src={`/api/proxy/Items/${channel.id}/Images/Primary?maxWidth=128&quality=80`} alt="" loading="lazy" className="h-full w-full object-contain" /> : <Radio className="h-4 w-4 text-muted-foreground" />}
                          </span>
                          <span className="truncate text-left text-xs font-semibold">{channel.name}</span>
                        </Button>
                        <Button
                          type="button"
                          size="icon"
                          variant="ghost"
                          className="h-9 w-9 shrink-0"
                          aria-label={t("favorites")}
                          onClick={() => void setFavorite({ data: { channelId: channel.id, favorite: !channel.favorite } }).then(() => queryClient.invalidateQueries({ queryKey: ["live-channels"] }))}
                        >
                          <Heart className={channel.favorite ? "fill-primary text-primary" : "text-muted-foreground"} />
                        </Button>
                      </div>
                      <div className="relative" style={{ width: timelineWidth }}>
                        {programs.length ? programs.map((program) => {
                          const programStart = new Date(program.start ?? start).getTime();
                          const programEnd = new Date(program.end ?? programStart + SLOT_MINUTES * 60_000).getTime();
                          const clippedStart = Math.max(start.getTime(), programStart);
                          const clippedEnd = Math.min(end, programEnd);
                          if (clippedEnd <= start.getTime() || clippedStart >= end) return null;
                          const left = ((clippedStart - start.getTime()) / 60_000) * PX_PER_MINUTE;
                          const width = Math.max(40, ((clippedEnd - clippedStart) / 60_000) * PX_PER_MINUTE - 4);
                          const live = now >= programStart && now < programEnd;
                          return <Button key={program.id} type="button" variant="ghost" className={`absolute bottom-1.5 top-1.5 h-auto min-w-0 justify-start overflow-hidden px-2 text-left ${live ? "border border-primary bg-primary/15 text-foreground" : "bg-secondary text-secondary-foreground hover:bg-accent"}`} style={{ left, width }} onFocus={() => focusChannel(channel)} onClick={() => { setSelectedId(channel.id); setPreviewId(channel.id); }}><span className="min-w-0"><span className="block truncate text-xs font-semibold">{program.name}</span><span className="block truncate text-[10px] text-muted-foreground">{timeLabel(program.start)} – {timeLabel(program.end)}</span></span></Button>;
                        }) : <Button type="button" variant="ghost" className="absolute inset-y-1.5 left-1 h-auto justify-start bg-secondary px-3 text-xs text-muted-foreground" style={{ width: timelineWidth - 8 }} onFocus={() => focusChannel(channel)} onClick={() => { setSelectedId(channel.id); setPreviewId(channel.id); }}>{t("noProgramInfo")}</Button>}
                      </div>
                    </div>
                  );
                })}
                {!channelsQuery.isFetching && channels.length === 0 && <div className="grid h-32 place-items-center text-sm text-muted-foreground">{t("noChannels")}</div>}
              </div>
            </div>
          </div>
          {pages > 1 && <div className="mt-3 flex items-center justify-center gap-3"><Button variant="secondary" size="sm" disabled={page === 0} onClick={() => setPage((value) => Math.max(0, value - 1))}>{t("previous")}</Button><span className="text-xs text-muted-foreground">{page + 1} / {pages}</span><Button variant="secondary" size="sm" disabled={page + 1 >= pages} onClick={() => setPage((value) => value + 1)}>{t("next")}</Button></div>}
        </section>
      </div>
    </main>
  );
}
