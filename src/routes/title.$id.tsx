import { RouteError } from "@/components/RouteError";
import { queryOptions, useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import { Play, RotateCcw } from "lucide-react";
import { useState } from "react";

import { SyncActions } from "@/components/SyncActions";
import { TopNav } from "@/components/TopNav";
import { getSessionFn } from "@/lib/auth.functions";
import { getEpisodesFn, getItemFn, getSeasonsFn } from "@/lib/jellyfin.functions";
import {
  backdropUrl,
  episodeLabel,
  formatRuntime,
  itemImageUrl,
  type JfItem,
} from "@/lib/jellyfin.types";
import { useLanguage } from "@/lib/i18n";

const itemQuery = (id: string) =>
  queryOptions({ queryKey: ["item", id], queryFn: () => getItemFn({ data: { id } }), staleTime: 0 });
const seasonsQuery = (seriesId: string) =>
  queryOptions({
    queryKey: ["seasons", seriesId],
    queryFn: () => getSeasonsFn({ data: { seriesId } }),
  });

export const Route = createFileRoute("/title/$id")({
  beforeLoad: async () => {
    const session = await getSessionFn();
    if (!session) throw redirect({ to: "/login" });
  },
  loader: ({ context, params }) =>
    context.queryClient.ensureQueryData(itemQuery(params.id)),
  head: ({ loaderData }) => ({
    meta: [
      { title: `${loaderData?.Name ?? "Title"} — Aurora` },
      { name: "description", content: loaderData?.Overview ?? "Watch on Aurora." },
      { property: "og:title", content: `${loaderData?.Name ?? "Title"} — Aurora` },
      { property: "og:description", content: loaderData?.Overview ?? "Watch on Aurora." },
      { property: "og:type", content: "video.other" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  errorComponent: RouteError,
  component: TitlePage,
});

function TitlePage() {
  const { t } = useLanguage();
  const { id } = Route.useParams();
  const { data: item } = useSuspenseQuery(itemQuery(id));
  const isSeries = item.Type === "Series";
  const { data: seasons } = useSuspenseQuery(
    isSeries
      ? seasonsQuery(item.Id)
      : queryOptions({ queryKey: ["seasons", "none"], queryFn: async () => [] as JfItem[] }),
  );
  const [seasonId, setSeasonId] = useState<string | null>(null);
  const activeSeason = seasonId ?? seasons[0]?.Id ?? null;

  const pct = item.UserData?.PlayedPercentage ?? 0;
  const cast = (item.People ?? []).filter((p) => p.Type === "Actor").slice(0, 8);

  return (
    <div className="min-h-screen bg-background">
      <TopNav userName="" />
      <div className="relative h-[55vh] min-h-[360px] w-full overflow-hidden">
        <img src={backdropUrl(item)} alt={item.Name} className="h-full w-full object-cover" />
        <div className="absolute inset-0 bg-gradient-to-t from-background via-background/40 to-transparent" />
      </div>

      <div className="relative z-10 -mt-32 space-y-6 px-4 pb-20 sm:px-8">
        <h1 className="text-4xl font-black tracking-tight text-foreground sm:text-5xl">
          {item.Name}
        </h1>
        <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
          {item.ProductionYear && <span>{item.ProductionYear}</span>}
          {item.OfficialRating && (
            <span className="rounded border border-border px-1.5 py-0.5 text-xs">
              {item.OfficialRating}
            </span>
          )}
          {item.RunTimeTicks ? <span>{formatRuntime(item.RunTimeTicks)}</span> : null}
          {item.CommunityRating && <span>★ {item.CommunityRating.toFixed(1)}</span>}
          {item.Genres?.slice(0, 3).map((g) => (
            <span key={g} className="rounded-full bg-secondary px-2.5 py-0.5 text-xs">
              {g}
            </span>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Link
            to="/watch/$id"
            params={{ id: item.Id }}
            className="inline-flex items-center gap-2 rounded-md bg-foreground px-6 py-2.5 text-sm font-bold text-background transition-colors hover:bg-foreground/80"
          >
            {pct > 0 ? <RotateCcw className="h-5 w-5" /> : <Play className="h-5 w-5 fill-current" />}
            {pct > 0 ? `${t("resume")} (${Math.round(pct)}%)` : t("play")}
          </Link>
          <SyncActions item={item} />
        </div>
        {item.Overview && (
          <p className="max-w-3xl text-sm leading-relaxed text-foreground/85 sm:text-base">
            {item.Overview}
          </p>
        )}
        {cast.length > 0 && (
          <p className="max-w-3xl text-sm text-muted-foreground">
            <span className="font-semibold text-foreground/70">{t("starring")}: </span>
            {cast.map((p) => p.Name).join(", ")}
          </p>
        )}

        {isSeries && activeSeason && (
          <div className="space-y-4 pt-4">
            <div className="flex items-center gap-3">
              <h2 className="text-xl font-bold text-foreground">{t("episodes")}</h2>
              <select
                value={activeSeason}
                onChange={(e) => setSeasonId(e.target.value)}
                className="rounded-md border border-border bg-card px-3 py-1.5 text-sm text-foreground outline-none focus:border-primary"
              >
                {seasons.map((s) => (
                  <option key={s.Id} value={s.Id}>
                    {s.Name}
                  </option>
                ))}
              </select>
            </div>
            <EpisodeList seriesId={item.Id} seasonId={activeSeason} />
          </div>
        )}
      </div>
    </div>
  );
}

function EpisodeList({ seriesId, seasonId }: { seriesId: string; seasonId: string }) {
  const { data: episodes } = useSuspenseQuery(
    queryOptions({
      queryKey: ["episodes", seriesId, seasonId],
      queryFn: () => getEpisodesFn({ data: { seriesId, seasonId } }),
    }),
  );

  return (
    <div className="divide-y divide-border overflow-hidden rounded-lg border border-border bg-card">
      {episodes.map((ep) => {
        const pct = ep.UserData?.PlayedPercentage ?? 0;
        return (
          <Link
            key={ep.Id}
            to="/watch/$id"
            params={{ id: ep.Id }}
            className="flex gap-4 p-4 transition-colors hover:bg-accent/50"
          >
            <div className="relative w-40 shrink-0 overflow-hidden rounded-md bg-muted sm:w-52">
              <img
                src={itemImageUrl(ep.Id, "Primary", 400)}
                alt={ep.Name}
                loading="lazy"
                className="aspect-video w-full object-cover"
              />
              {pct > 0 && pct < 95 && (
                <div className="absolute inset-x-0 bottom-0 h-1 bg-foreground/20">
                  <div className="h-full bg-primary" style={{ width: `${pct}%` }} />
                </div>
              )}
              {ep.UserData?.Played && (
                <div className="absolute right-1.5 top-1.5 rounded bg-primary px-1.5 py-0.5 text-[10px] font-bold text-primary-foreground">
                  WATCHED
                </div>
              )}
            </div>
            <div className="min-w-0 flex-1 space-y-1">
              <div className="flex items-baseline justify-between gap-3">
                <p className="truncate text-sm font-semibold text-foreground">
                  {episodeLabel(ep)} — {ep.Name}
                </p>
                <span className="shrink-0 text-xs text-muted-foreground">
                  {formatRuntime(ep.RunTimeTicks)}
                </span>
              </div>
              {ep.Overview && (
                <p className="line-clamp-2 text-xs text-muted-foreground sm:text-sm">
                  {ep.Overview}
                </p>
              )}
            </div>
          </Link>
        );
      })}
    </div>
  );
}
