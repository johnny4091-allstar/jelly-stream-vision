import { useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { CircleDot, Play } from "lucide-react";
import { useMemo, useState } from "react";

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
      { name: "description", content: "See what's on now and next across your live channels." },
      { property: "og:title", content: "TV Guide — Aurora" },
      {
        property: "og:description",
        content: "See what's on now and next across your live channels.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: GuidePage,
});

function clock(iso: string | null) {
  if (!iso) return "";
  return new Date(iso).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}

function GuidePage() {
  const { t } = useLanguage();
  const qc = useQueryClient();
  const record = useServerFn(recordProgramFn);
  const [page, setPage] = useState(0);
  const [favoritesOnly, setFavoritesOnly] = useState(false);
  const [selected, setSelected] = useState<GuideProgram | null>(null);
  const pageSize = 20;

  const channelsQuery = useQuery({
    queryKey: ["live-channels", { guide: true, page, favoritesOnly, pageSize }],
    queryFn: () => getLiveChannelsFn({ data: { page, pageSize, favoritesOnly } }),
    staleTime: 60_000,
  });

  const channels = channelsQuery.data?.channels ?? [];
  const ids = useMemo(() => channels.map((c) => c.id), [channels]);

  const guideQuery = useQuery({
    queryKey: ["live-guide", ids],
    queryFn: () => getGuideFn({ data: { channelIds: ids, hours: 4 } }),
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
    return map;
  }, [guideQuery.data]);

  const pages = Math.ceil((channelsQuery.data?.total ?? 0) / pageSize);

  return (
    <div className="space-y-5 px-4 pt-6 sm:px-8">
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
        <span className="text-xs text-muted-foreground">{t("nowAndNext")}</span>
      </div>

      <div className="space-y-3">
        {channels.map((channel) => {
          const programs = (byChannel.get(channel.id) ?? []).slice(0, 4);
          return (
            <div key={channel.id} className="rounded-xl border border-border bg-card p-3">
              <div className="mb-2 flex items-center gap-3">
                <p className="truncate text-sm font-bold text-foreground">
                  {channel.number ? (
                    <span className="text-muted-foreground">{channel.number} · </span>
                  ) : null}
                  {channel.name}
                </p>
                <Button asChild size="sm" variant="secondary" className="ml-auto rounded-full">
                  <Link to="/live/watch/$channelId" params={{ channelId: channel.id }}>
                    <Play className="h-4 w-4 fill-current" />
                  </Link>
                </Button>
              </div>
              <div className="flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                {programs.length === 0 ? (
                  <p className="text-xs text-muted-foreground">{t("noProgramInfo")}</p>
                ) : (
                  programs.map((p, i) => (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => setSelected(p)}
                      className="min-w-52 shrink-0 rounded-lg bg-secondary p-2 text-left transition-colors hover:bg-accent"
                    >
                      <p className="flex items-center gap-1 text-[11px] text-muted-foreground">
                        {i === 0 ? <CircleDot className="h-3 w-3 text-primary" /> : null}
                        {clock(p.start)} – {clock(p.end)}
                      </p>
                      <p className="truncate text-sm text-foreground">{p.name}</p>
                    </button>
                  ))
                )}
              </div>
            </div>
          );
        })}
      </div>

      {pages > 1 && (
        <div className="flex items-center justify-center gap-3 pt-2">
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
