import { useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { ChevronLeft, ChevronRight, LayoutGrid, List, Play, Radio } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { useLanguage } from "@/lib/i18n";
import {
  getGuideFn,
  getLiveChannelsFn,
  recordProgramFn,
  type GuideProgram,
} from "@/lib/livetv.functions";

export const Route = createFileRoute("/live/guide")({
  head: () => ({
    meta: [
      { title: "TV Guide — Aurora" },
      { name: "description", content: "A full schedule grid of what's on across your live channels." },
      { property: "og:title", content: "TV Guide — Aurora" },
      {
        property: "og:description",
        content: "A full schedule grid of what's on across your live channels.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: GuidePage,
});

const PX_PER_MIN = 6;
const SLOT_MIN = 30;
const WINDOW_HOURS = 6;

function clock(d: Date | string | null) {
  if (!d) return "";
  const date = typeof d === "string" ? new Date(d) : d;
  return date.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}

function floorToSlot(d: Date) {
  const out = new Date(d);
  out.setSeconds(0, 0);
  out.setMinutes(Math.floor(out.getMinutes() / SLOT_MIN) * SLOT_MIN);
  return out;
}

function GuidePage() {
  const { t } = useLanguage();
  const qc = useQueryClient();
  const record = useServerFn(recordProgramFn);
  const scrollRef = useRef<HTMLDivElement>(null);
  const [page, setPage] = useState(0);
  const [favoritesOnly, setFavoritesOnly] = useState(false);
  const [selected, setSelected] = useState<GuideProgram | null>(null);
  const [view, setView] = useState<"grid" | "list">("grid");
  const [start, setStart] = useState(() => floorToSlot(new Date()));
  const [now, setNow] = useState(() => Date.now());
  const pageSize = 20;

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(id);
  }, []);

  const end = useMemo(() => new Date(start.getTime() + WINDOW_HOURS * 3_600_000), [start]);
  const slots = useMemo(() => {
    const out: Date[] = [];
    for (let i = 0; i < (WINDOW_HOURS * 60) / SLOT_MIN; i++)
      out.push(new Date(start.getTime() + i * SLOT_MIN * 60_000));
    return out;
  }, [start]);
  const gridWidth = WINDOW_HOURS * 60 * PX_PER_MIN;

  const channelsQuery = useQuery({
    queryKey: ["live-channels", { guide: true, page, favoritesOnly, pageSize }],
    queryFn: () => getLiveChannelsFn({ data: { page, pageSize, favoritesOnly } }),
    staleTime: 60_000,
  });

  const channels = channelsQuery.data?.channels ?? [];
  const ids = useMemo(() => channels.map((c) => c.id), [channels]);

  const guideQuery = useQuery({
    queryKey: ["live-guide", ids, start.toISOString()],
    queryFn: () =>
      getGuideFn({ data: { channelIds: ids, startIso: start.toISOString(), hours: WINDOW_HOURS } }),
    enabled: ids.length > 0,
    staleTime: 5 * 60_000,
  });

  const byChannel = useMemo(() => {
    const map = new Map<string, GuideProgram[]>();
    for (const p of guideQuery.data ?? []) {
      const list = map.get(p.channelId) ?? [];
      list.push(p);
      map.set(p.channelId, list);
    }
    for (const list of map.values())
      list.sort((a, b) => new Date(a.start ?? 0).getTime() - new Date(b.start ?? 0).getTime());
    return map;
  }, [guideQuery.data]);

  const pages = Math.ceil((channelsQuery.data?.total ?? 0) / pageSize);
  const nowOffset = (now - start.getTime()) / 60_000;
  const showNowLine = nowOffset >= 0 && nowOffset <= WINDOW_HOURS * 60;

  // Keep "now" in view when the window jumps back to the current time.
  useEffect(() => {
    if (!showNowLine || !scrollRef.current) return;
    scrollRef.current.scrollLeft = Math.max(0, nowOffset * PX_PER_MIN - 120);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [start]);

  const shift = (hours: number) =>
    setStart((s) => floorToSlot(new Date(s.getTime() + hours * 3_600_000)));

  return (
    <div className="space-y-4 px-4 pt-6 sm:px-8">
      <div className="flex flex-wrap items-center gap-2">
        <Button
          variant={favoritesOnly ? "default" : "secondary"}
          size="sm"
          className="rounded-full"
          onClick={() => {
            setFavoritesOnly((v) => !v);
            setPage(0);
          }}
        >
          ♥ {t("favorites")}
        </Button>
        <Button
          variant={view === "grid" ? "default" : "secondary"}
          size="sm"
          className="rounded-full"
          onClick={() => setView("grid")}
        >
          <LayoutGrid className="mr-1 h-4 w-4" /> {t("gridView")}
        </Button>
        <Button
          variant={view === "list" ? "default" : "secondary"}
          size="sm"
          className="rounded-full"
          onClick={() => setView("list")}
        >
          <List className="mr-1 h-4 w-4" /> {t("channelGuide")}
        </Button>
        <div className="ml-auto flex items-center gap-2">
          <Button variant="secondary" size="sm" className="rounded-full" onClick={() => shift(-2)}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button
            variant="secondary"
            size="sm"
            className="rounded-full"
            onClick={() => setStart(floorToSlot(new Date()))}
          >
            {t("nowAndNext")}
          </Button>
          <Button variant="secondary" size="sm" className="rounded-full" onClick={() => shift(2)}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {view === "grid" ? (
      <div className="overflow-hidden rounded-xl border border-border bg-card">
        <div ref={scrollRef} className="overflow-x-auto">
          <div style={{ width: gridWidth + 176 }}>
            {/* Time header */}
            <div className="sticky top-0 z-20 flex border-b border-border bg-card/95 backdrop-blur">
              <div className="sticky left-0 z-30 w-44 shrink-0 border-r border-border bg-card px-3 py-2 text-xs font-semibold text-muted-foreground">
                {start.toLocaleDateString([], { weekday: "short", month: "short", day: "numeric" })}
              </div>
              <div className="relative h-9" style={{ width: gridWidth }}>
                {slots.map((s) => (
                  <div
                    key={s.toISOString()}
                    className="absolute top-0 flex h-9 items-center border-l border-border/60 pl-2 text-xs text-muted-foreground"
                    style={{
                      left: ((s.getTime() - start.getTime()) / 60_000) * PX_PER_MIN,
                      width: SLOT_MIN * PX_PER_MIN,
                    }}
                  >
                    {clock(s)}
                  </div>
                ))}
              </div>
            </div>

            {/* Channel rows */}
            <div className="relative">
              {showNowLine && (
                <div
                  className="pointer-events-none absolute top-0 bottom-0 z-10 w-px bg-primary"
                  style={{ left: 176 + nowOffset * PX_PER_MIN }}
                />
              )}
              {channels.map((channel) => {
                const programs = byChannel.get(channel.id) ?? [];
                return (
                  <div key={channel.id} className="flex border-b border-border/60 last:border-0">
                    <div className="sticky left-0 z-10 flex w-44 shrink-0 items-center gap-2 border-r border-border bg-card px-3 py-2">
                      <div className="min-w-0">
                        {channel.number ? (
                          <p className="text-[11px] text-muted-foreground">{channel.number}</p>
                        ) : null}
                        <p className="truncate text-xs font-semibold text-foreground">
                          {channel.name}
                        </p>
                      </div>
                      <Button
                        asChild
                        size="icon"
                        variant="secondary"
                        className="ml-auto h-7 w-7 rounded-full"
                      >
                        <Link to="/live/watch/$channelId" params={{ channelId: channel.id }}>
                          <Play className="h-3.5 w-3.5 fill-current" />
                        </Link>
                      </Button>
                    </div>
                    <div className="relative h-14" style={{ width: gridWidth }}>
                      {programs.length === 0 ? (
                        <div className="flex h-full items-center px-3 text-xs text-muted-foreground">
                          {t("noProgramInfo")}
                        </div>
                      ) : (
                        programs.map((p) => {
                          const ps = p.start ? new Date(p.start).getTime() : start.getTime();
                          const pe = p.end ? new Date(p.end).getTime() : ps + 30 * 60_000;
                          const left = Math.max(0, (ps - start.getTime()) / 60_000) * PX_PER_MIN;
                          const right =
                            Math.min(end.getTime(), pe) - start.getTime() >= 0
                              ? (Math.min(end.getTime(), pe) - start.getTime()) / 60_000
                              : 0;
                          const width = Math.max(right * PX_PER_MIN - left, 24);
                          const live = now >= ps && now < pe;
                          return (
                            <button
                              key={p.id}
                              type="button"
                              onClick={() => setSelected(p)}
                              style={{ left, width: width - 4 }}
                              className={`absolute top-1.5 bottom-1.5 overflow-hidden rounded-md px-2 text-left transition-colors ${
                                live
                                  ? "bg-primary/20 ring-1 ring-primary hover:bg-primary/30"
                                  : "bg-secondary hover:bg-accent"
                              }`}
                            >
                              <p className="truncate text-xs font-medium text-foreground">
                                {p.name}
                              </p>
                              <p className="truncate text-[11px] text-muted-foreground">
                                {clock(p.start)} – {clock(p.end)}
                              </p>
                            </button>
                          );
                        })
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
      ) : (
        <div className="space-y-4">
          {channels.map((channel) => {
            const programs = byChannel.get(channel.id) ?? [];
            return (
              <section
                key={channel.id}
                className="overflow-hidden rounded-xl border border-border bg-card"
              >
                <header className="flex items-center gap-3 border-b border-border px-3 py-2">
                  <div className="flex h-10 w-16 shrink-0 items-center justify-center overflow-hidden rounded-md bg-secondary">
                    {channel.hasImage ? (
                      <img
                        src={`/api/proxy/Items/${channel.id}/Images/Primary?maxWidth=160&quality=85`}
                        alt={channel.name}
                        loading="lazy"
                        className="h-full w-full object-contain"
                      />
                    ) : (
                      <Radio className="h-4 w-4 text-muted-foreground" />
                    )}
                  </div>
                  <div className="min-w-0">
                    {channel.number ? (
                      <p className="text-[11px] text-muted-foreground">{channel.number}</p>
                    ) : null}
                    <p className="truncate text-sm font-semibold text-foreground">{channel.name}</p>
                  </div>
                  <Button asChild size="sm" className="ml-auto rounded-full">
                    <Link to="/live/watch/$channelId" params={{ channelId: channel.id }}>
                      <Play className="mr-1 h-4 w-4 fill-current" />
                      {t("play")}
                    </Link>
                  </Button>
                </header>
                {programs.length === 0 ? (
                  <p className="px-3 py-3 text-xs text-muted-foreground">{t("noProgramInfo")}</p>
                ) : (
                  <ul className="divide-y divide-border/60">
                    {programs.map((p) => {
                      const ps = p.start ? new Date(p.start).getTime() : 0;
                      const pe = p.end ? new Date(p.end).getTime() : ps;
                      const live = now >= ps && now < pe;
                      return (
                        <li key={p.id} className="flex items-center gap-3 px-3 py-2">
                          <span className="w-20 shrink-0 text-xs tabular-nums text-muted-foreground">
                            {clock(p.start)}
                          </span>
                          <button
                            type="button"
                            onClick={() => setSelected(p)}
                            className="min-w-0 flex-1 text-left"
                          >
                            <p className="truncate text-sm font-medium text-foreground">
                              {p.name}
                              {live ? (
                                <span className="ml-2 rounded bg-primary px-1.5 py-0.5 text-[10px] font-bold uppercase text-primary-foreground">
                                  live
                                </span>
                              ) : null}
                            </p>
                            {p.overview ? (
                              <p className="truncate text-xs text-muted-foreground">{p.overview}</p>
                            ) : null}
                          </button>
                          <Button
                            asChild
                            size="icon"
                            variant="secondary"
                            className="h-8 w-8 shrink-0 rounded-full"
                          >
                            <Link
                              to="/live/watch/$channelId"
                              params={{ channelId: channel.id }}
                              aria-label={t("play")}
                            >
                              <Play className="h-4 w-4 fill-current" />
                            </Link>
                          </Button>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </section>
            );
          })}
        </div>
      )}

      {pages > 1 && (
        <div className="flex items-center justify-center gap-3 pt-1">
          <Button
            variant="secondary"
            size="sm"
            disabled={page === 0}
            onClick={() => setPage((p) => Math.max(0, p - 1))}
          >
            {t("previous")}
          </Button>
          <span className="text-xs text-muted-foreground">
            {page + 1} / {pages}
          </span>
          <Button
            variant="secondary"
            size="sm"
            disabled={page + 1 >= pages}
            onClick={() => setPage((p) => p + 1)}
          >
            {t("next")}
          </Button>
        </div>
      )}

      {selected && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 p-4 sm:items-center"
          onClick={() => setSelected(null)}
        >
          <div
            className="w-full max-w-lg space-y-3 rounded-2xl border border-border bg-card p-5"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="text-lg font-bold text-foreground">{selected.name}</h2>
            <p className="text-xs text-muted-foreground">
              {clock(selected.start)} – {clock(selected.end)}
            </p>
            {selected.overview ? (
              <p className="text-sm text-muted-foreground">{selected.overview}</p>
            ) : null}
            <div className="flex flex-wrap gap-2 pt-2">
              <Button asChild size="sm">
                <Link to="/live/watch/$channelId" params={{ channelId: selected.channelId }}>
                  {t("watchNow")}
                </Link>
              </Button>
              <Button
                size="sm"
                variant="secondary"
                onClick={() => {
                  void record({ data: { programId: selected.id } }).then(() => {
                    void qc.invalidateQueries({ queryKey: ["live-timers"] });
                    setSelected(null);
                  });
                }}
              >
                {t("record")}
              </Button>
              {selected.isSeries && (
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => {
                    void record({ data: { programId: selected.id, series: true } }).then(() => {
                      void qc.invalidateQueries({ queryKey: ["live-timers"] });
                      setSelected(null);
                    });
                  }}
                >
                  {t("recordSeries")}
                </Button>
              )}
              <Button size="sm" variant="ghost" onClick={() => setSelected(null)}>
                {t("close")}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
