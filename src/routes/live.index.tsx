import { useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { Heart, Play, Search, Tv } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { useLanguage } from "@/lib/i18n";
import { getLiveChannelsFn, setChannelFavoriteFn, type LiveChannel } from "@/lib/livetv.functions";

export const Route = createFileRoute("/live/")({
  head: () => ({
    meta: [
      { title: "Live TV — Aurora" },
      { name: "description", content: "Browse live channels by category and watch what's on now." },
      { property: "og:title", content: "Live TV — Aurora" },
      {
        property: "og:description",
        content: "Browse live channels by category and watch what's on now.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: LiveChannelsPage,
});

const CATEGORY_LABELS: Record<string, string> = {
  sports: "Sports",
  news: "News",
  kids: "Kids",
  movies: "Movies",
  music: "Music",
  documentary: "Documentary",
  entertainment: "Entertainment",
  other: "Other",
};

function progress(now: LiveChannel["now"]) {
  if (!now?.start || !now.end) return 0;
  const start = new Date(now.start).getTime();
  const end = new Date(now.end).getTime();
  const pct = ((Date.now() - start) / (end - start)) * 100;
  return Math.max(0, Math.min(100, pct));
}

function LiveChannelsPage() {
  const { t } = useLanguage();
  const qc = useQueryClient();
  const setFavorite = useServerFn(setChannelFavoriteFn);
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("all");
  const [favoritesOnly, setFavoritesOnly] = useState(false);
  const [page, setPage] = useState(0);
  const pageSize = 60;

  const params = { search, category, favoritesOnly, page, pageSize };
  const { data, isFetching } = useQuery({
    queryKey: ["live-channels", params],
    queryFn: () => getLiveChannelsFn({ data: params }),
    staleTime: 30_000,
    refetchInterval: 120_000,
  });

  const chip = (activeChip: boolean) =>
    `rounded-full px-3 py-1.5 text-xs font-semibold transition-colors ${
      activeChip
        ? "bg-primary text-primary-foreground"
        : "bg-secondary text-muted-foreground hover:text-foreground"
    }`;

  const pages = Math.ceil((data?.total ?? 0) / pageSize);

  return (
    <div className="space-y-5 px-4 pt-6 sm:px-8">
      <div className="flex items-center gap-2 rounded-full border border-border bg-card px-4 py-2">
        <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
        <input
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setPage(0);
          }}
          placeholder={t("searchChannels")}
          aria-label={t("searchChannels")}
          className="w-full bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground"
        />
      </div>

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => {
            setFavoritesOnly(false);
            setCategory("all");
            setPage(0);
          }}
          className={chip(!favoritesOnly && category === "all")}
        >
          {t("allChannels")}
        </button>
        <button
          type="button"
          onClick={() => {
            setFavoritesOnly((v) => !v);
            setPage(0);
          }}
          className={chip(favoritesOnly)}
        >
          ♥ {t("favorites")} {data ? `(${data.favoriteCount})` : ""}
        </button>
        {(data?.categories ?? []).map((c) => (
          <button
            key={c.id}
            type="button"
            onClick={() => {
              setCategory(category === c.id ? "all" : c.id);
              setPage(0);
            }}
            className={chip(category === c.id)}
          >
            {CATEGORY_LABELS[c.id] ?? c.label} ({c.count})
          </button>
        ))}
      </div>

      {!data && isFetching ? (
        <p className="text-sm text-muted-foreground">{t("loadingStream")}</p>
      ) : (data?.channels.length ?? 0) === 0 ? (
        <p className="text-sm text-muted-foreground">{t("noChannels")}</p>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
          {data?.channels.map((channel) => (
            <div
              key={channel.id}
              className="group flex items-center gap-3 rounded-xl border border-border bg-card p-3 transition-colors hover:border-primary/60"
            >
              <div className="flex h-14 w-20 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-secondary">
                {channel.hasImage ? (
                  <img
                    src={`/api/proxy/Items/${channel.id}/Images/Primary?maxWidth=200&quality=85`}
                    alt={channel.name}
                    loading="lazy"
                    className="h-full w-full object-contain"
                  />
                ) : (
                  <Tv className="h-6 w-6 text-muted-foreground" />
                )}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-bold text-foreground">
                  {channel.number ? <span className="text-muted-foreground">{channel.number} · </span> : null}
                  {channel.name}
                </p>
                <p className="truncate text-xs text-muted-foreground">
                  {channel.now?.name ?? t("noProgramInfo")}
                </p>
                {channel.now ? (
                  <div className="mt-1.5 h-1 w-full overflow-hidden rounded-full bg-secondary">
                    <div className="h-full bg-primary" style={{ width: `${progress(channel.now)}%` }} />
                  </div>
                ) : null}
              </div>
              <button
                type="button"
                aria-label={t("favorites")}
                onClick={() => {
                  void setFavorite({
                    data: { channelId: channel.id, favorite: !channel.favorite },
                  }).then(() => qc.invalidateQueries({ queryKey: ["live-channels"] }));
                }}
                className="rounded-full p-2 text-muted-foreground transition-colors hover:text-primary"
              >
                <Heart className={`h-4 w-4 ${channel.favorite ? "fill-primary text-primary" : ""}`} />
              </button>
              <Button asChild size="sm" className="shrink-0 rounded-full">
                <Link to="/live/watch/$channelId" params={{ channelId: channel.id }}>
                  <Play className="h-4 w-4 fill-current" />
                </Link>
              </Button>
            </div>
          ))}
        </div>
      )}

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
    </div>
  );
}
