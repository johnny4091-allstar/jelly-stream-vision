import type { ErrorComponentProps } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { ChevronLeft, ChevronRight, Play, Radio } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import { useLanguage } from "@/lib/i18n";
import { getGuideFn, getLiveChannelsFn, type GuideProgram } from "@/lib/livetv.functions";

export const Route = createFileRoute("/live/channel-guide")({
  head: () => ({
    meta: [
      { title: "Channel Guide — Aurora" },
      {
        name: "description",
        content: "Every live channel with its full program schedule, posters and instant play.",
      },
      { property: "og:title", content: "Channel Guide — Aurora" },
      {
        property: "og:description",
        content: "Every live channel with its full program schedule, posters and instant play.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ChannelGuidePage,
  errorComponent: ({ error }: ErrorComponentProps) => (
    <p role="alert" className="px-6 py-10 text-sm text-muted-foreground">
      {error.message}
    </p>
  ),
  notFoundComponent: () => <p className="px-6 py-10 text-sm text-muted-foreground">No channels.</p>,
});

const WINDOW_HOURS = 12;
const PAGE_SIZE = 12;

function clock(iso: string | null) {
  if (!iso) return "";
  return new Date(iso).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}

function ProgramPoster({ program }: { program: GuideProgram }) {
  const [failed, setFailed] = useState(false);
  if (failed) {
    return (
      <div className="flex h-16 w-28 shrink-0 items-center justify-center rounded-md bg-secondary">
        <Radio className="h-4 w-4 text-muted-foreground" />
      </div>
    );
  }
  return (
    <img
      src={`/api/proxy/Items/${program.id}/Images/Primary?maxWidth=320&quality=85`}
      alt={program.name}
      loading="lazy"
      onError={() => setFailed(true)}
      className="h-16 w-28 shrink-0 rounded-md bg-secondary object-cover"
    />
  );
}

function ChannelGuidePage() {
  const { t } = useLanguage();
  const [page, setPage] = useState(0);
  const [favoritesOnly, setFavoritesOnly] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const startIso = useMemo(() => new Date().toISOString(), []);

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(id);
  }, []);

  const channelsQuery = useQuery({
    queryKey: ["live-channels", { channelGuide: true, page, favoritesOnly }],
    queryFn: () => getLiveChannelsFn({ data: { page, pageSize: PAGE_SIZE, favoritesOnly } }),
    staleTime: 60_000,
  });

  const channels = channelsQuery.data?.channels ?? [];
  const ids = useMemo(() => channels.map((c) => c.id), [channels]);

  const guideQuery = useQuery({
    queryKey: ["live-guide", ids, startIso, WINDOW_HOURS],
    queryFn: () => getGuideFn({ data: { channelIds: ids, startIso, hours: WINDOW_HOURS } }),
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

  const pages = Math.ceil((channelsQuery.data?.total ?? 0) / PAGE_SIZE);

  return (
    <div className="space-y-6 px-4 pt-6 pb-16 sm:px-8">
      <div className="flex flex-wrap items-center gap-2">
        <h1 className="text-xl font-bold text-foreground">{t("channelGuide")}</h1>
        <Button
          size="sm"
          variant={favoritesOnly ? "default" : "secondary"}
          className="rounded-full"
          onClick={() => {
            setFavoritesOnly((v) => !v);
            setPage(0);
          }}
        >
          ♥ {t("favorites")}
        </Button>
        <Button asChild size="sm" variant="secondary" className="ml-auto rounded-full">
          <Link to="/live/guide">{t("gridView")}</Link>
        </Button>
      </div>

      {channelsQuery.isLoading ? (
        <p className="text-sm text-muted-foreground">…</p>
      ) : (
        <div className="space-y-5">
          {channels.map((channel) => {
            const programs = byChannel.get(channel.id) ?? [];
            return (
              <section
                key={channel.id}
                className="overflow-hidden rounded-2xl border border-border bg-card"
              >
                <header className="flex items-center gap-3 border-b border-border px-4 py-3">
                  <div className="flex h-12 w-20 shrink-0 items-center justify-center overflow-hidden rounded-md bg-secondary">
                    {channel.hasImage ? (
                      <img
                        src={`/api/proxy/Items/${channel.id}/Images/Primary?maxWidth=200&quality=85`}
                        alt={channel.name}
                        loading="lazy"
                        className="h-full w-full object-contain"
                      />
                    ) : (
                      <Radio className="h-5 w-5 text-muted-foreground" />
                    )}
                  </div>
                  <div className="min-w-0">
                    {channel.number ? (
                      <p className="text-xs text-muted-foreground">{channel.number}</p>
                    ) : null}
                    <p className="truncate text-base font-bold text-foreground">{channel.name}</p>
                  </div>
                  <Button asChild className="ml-auto rounded-full focus-visible:ring-4">
                    <Link to="/live/watch/$channelId" params={{ channelId: channel.id }}>
                      <Play className="mr-1 h-4 w-4 fill-current" />
                      {t("play")}
                    </Link>
                  </Button>
                </header>

                {programs.length === 0 ? (
                  <p className="px-4 py-4 text-sm text-muted-foreground">{t("noProgramInfo")}</p>
                ) : (
                  <ul className="divide-y divide-border/60">
                    {programs.map((p) => {
                      const ps = p.start ? new Date(p.start).getTime() : 0;
                      const pe = p.end ? new Date(p.end).getTime() : ps;
                      const live = now >= ps && now < pe;
                      return (
                        <li
                          key={p.id}
                          className={`flex items-center gap-4 px-4 py-3 ${live ? "bg-primary/10" : ""}`}
                        >
                          <span className="w-24 shrink-0 text-sm tabular-nums text-muted-foreground">
                            {clock(p.start)} – {clock(p.end)}
                          </span>
                          <ProgramPoster program={p} />
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-semibold text-foreground">
                              {p.name}
                              {live ? (
                                <span className="ml-2 rounded bg-primary px-1.5 py-0.5 text-[10px] font-bold uppercase text-primary-foreground">
                                  live
                                </span>
                              ) : null}
                            </p>
                            {p.overview ? (
                              <p className="line-clamp-2 text-xs text-muted-foreground">
                                {p.overview}
                              </p>
                            ) : null}
                          </div>
                          <Button
                            asChild
                            size="icon"
                            variant={live ? "default" : "secondary"}
                            className="h-10 w-10 shrink-0 rounded-full focus-visible:ring-4"
                          >
                            <Link
                              to="/live/watch/$channelId"
                              params={{ channelId: channel.id }}
                              aria-label={t("play")}
                            >
                              <Play className="h-5 w-5 fill-current" />
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
        <div className="flex items-center justify-center gap-3">
          <Button
            variant="secondary"
            size="sm"
            disabled={page === 0}
            onClick={() => setPage((p) => Math.max(0, p - 1))}
          >
            <ChevronLeft className="mr-1 h-4 w-4" />
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
            <ChevronRight className="ml-1 h-4 w-4" />
          </Button>
        </div>
      )}
    </div>
  );
}
